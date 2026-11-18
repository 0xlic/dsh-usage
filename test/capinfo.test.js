import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { apply } from '../index.js';
import { usageKind, usageProviderTitle, capinfoTodayView, formatCapinfoUnitCost, formatTokenCount } from '../logic.js';
import * as logic from '../logic.js';

const refreshedAt = '2026-11-13T09:39:58.747Z';
const today = { amount: 0.8480409999999996, tokens: 5931951, refreshedAt };
const ready = (data = {}) => ({ status: 'ready', value: { status: 'ready', data: { ...today, ...data } } });

test('Capinfo routes by provider and formats tokens in M / B with two decimals', () => {
  assert.equal(usageKind('capinfo'), 'capinfo');
  assert.equal(usageKind('capinfo-other'), null);
  assert.equal(usageProviderTitle('capinfo'), 'Capinfo');
  assert.equal(usageProviderTitle('capinfo', 'capinfo'), 'capinfo');
  for (const [value, expected] of [
    [0, '0.00M'], [999, '0.00M'], [1000, '0.00M'], [1200, '0.00M'],
    [999999, '1.00M'], [1_000_000, '1.00M'], [5931951, '5.93M'],
    [999_999_999, '1000.00M'], [1_000_000_000, '1.00B'],
    [1_234_567_890, '1.23B'], [1_235_000_000, '1.24B'],
    [1_000_000_000_000, '1000.00B'],
  ]) assert.equal(formatTokenCount(value), expected);
  for (const invalid of [-1, 1.5, NaN, Infinity, '12']) assert.equal(formatTokenCount(invalid), '--');
});

test('Capinfo today view shows only the dsh-capinfo amount and token values', () => {
  assert.deepEqual(capinfoTodayView(ready()), {
    amount: '¥0.85', tokens: '5.93M', summary: '¥0.85 · 5.93M', refreshedAt: Date.parse(refreshedAt), reason: null,
  });
  assert.equal(capinfoTodayView(ready({ amount: 0 })).summary, '¥0.00 · 5.93M');
  assert.equal(capinfoTodayView(ready({ amount: null })).summary, '¥-- · 5.93M');
  assert.equal(capinfoTodayView(ready({ tokens: 0 })).summary, '¥0.85 · 0.00M');
  assert.equal(capinfoTodayView(ready({ amount: null, tokens: 0 })).summary, '¥-- · 0.00M');
  assert.equal(capinfoTodayView(ready({ amount: null, tokens: 0 })).reason, null);
  assert.equal(capinfoTodayView(ready({ refreshedAt: null })).refreshedAt, null);
  assert.equal(capinfoTodayView(ready({ refreshedAt: 'invalid' })).refreshedAt, null);
  for (const amount of [NaN, -1, '1.2']) assert.equal(capinfoTodayView(ready({ amount })).summary, '¥-- · 5.93M');
  for (const tokens of [-1, 1.5, '12']) assert.equal(capinfoTodayView(ready({ tokens })).summary, '¥0.85 · --');
  assert.deepEqual(capinfoTodayView(null), { amount: '¥--', tokens: '--', summary: '¥-- · --', refreshedAt: null, reason: 'loading' });
  assert.equal(capinfoTodayView({ status: 'failed', value: null }).reason, 'failed');
  assert.equal(capinfoTodayView({ status: 'ready', value: { status: 'missing' } }).reason, 'capinfoMissing');
  assert.equal(capinfoTodayView({ status: 'ready', value: { status: 'ready', data: null } }).reason, 'failed');
});

test('Capinfo unit cost uses raw daily totals and only rounds the result', () => {
  assert.equal(formatCapinfoUnitCost({ amount: 0.00126, tokens: 2_000 }), '¥0.63 / 1M Token');
  assert.equal(formatCapinfoUnitCost(today), '¥0.14 / 1M Token');
  assert.equal(formatCapinfoUnitCost({ amount: 0, tokens: 1_000_000 }), '¥0.00 / 1M Token');
  for (const amount of [null, undefined, -1, NaN, Infinity, '0.63']) {
    assert.equal(formatCapinfoUnitCost({ amount, tokens: today.tokens }), '--');
  }
  for (const tokens of [0, undefined, -1, 1.5, Infinity, '1000']) {
    assert.equal(formatCapinfoUnitCost({ amount: today.amount, tokens }), '--');
  }
});

