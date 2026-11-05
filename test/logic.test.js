import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usageKind, quotaWindows, resetDuration, resetCountdown, windowLabel, accountRows, walletTotals, formatWalletAmount, createUsageStore, usageProviderTitle, formatUsageDate, usagePopoverPosition } from '../logic.js';

const window = (remainingPercent, windowSeconds = 18000, resetsAt = 2000000000) => ({ remainingPercent, windowSeconds, resetsAt });
test('balance shows only currency symbol and exactly two rounded decimal places', () => {
  for (const [amount, expected] of [['67.20813268', '¥67.21'], ['0', '¥0.00'], ['1.005', '¥1.01'], ['9.999', '¥10.00'], ['63.7', '¥63.70'], ['-0.001', '¥0.00']]) {
    assert.equal(formatWalletAmount({ currency: 'CNY', amount }), expected);
  }
  assert.equal(formatWalletAmount({ currency: 'USD', amount: '2.5' }), '$2.50');
});
test('detail reset countdown splits days, hours and minutes and handles elapsed resets', () => {
  const now = 1800000000000;
  assert.deepEqual(resetCountdown(now / 1000 + (6 * 1440 + 7 * 60 + 9) * 60, now), { days: 6, hours: 7, minutes: 9 });
  assert.deepEqual(resetCountdown(now / 1000 + 3 * 3600 + 1, now), { days: 0, hours: 3, minutes: 1 });
  assert.deepEqual(resetCountdown(now / 1000 + 86400, now), { days: 1, hours: 0, minutes: 0 });
  assert.equal(resetCountdown(now / 1000, now), 'due');
  assert.equal(resetCountdown(null, now), null);
});
test('billing identity follows provider, not model name', () => {
  assert.equal(usageKind('openai-codex'), 'codex');
  assert.equal(usageKind('deepseek-account'), 'deepseek');
  assert.equal(usageKind('deepseek-official'), null);
  assert.equal(usageKind('custom'), null);
});
test('Codex standard, exact model and Spark pools stay separate', () => {
  const usage = { rateLimits: [
    { id: 'codex', windows: [window(83), window(61, 604800)] },
    { id: 'spark', windows: [window(42)] },
    { id: 'gpt-6.1-sol', windows: [window(91)] },
  ] };
  assert.deepEqual(quotaWindows(usage, 'gpt-6.1-sol').map(w => w.remainingPercent), [91]);
  assert.deepEqual(quotaWindows(usage, 'gpt-6').map(w => w.remainingPercent), [83, 61]);
  assert.deepEqual(quotaWindows(usage, 'gpt-5-spark').map(w => w.remainingPercent), [42]);
  assert.deepEqual(quotaWindows(usage, 'gpt-reserve'), []);
});
test('unknown and malformed windows never turn into 0% or 100%', () => {
  assert.deepEqual(quotaWindows(null, 'gpt-6'), []);
  const usage = { rateLimits: [{ id: 'codex', windows: [window(101), window(-1), window(null), window(50, -1), window(0)] }] };
  assert.deepEqual(quotaWindows(usage, 'gpt-6').map(w => w.remainingPercent), [0]);
});
test('only the active account is shown, joined by id rather than list order', () => {
  const rows = accountRows({ authenticated: true, accounts: [
    { id: 'a', label: 'First' }, { id: 'b', active: true, label: 'Second' },
  ] }, { accounts: [{ id: 'b', usage: { fetchedAt: 1 } }, { id: 'a', error: 'expired' }] });
  assert.deepEqual(rows.map(r => r.id), ['b']);
  assert.equal(rows[0].usage.fetchedAt, 1);
  const switched = accountRows({ authenticated: true, accounts: [{ id: 'a', active: true }, { id: 'b' }] }, { accounts: [{ id: 'a', usage: { fetchedAt: 2 } }] });
  assert.deepEqual(switched.map(r => r.id), ['a']);
  assert.equal(switched[0].usage.fetchedAt, 2);
  assert.deepEqual(accountRows({ authenticated: false }, {}), []);
  assert.deepEqual(accountRows({ authenticated: true, accounts: [{ id: 'a' }, { id: 'b' }] }, {}), []);
  assert.equal(accountRows({ authenticated: true, accounts: [{ id: 'a' }] }, { accounts: [] })[0].active, true);
});
test('reset countdown uses seconds, never fabricates replenished quota', () => {
  const now = 1800000000000;
  assert.equal(resetDuration(now / 1000 + 17940, now), '4h59m');
  assert.equal(resetDuration(now / 1000 + (6 * 24 + 9) * 3600, now), '6d9h');
  assert.equal(resetDuration(now / 1000 - 1, now), 'due');
  assert.equal(resetDuration(null, now), null);
  assert.equal(windowLabel(18000), '5h');
  assert.equal(windowLabel(604800), '7day');
  assert.equal(windowLabel(86400), '1day');
});
test('wallet totals add recharge and bonus exactly, preserving currencies and precision', () => {
  assert.deepEqual(walletTotals({ status: 'ready', value: [{ currency: 'CNY', balance: '68.18' }], bonusWallets: [{ currency: 'CNY', balance: '0.1' }, { currency: 'USD', balance: '0.001' }] }), [
    { currency: 'CNY', amount: '68.28' }, { currency: 'USD', amount: '0.001' },
  ]);
  assert.deepEqual(walletTotals({ status: 'ready', value: [{ currency: 'CNY', balance: '0' }] }), [{ currency: 'CNY', amount: '0.00' }]);
  assert.deepEqual(walletTotals(null), []);
  assert.deepEqual(walletTotals({ status: 'failed' }), []);
});
test('detail title follows provider branding with extensible catalog names', () => {
  assert.equal(usageProviderTitle('codex'), 'Codex');
  assert.equal(usageProviderTitle('deepseek'), 'DeepSeek');
  assert.equal(usageProviderTitle('custom', 'Capinfo'), 'Capinfo');
});
test('detail dates include calendar date and local reset time rather than just duration', () => {
  const date = formatUsageDate(Date.parse('2026-11-05T04:09:00Z'), 'zh-CN', 'Asia/Shanghai');
  assert.match(date, /2026/);
  assert.match(date, /11/);
  assert.match(date, /05/);
  assert.match(date, /12:09/);
  assert.equal(formatUsageDate(null), null);
  assert.equal(formatUsageDate(NaN), null);
});
test('popover opens above trigger, clamps horizontal overflow, and fits short viewports', () => {
  assert.deepEqual(usagePopoverPosition({ right: 1000, top: 700, bottom: 720 }, { width: 360, height: 260 }, { width: 1200, height: 800 }), { left: 640, top: 432 });
  assert.deepEqual(usagePopoverPosition({ right: 160, top: 20, bottom: 40 }, { width: 300, height: 200 }, { width: 390, height: 800 }), { left: 12, top: 48 });
  assert.deepEqual(usagePopoverPosition({ right: 400, top: 100, bottom: 120 }, { width: 300, height: 240 }, { width: 390, height: 300 }), { left: 78, top: 48 });
});
const tick = () => new Promise(resolve => setImmediate(resolve));
test('shared store deduplicates reads and cancels its timer on final unmount', async () => {
  let calls = 0, cancels = 0;
  const store = createUsageStore(async () => ++calls, { schedule: () => 123, cancel: () => cancels++ });
  const offA = store.subscribe(() => {}), offB = store.subscribe(() => {});
  await tick();
  assert.equal(calls, 1);
  assert.deepEqual(store.getSnapshot(), { status: 'ready', value: 1 });
  offA(); offB();
  assert.equal(cancels, 1);
  assert.equal(store.getSnapshot().value, null);
  store.dispose();
});
test('account invalidation discards late in-flight account data', async () => {
  const pending = [];
  const store = createUsageStore(() => new Promise(resolve => pending.push(resolve)), { schedule: () => 1, cancel: () => {} });
  const off = store.subscribe(() => {});
  await tick();
  store.invalidate();
  await tick();
  pending[0]({ account: 'old' });
  await tick();
  assert.equal(store.getSnapshot().value, null);
  pending[1]({ account: 'new' });
  await tick();
  assert.deepEqual(store.getSnapshot().value, { account: 'new' });
  off(); store.dispose();
});
test('failed reads drop old values rather than silently presenting stale quota', async () => {
  let fail = false;
  const reported = [];
  const store = createUsageStore(async () => { if (fail) throw new Error('expired'); return 42; }, {
    schedule: () => 1, cancel: () => {}, onError: error => reported.push(error.message),
  });
  const off = store.subscribe(() => {});
  await tick(); fail = true;
  await store.refresh();
  assert.deepEqual(store.getSnapshot(), { status: 'failed', value: null, error: 'expired' });
  assert.deepEqual(reported, ['expired']);
  off(); store.dispose();
});
test('failure text is single-line and bounded for a tooltip', async () => {
  const store = createUsageStore(async () => { throw new Error(`bad\nname ${'x'.repeat(400)}`); }, { schedule: () => 1, cancel: () => {} });
  const off = store.subscribe(() => {});
  await tick();
  assert.equal(store.getSnapshot().error.startsWith('bad name'), true);
  assert.equal(store.getSnapshot().error.length, 300);
  off(); store.dispose();
});
