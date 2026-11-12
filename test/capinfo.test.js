import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { apply, inject } from '../index.js';
import { usageKind, usageProviderTitle, capinfoBalanceView } from '../logic.js';

const now = Date.parse('2026-11-10T10:00:00Z');
const ready = (data = {}) => ({ status: 'ready', updatedAt: new Date(now).toISOString(),
  data: { isValid: true, remaining: 87.5, total: 100, used: 12.5, unit: 'CNY', unlimited: false, ...data } });

test('Capinfo routes by provider and displays finite, zero, negative and unlimited Key quota', () => {
  assert.equal(usageKind('capinfo'), 'capinfo');
  assert.equal(usageKind('capinfo-other'), null);
  assert.equal(usageProviderTitle('capinfo'), 'Capinfo');
  assert.equal(usageProviderTitle('capinfo', 'capinfo'), 'capinfo');
  assert.deepEqual(capinfoBalanceView(ready(), now), { amount: '¥87.50', total: '¥100.00', used: '¥12.50', updatedAt: now, reason: null });
  assert.equal(capinfoBalanceView({ ...ready({ remaining: 299.8, total: 500, used: 200.2 }), demo: true }, now).amount, '¥299.80');
  assert.equal(capinfoBalanceView(ready({ remaining: 0 }), now).amount, '¥0.00');
  assert.equal(capinfoBalanceView(ready({ remaining: -2.5 }), now).amount, '¥-2.50');
  const unlimited = capinfoBalanceView(ready({ unlimited: true, remaining: null, total: null }), now);
  assert.equal(unlimited.amount, '¥∞');
  assert.equal(unlimited.total, '¥∞');
  assert.equal(unlimited.used, '¥12.50');
});

test('non-ready, invalid, malformed and stale snapshots never display retained money', () => {
  for (const [status, reason] of Object.entries({ pending: 'loading', unconfigured: 'keyRequired', unavailable: 'balanceUnavailable', error: 'failed', missing: 'capinfoMissing' })) {
    const value = capinfoBalanceView({ ...ready(), status }, now);
    assert.equal(value.amount, '¥--');
    assert.equal(value.reason, reason);
    assert.equal(value.updatedAt, now);
    assert.equal(value.total, undefined);
  }
  assert.equal(capinfoBalanceView(ready({ isValid: false }), now).reason, 'keyInvalid');
  for (const data of [{ unit: 'USD' }, { unlimited: true }, { unlimited: 'true' }, { remaining: null }, { remaining: NaN }, { remaining: Infinity }, { used: '12.5' }, { total: null }, { isValid: null }]) {
    assert.equal(capinfoBalanceView(ready(data), now).amount, '¥--');
  }
  for (const updatedAt of [null, 'invalid', new Date(now - 120001).toISOString(), new Date(now + 60001).toISOString()]) {
    assert.equal(capinfoBalanceView({ ...ready(), updatedAt }, now).reason, 'balanceStale');
  }
  assert.equal(capinfoBalanceView(ready(), now + 120000).amount, '¥87.50');
  assert.equal(capinfoBalanceView(null, now).amount, '¥--');
});

test('Host registers independent authenticated exact route with lifecycle cleanup', () => {
  let route, disposed = false; const cleanups = [];
  apply({credentials: {}, get: () => undefined, effect(callback) { cleanups.push(callback()); },
    connection: {fetch: {register(value) { route = value; return () => { disposed = true; }; }}}});
  assert.equal(route.path, '/api/plugins/usage/read');
  assert.deepEqual(route.methods, ['POST']);
  for (const cleanup of cleanups) cleanup();
  assert.equal(disposed, true);
});

test('Capinfo dock and details use quiet placeholders for every unavailable state', async () => {
  const source = await readFile(new URL('../client.source.js', import.meta.url), 'utf8');
  const details = source.slice(source.indexOf('function UsageDetails('), source.indexOf('        function UsageValue('));
  const compact = source.slice(source.indexOf('          let content;'), source.indexOf('          return h(React.Fragment, null,\n            h(\'style\''));
  const h = (type, props, ...children) => ({ type: typeof type === 'function' ? type.name : type, props, children });
  const snapshots = [
    { status: 'loading', value: null },
    { status: 'failed', value: null, error: 'verbose transport error' },
    ...['pending', 'unconfigured', 'unavailable', 'error', 'missing'].map(status => ({ status: 'ready', value: { ...ready(), status, error: 'verbose Host error' } })),
    { status: 'ready', value: ready({ isValid: false }) },
    { status: 'ready', value: ready({ remaining: null }) },
    { status: 'ready', value: { ...ready(), updatedAt: new Date(now - 120001).toISOString() } },
  ];
  const render = snapshot => {
    const context = { snapshot, kind: 'capinfo', now, h, React: { Fragment: 'fragment' },
      DetailRow: function DetailRow() {}, t: key => key, model: 'test-model',
      capinfoBalanceView, locale: { getSnapshot: () => ({ active: 'zh-CN' }) },
      formatUsageDate: () => 'formatted-date' };
    return {
      dock: vm.runInNewContext(`${compact}; content`, context),
      details: vm.runInNewContext(`${details}; UsageDetails({ snapshot, kind, now, model })`, context),
    };
  };
  for (const snapshot of snapshots) {
    const tree = render(snapshot);
    assert.equal(tree.dock.children.join(''), '¥--');
    assert.equal(tree.dock.props.title, 'keyBalance');
    const text = JSON.stringify(tree);
    assert.equal((text.match(/¥--/g) || []).length, 4);
    assert.match(text, /updatedAt.*--/);
    assert.doesNotMatch(text, /verbose|failed|loading|keyInvalid|balanceStale|capinfoMissing|formatted-date|87\.50|dshUsageError|dshUsageReason/);
  }
  const success = JSON.stringify(render({ status: 'ready', value: ready() }));
  assert.match(success, /¥87\.50/);
  assert.match(success, /¥100\.00/);
  assert.match(success, /¥12\.50/);
  assert.match(success, /formatted-date/);
});

test('all Client readers use the authenticated usage RPC with force and exact model identity', async () => {
  const source = await readFile(new URL('../client.source.js', import.meta.url), 'utf8');
  const reader = source.slice(source.indexOf('async function readHostUsage('), source.indexOf('        const stores ='));
  const signal = new AbortController().signal;
  const calls = [];
  const fetch = async (...args) => { calls.push(args); return Response.json({ok: true, value: {status: 'ready'}}); };
  const context = { fetch, signal, unwrap: result => result.value,
    locale: { getSnapshot: () => ({ active: 'zh-CN' }) } };
  for (const kind of ['codex', 'capinfo', 'deepseek']) {
    await vm.runInNewContext(`${reader}; readHostUsage('${kind}', 'provider-id', 'model-id', signal, {force:true})`, context);
    const [url, options] = calls.at(-1);
    assert.equal(url, '/api/plugins/usage/read');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.method, 'POST');
    const payload = JSON.parse(options.body);
    assert.equal(payload.kind, kind); assert.equal(payload.provider, 'provider-id');
    assert.equal(payload.model, 'model-id'); assert.equal(payload.force, true);
    assert.equal(options.signal, signal);
  }
  assert.doesNotMatch(source, /codex-subscription\/|capinfo-balance|capinfoBalance\.getSnapshot|CAPINFO_API_KEY|account\/select/);
});