test('Capinfo client hides the entire entry until discovered and when the service is absent', async () => {
  const source = await readFile(new URL('../client.source.js', import.meta.url), 'utf8');
  let plugin, Usage, snapshot = {status: 'loading', value: null}, hookCount = 0;
  const React = {
    Fragment: 'fragment', createElement: (type, props, ...children) => ({type, props: {...props, children}}),
    useSyncExternalStore: (_subscribe, get) => { hookCount++; return get(); },
    // Simulate an already-open popover: a missing service must remove it too.
    useState: initial => { hookCount++; return [initial === false ? true : typeof initial === 'function' ? initial() : initial, () => {}]; },
    useRef: current => { hookCount++; return {current}; }, useId: () => { hookCount++; return 'capinfo-usage'; },
    useEffect() { hookCount++; }, useLayoutEffect() { hookCount++; }, useCallback: fn => { hookCount++; return fn; },
  };
  const locale = {register() {}, bind: () => key => key, getSnapshot: () => ({active: 'en'}), subscribe() {}};
  vm.runInNewContext(source, {...logic,
    createUsageStore: () => ({subscribe() {}, getSnapshot: () => snapshot}),
    window: {__ModuleLoader__: {load: value => { plugin = value; }}}, document: {}, console,
  });
  plugin.factory(name => name === 'react' ? React : {createPortal: node => node}).apply({
    locale, get: name => ({locale, configForms: {get: () => ({subscribe() {}, getSnapshot: () => ({value: {performanceUsage: 'detailed'}})})}})[name],
    effect() {}, on() {}, slots: {inject: (_name, fn) => fn(), register: (_options, Component) => { Usage = Component; }},
  });
  let provider = 'capinfo';
  const directory = {getSnapshot: () => ({current: {provider, model: 'glm-5.3-flash'}})};
  const render = () => {
    hookCount = 0;
    let node = Usage({controller: {store: directory}});
    while (node && typeof node.type === 'function') node = node.type(node.props);
    return node;
  };
  assert.equal(render(), null);
  const expectedHooks = hookCount;
  snapshot = {status: 'ready', value: {status: 'missing', data: null}};
  assert.equal(render(), null);
  assert.equal(hookCount, expectedHooks);
  snapshot = ready();
  assert.equal(render().props.children[1].type, 'button');
  assert.equal(hookCount, expectedHooks);
  // A later uninstall hides the open entry, and reinstall can reveal it again.
  snapshot = {status: 'ready', value: {status: 'missing'}};
  assert.equal(render(), null);
  snapshot = ready({tokens: 0, amount: 0});
  assert.equal(render().props.children[1].type, 'button');
  provider = 'kimi-coding'; snapshot = {status: 'loading', value: null};
  assert.equal(render().props.children[1].type, 'button');
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

test('Capinfo host integration reads the dsh-capinfo service instead of the balance API', async () => {
  const source = await readFile(new URL('../client.source.js', import.meta.url), 'utf8');
  const host = await readFile(new URL('../host-capinfo.js', import.meta.url), 'utf8');
  assert.match(source, /if \(kind === 'capinfo'\) content = h\('span', \{ title: t\('capinfoToday'\) \},/);
  assert.match(source, /capinfoTodayView\(snapshot\)\.summary/);
  assert.match(source, /h\(DetailRow, \{ label: t\('capinfoAmount'\) \}, today\.amount\)/);
  assert.match(source, /h\(DetailRow, \{ label: t\('capinfoTokens'\) \}, today\.tokens\)/);
  const panel = source.slice(source.indexOf('function UsageDetails('), source.indexOf("          if (snapshot.status !== 'ready') return h(React.Fragment"));
  const unitCostRow = /h\(DetailRow, \{ label: t\('capinfoUnitCost'\) \}, formatCapinfoUnitCost\(snapshot\.value\.data\)\)/;
  assert.match(panel, unitCostRow);
  assert.doesNotMatch(source.replace(panel, ''), /formatCapinfoUnitCost\(/);
  assert.match(source, /if \(next && kind === 'capinfo'\) void detailStore\.refresh\(\{ force: true, reason: 'open' \}\)/);
  assert.doesNotMatch(source, /capinfoBalanceView|CAPINFO_API_KEY|user\/balance|capinfoBalance\.getSnapshot/);
  assert.match(host, /capinfoUsage/);
  assert.doesNotMatch(host, /\bfetch\b|Authorization|user\/balance|CAPINFO_API_KEY|DEFAULT_URL|credentials/);
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
