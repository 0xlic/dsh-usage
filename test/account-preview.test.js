import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountRows, nextPreviewAccountId, codexPreviewState, activateCodexAccount } from '../logic.js';

const accounts = [{ id: 'a', label: 'First', active: true }, { id: 'b', label: 'Second' }, { id: 'c', label: 'Third' }];
const status = list => ({ authenticated: true, accounts: list });
const ready = value => ({ status: 'ready', value });
const activeSnapshot = ready({ accounts, rows: [{ ...accounts[0], usage: { tag: 'active-usage' } }] });
const previewSnapshot = ready({ rows: accounts.map(account => ({ ...account, usage: { tag: account.id } })) });

test('preview cycles over all account ids without modifying active flags', () => {
  const original = structuredClone(accounts);
  assert.equal(nextPreviewAccountId(accounts, null, 'a'), 'b');
  assert.equal(nextPreviewAccountId(accounts, 'b', 'a'), 'c');
  assert.equal(nextPreviewAccountId(accounts, 'c', 'a'), 'a');
  assert.equal(nextPreviewAccountId([], null, null), null);
  assert.equal(nextPreviewAccountId([accounts[0]], null, 'a'), 'a');
  assert.deepEqual(accounts, original);
});
test('all-account joining is explicit; default compact status remains active-only', () => {
  const usage = { accounts: [{ id: 'b', usage: { percent: 99 } }, { id: 'a', usage: { percent: 0 } }, { id: 'c', error: 'expired' }] };
  assert.deepEqual(accountRows(status(accounts), usage).map(row => row.id), ['a']);
  const all = accountRows(status(accounts), usage, true);
  assert.deepEqual(all.map(row => row.id), ['a', 'b', 'c']);
  assert.equal(all[1].usage.percent, 99);
  assert.equal(all[2].failed, true);
  assert.equal(all[2].usage, undefined);
});
test('preview details show the selected account without replacing the active compact snapshot', () => {
  const state = codexPreviewState(activeSnapshot, previewSnapshot, 'b');
  assert.equal(state.isPreview, true);
  assert.equal(state.activeId, 'a');
  assert.deepEqual(state.detailSnapshot.value.rows.map(row => row.id), ['b']);
  assert.equal(state.detailSnapshot.value.rows[0].usage.tag, 'b');
  assert.equal(activeSnapshot.value.rows[0].usage.tag, 'active-usage');
  const active = codexPreviewState(activeSnapshot, previewSnapshot, 'a');
  assert.equal(active.isPreview, false);
  assert.equal(active.detailSnapshot, activeSnapshot);
});
test('removed preview falls back to active account; unloaded preview never shows active quota under another id', () => {
  const removed = codexPreviewState(activeSnapshot, previewSnapshot, 'removed');
  assert.equal(removed.isPreview, false);
  assert.equal(removed.selectedId, 'a');
  const loading = { status: 'loading', value: null };
  assert.equal(codexPreviewState(activeSnapshot, loading, 'b').detailSnapshot, loading);
  assert.equal(codexPreviewState(activeSnapshot, ready({ rows: [] }), 'b').detailSnapshot.error, 'account-removed');
});
test('external activation of previewed account automatically hides the apply check', () => {
  const switched = ready({ accounts: accounts.map(a => ({ ...a, active: a.id === 'b' })), rows: [{ ...accounts[1], active: true, usage: { tag: 'fresh-b' } }] });
  const state = codexPreviewState(switched, previewSnapshot, 'b');
  assert.equal(state.isPreview, false);
  assert.equal(state.detailSnapshot.value.rows[0].usage.tag, 'fresh-b');
});
test('activation calls the original Host operation once and verifies status; never changes GPT model', async () => {
  const calls = [];
  let selected = 'a';
  const call = async (endpoint, payload) => {
    calls.push({ endpoint, payload });
    if (endpoint === 'account/select') selected = payload.id;
    return status(accounts.map(account => ({ ...account, active: account.id === selected })));
  };
  const after = await activateCodexAccount(call, 'b', 'a');
  assert.equal(after.accounts.find(account => account.active).id, 'b');
  assert.deepEqual(calls.map(call => call.endpoint), ['status', 'account/select', 'status']);
  assert.deepEqual(calls[1].payload, { id: 'b' });
});
test('preflight refuses a changed active account or deleted target without mutating anything', async () => {
  for (const [list, expected] of [
    [accounts.map(account => ({ ...account, active: account.id === 'c' })), 'active-account-changed'],
    [[accounts[0]], 'account-removed'],
  ]) {
    const calls = [];
    const call = async endpoint => { calls.push(endpoint); return status(list); };
    await assert.rejects(activateCodexAccount(call, 'b', 'a'), error => error.code === expected);
    assert.deepEqual(calls, ['status']);
  }
});
test('activating an already active account is an idempotent read-only no-op', async () => {
  const calls = [];
  await activateCodexAccount(async endpoint => { calls.push(endpoint); return status(accounts); }, 'a', 'a');
  assert.deepEqual(calls, ['status']);
});
test('unconfirmed or failed activation never claims success or silently rolls back a newer choice', async () => {
  const calls = [];
  await assert.rejects(activateCodexAccount(async endpoint => {
    calls.push(endpoint);
    return status(accounts);
  }, 'b', 'a'), error => error.code === 'account-selection-unconfirmed');
  assert.deepEqual(calls, ['status', 'account/select', 'status']);
  const failed = [];
  await assert.rejects(activateCodexAccount(async endpoint => {
    failed.push(endpoint);
    if (endpoint === 'account/select') throw new Error('network');
    return status(accounts);
  }, 'b', 'a'), /network/);
  assert.deepEqual(failed, ['status', 'account/select']);
});
test('unmounted or cancelled confirmation does not begin an account mutation', async () => {
  const controller = new AbortController();
  const calls = [];
  await assert.rejects(activateCodexAccount(async endpoint => {
    calls.push(endpoint); controller.abort(); return status(accounts);
  }, 'b', 'a', controller.signal), { name: 'AbortError' });
  assert.deepEqual(calls, ['status']);
});
