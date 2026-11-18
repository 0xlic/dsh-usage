import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {DeepSeekApiUsageAdapter, deepseekApiRoute, parseDeepseekApiBalance, DEEPSEEK_BALANCE_URL} from '../host-deepseek-api.js';
import {HostUsageCache} from '../host-cache.js';
import {createUsageHost, validateUsageRequest} from '../index.js';
import * as logic from '../logic.js';

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise, resolve};
};
const payload = amount => ({is_available: true, balance_infos: [{currency: 'CNY', total_balance: amount}]});
const route = () => ({url: DEEPSEEK_BALANCE_URL, keyRef: 'DEEPSEEK_API_KEY'});
function context({directory, rows = [], environment = {get: () => undefined}} = {}) {
  return {get: name => ({llm: directory && {listConfigurableProviders: () => directory},
    settings: {describe: () => rows}, launchEnvironment: environment})[name]};
}
function fixture(t, options = {}) {
  const cache = new HostUsageCache(options);
  const credentials = {token: 'api-secret', async resolve(ref) {
    assert.equal(ref, 'DEEPSEEK_API_KEY');
    return this.token === undefined ? undefined : {value: this.token};
  }};
  const adapter = new DeepSeekApiUsageAdapter({cache, credentials, route,
    fetch: async () => Response.json(payload('12.00')), ...options});
  t.after(() => { adapter.dispose(); cache.dispose(); });
  return {cache, credentials, adapter};
}
const hasCode = code => error => error.code === code;

test('API route follows configurable provider namespace, nested settingsPath and custom key reference live', () => {
  const config = {baseURL: 'https://api.deepseek.com/anthropic', apiKeyEnv: 'CUSTOM_API_KEY'};
  const ctx = context({directory: [{provider: 'unrelated', settingsNs: 'wrong'},
    {provider: 'deepseek-official', settingsNs: 'owner', settingsPath: ['profile', 'api']}],
  rows: [{ns: 'llm-deepseek', value: {baseURL: 'https://wrong.test'}}, {ns: 'owner', value: {profile: {api: config}}}]});
  assert.deepEqual(deepseekApiRoute(ctx), {url: DEEPSEEK_BALANCE_URL, keyRef: 'CUSTOM_API_KEY'});
  config.apiKeyEnv = 'ROTATED_REF';
  assert.equal(deepseekApiRoute(ctx).keyRef, 'ROTATED_REF');
  assert.throws(() => deepseekApiRoute(context({directory: [{provider: 'deepseek-official', settingsNs: 'missing'}]})), hasCode('usage/configuration'));
});

test('API route supports both legacy settings namespaces and launch environment without reading its key', () => {
  for (const ns of ['llm-deepseek', 'llm-deepseek-api-key']) {
    assert.equal(deepseekApiRoute(context({rows: [{ns, value: {apiKeyEnv: '_CUSTOM_1'}}]})).keyRef, '_CUSTOM_1');
  }
  const reads = [];
  const environment = {get: name => { reads.push(name); return {value: 'https://custom.test'}; }};
  assert.deepEqual(deepseekApiRoute(context({environment})), {unsupported: true});
  assert.deepEqual(reads, ['DEEPSEEK_BASE_URL']);
  assert.deepEqual(deepseekApiRoute(context({environment, rows: [{ns: 'llm-deepseek', value: {baseURL: 'https://api.deepseek.com/v1'}}]})), route());
  // An installed launchEnvironment owns resolution, even when it has no value.
  assert.deepEqual(deepseekApiRoute(context({environment: {get: () => undefined}})), route());
});

test('API route uses process environment only when launchEnvironment is absent', () => {
  const previous = process.env.DEEPSEEK_BASE_URL;
  try {
    process.env.DEEPSEEK_BASE_URL = 'https://custom.test';
    assert.deepEqual(deepseekApiRoute(context({environment: null})), {unsupported: true});
    assert.deepEqual(deepseekApiRoute(context()), route());
    process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
    assert.deepEqual(deepseekApiRoute(context({environment: null})), route());
    delete process.env.DEEPSEEK_BASE_URL;
    assert.deepEqual(deepseekApiRoute(context({environment: null})), route());
  } finally {
    if (previous === undefined) delete process.env.DEEPSEEK_BASE_URL;
    else process.env.DEEPSEEK_BASE_URL = previous;
  }
});

test('API route accepts only the official HTTPS origin and never derives balance URL from configured paths', () => {
  for (const baseURL of ['https://api.deepseek.com', 'https://api.deepseek.com/v1', 'https://api.deepseek.com/anthropic', 'https://api.deepseek.com/arbitrary/path']) {
    assert.deepEqual(deepseekApiRoute(context({rows: [{ns: 'llm-deepseek', value: {baseURL}}]})), route());
  }
  for (const baseURL of ['http://api.deepseek.com', 'https://evil.test', 'https://api.deepseek.com.evil.test',
    'https://sub.api.deepseek.com', 'https://api.deepseek.com:444', 'https://user@api.deepseek.com',
    'https://user:pass@api.deepseek.com', 'https://api.deepseek.com/v1?key=secret', 'https://api.deepseek.com/#secret']) {
    assert.deepEqual(deepseekApiRoute(context({rows: [{ns: 'llm-deepseek', value: {baseURL}}]})), {unsupported: true}, baseURL);
  }
  for (const apiKeyEnv of ['', '1KEY', 'A-B', 'A B', 'KEY\n', 42, {}]) {
    assert.throws(() => deepseekApiRoute(context({rows: [{ns: 'llm-deepseek', value: {apiKeyEnv}}]})), hasCode('usage/configuration'));
  }
});

test('parser projects each optional monetary field independently, preserves zero, precision and currencies', () => {
  assert.deepEqual(parseDeepseekApiBalance({is_available: false, secret: 'hidden', balance_infos: [
    {currency: 'CNY', total_balance: '0', topped_up_balance: '1.234567890123456789', secret: 'hidden'},
    {currency: 'USD', granted_balance: '0.00', total_balance: '-2.50'},
  ]}), {totals: [{currency: 'CNY', amount: '0'}, {currency: 'USD', amount: '-2.50'}],
    recharge: [{currency: 'CNY', amount: '1.234567890123456789'}], bonus: [{currency: 'USD', amount: '0.00'}], isAvailable: false});
  assert.deepEqual(parseDeepseekApiBalance({balance_infos: [{currency: 'USD', granted_balance: '2'}]}),
    {totals: [], recharge: [], bonus: [{currency: 'USD', amount: '2'}]});
  assert.deepEqual(parseDeepseekApiBalance({is_available: true}), {totals: [], recharge: [], bonus: [], isAvailable: true});
  // The API total is authoritative, not the sum of recharge and bonus.
  assert.equal(parseDeepseekApiBalance({balance_infos: [{currency: 'CNY', total_balance: '9', topped_up_balance: '1', granted_balance: '2'}]}).totals[0].amount, '9');
});

test('parser rejects malformed envelopes and ignores invalid amounts without inventing zero', () => {
  for (const value of [null, [], 'balance', 0, {}, {is_available: 'true'}, {balance_infos: {}}, {balance_infos: null}, {balance_infos: Array(101).fill({})}]) {
    assert.throws(() => parseDeepseekApiBalance(value), hasCode('usage/unavailable'));
  }
  for (const total_balance of [0, null, undefined, NaN, Infinity, '', 'NaN', 'Infinity', '1e2', '+1', '.1', '1.', ' 1', '1\n', '1'.repeat(129)]) {
    const result = parseDeepseekApiBalance({is_available: false, balance_infos: [{currency: 'CNY', total_balance, granted_balance: '0'}]});
    assert.deepEqual(result.totals, []);
    assert.deepEqual(result.bonus, [{currency: 'CNY', amount: '0'}]);
  }
  assert.deepEqual(parseDeepseekApiBalance({is_available: false, balance_infos: [null, false, {}, {currency: 'EUR', total_balance: '10'}]}),
    {totals: [], recharge: [], bonus: [], isAvailable: false});
  assert.equal(parseDeepseekApiBalance({balance_infos: Array(100).fill({currency: 'USD', total_balance: '0'})}).totals.length, 100);
});

test('adapter coalesces reads, clones cached values, respects TTL and force, and uses only trusted request fields', async t => {
  let now = 100, calls = 0;
  const {adapter} = fixture(t, {now: () => now, ttlMs: 60, fetch: async (url, options) => {
    calls++;
    assert.equal(url, DEEPSEEK_BALANCE_URL);
    assert.deepEqual(options.headers, {Authorization: 'Bearer api-secret', Accept: 'application/json'});
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    assert.equal(options.signal.aborted, false);
    return Response.json({...payload('0'), api_key: 'should-not-pass'});
  }});
  const [a, b] = await Promise.all([adapter.read({}), adapter.read({force: true})]);
  assert.equal(calls, 1); assert.equal(a.updatedAt, 100);
  a.totals[0].amount = '999'; assert.equal(b.totals[0].amount, '0');
  assert.equal((await adapter.read({})).totals[0].amount, '0'); assert.equal(calls, 1);
  now = 161; await adapter.read({}); assert.equal(calls, 2);
  await adapter.read({force: true}); assert.equal(calls, 3);
  assert.doesNotMatch(JSON.stringify(b), /api-secret|should-not-pass|api_key/);
});

test('adapter rotates keys and removes cached balance when credentials disappear', async t => {
  let calls = 0;
  const {adapter, credentials, cache} = fixture(t, {fetch: async () => { calls++; return Response.json(payload(String(calls))); }});
  assert.equal((await adapter.read({})).totals[0].amount, '1');
  credentials.token = 'next-secret';
  assert.equal((await adapter.read({})).totals[0].amount, '2');
  credentials.token = undefined;
  assert.deepEqual(await adapter.read({}), {unconfigured: true});
  assert.equal(cache.entries.has('deepseek-api'), false);
  credentials.token = 'next-secret'; await adapter.read({}); assert.equal(calls, 3);
});

for (const change of ['rotate', 'remove']) test(`adapter rejects late responses after credentials ${change}`, async t => {
  const gate = deferred(), started = deferred();
  const {adapter, credentials} = fixture(t, {fetch: async () => { started.resolve(); await gate.promise; return Response.json(payload('99')); }});
  const pending = adapter.read({});
  const rejected = assert.rejects(pending, hasCode('usage/identity-changed'));
  await started.promise;
  credentials.token = change === 'rotate' ? 'new-secret' : undefined;
  gate.resolve(); await rejected;
  if (change === 'remove') assert.deepEqual(await adapter.read({}), {unconfigured: true});
  else { adapter.fetch = async () => Response.json(payload('1')); assert.equal((await adapter.read({})).totals[0].amount, '1'); }
});

test('unsupported routes skip credential access and fetch, and clear prior cached data', async t => {
  const {adapter, cache} = fixture(t);
  await adapter.read({});
  adapter.route = () => ({unsupported: true});
  adapter.credentials.resolve = () => { throw new Error('must not resolve'); };
  adapter.fetch = () => { throw new Error('must not fetch'); };
  assert.deepEqual(await adapter.read({}), {unsupported: true});
  assert.equal(cache.entries.has('deepseek-api'), false);
});

test('invalid credentials are rejected before fetch', async t => {
  const {adapter, credentials} = fixture(t, {fetch: () => { assert.fail('must not fetch'); }});
  for (const token of ['', null, 42, {}, 'a b', 'a\nb', '密钥', 'a\x7fb']) {
    credentials.token = token;
    await assert.rejects(adapter.read({}), hasCode('usage/auth-required'));
  }
});

for (const status of [401, 403, 404, 429, 500]) test(`HTTP ${status} errors are sanitized and force cannot bypass cooldown`, async t => {
  let now = 0, calls = 0;
  const {adapter} = fixture(t, {now: () => now, cooldownMs: 5, fetch: async () => { calls++; return new Response('api-secret upstream detail', {status}); }});
  const check = error => error.code === ([401, 403].includes(status) ? 'usage/auth-required' : 'usage/unavailable') && !/api-secret|upstream detail/.test(error.message);
  await assert.rejects(adapter.read({}), check);
  await assert.rejects(adapter.read({force: true}), check); assert.equal(calls, 1);
  now = 6; await assert.rejects(adapter.read({force: true}), check); assert.equal(calls, 2);
});

test('network and JSON failures cannot leak secrets through adapter or RPC', async t => {
  for (const fetch of [async () => { throw new Error('api-secret network'); }, async () => ({ok: true, json: async () => { throw new Error('api-secret JSON'); }})]) {
    const {adapter} = fixture(t, {fetch});
    await assert.rejects(adapter.read({}), error => error.code === 'usage/unavailable' && !error.message.includes('api-secret'));
  }
  const ctx = context();
  ctx.credentials = {resolve: async () => { throw new Error('api-secret credential backend'); }};
  const host = createUsageHost(ctx);
  t.after(() => host.dispose());
  const result = await host.dispatch('usage/read', {kind: 'deepseek-api', provider: 'deepseek-official'});
  assert.equal(result.error.code, 'usage/unavailable');
  assert.deepEqual(result.error.details, {});
  assert.doesNotMatch(JSON.stringify(result), /api-secret|credential backend/);
});

test('API usage and signed-in account usage are isolated, including simultaneous reads and caches', async t => {
  let apiCalls = 0, accountCalls = 0;
  const ctx = context();
  ctx.credentials = {resolve: async ref => { assert.equal(ref, 'DEEPSEEK_API_KEY'); return {value: 'independent-api-secret'}; }};
  const get = ctx.get;
  ctx.get = name => name === 'deepseekAccount' ? {
    getPlatformSession: async () => ({origin: 'https://platform.deepseek.com', token: 'account-secret', userId: 'signed-in-user'}),
    getBalance: async () => { accountCalls++; return {status: 'ready', value: [{currency: 'CNY', balance: '99'}]}; },
  } : get(name);
  const host = createUsageHost(ctx, {fetch: async (_url, options) => {
    apiCalls++; assert.equal(options.headers.Authorization, 'Bearer independent-api-secret'); return Response.json(payload('1'));
  }});
  t.after(() => host.dispose());
  const api = {kind: 'deepseek-api', provider: 'deepseek-official'};
  const account = {kind: 'deepseek', provider: 'deepseek-account', client: {version: '1', locale: 'en', timezoneOffsetSeconds: 0}};
  const [a, b] = await Promise.all([host.dispatch('usage/read', api), host.dispatch('usage/read', account)]);
  assert.equal(a.ok, true); assert.equal(b.ok, true);
  assert.equal(a.value.totals[0].amount, '1'); assert.equal(b.value.totals[0].amount, '99.00');
  await host.dispatch('usage/read', api); await host.dispatch('usage/read', account);
  assert.equal(apiCalls, 1); assert.equal(accountCalls, 1);
  assert.doesNotMatch(JSON.stringify([a, b]), /independent-api-secret|account-secret|signed-in-user/);
});

test('adapter dispose aborts pending fetch and disallows future reads', async t => {
  const started = deferred(), gate = deferred(); let upstream;
  const {adapter} = fixture(t, {fetch: async (_url, options) => { upstream = options.signal; started.resolve(); await gate.promise; return Response.json(payload('1')); }});
  const pending = adapter.read({});
  const rejected = assert.rejects(pending, hasCode('usage/cancelled'));
  await started.promise; adapter.dispose();
  assert.equal(upstream.aborted, true);
  await rejected;
  gate.resolve();
  await assert.rejects(adapter.read({}), hasCode('usage/cancelled'));
});

test('RPC enforces exact provider/kind pairings and rejects client data for API keys', async t => {
  const providers = ['deepseek-official', 'deepseek-account', 'capinfo', `codex-sub-${'a'.repeat(32)}`];
  const kinds = ['deepseek-api', 'deepseek', 'capinfo', 'codex'];
  const client = {version: '1', locale: 'en', timezoneOffsetSeconds: 0};
  const host = createUsageHost(context()); t.after(() => host.dispose());
  for (let i = 0; i < kinds.length; i++) for (let j = 0; j < providers.length; j++) {
    const input = {kind: kinds[i], provider: providers[j], ...(kinds[i] === 'deepseek' ? {client} : {})};
    if (i === j) assert.equal(validateUsageRequest(input), input);
    else {
      assert.throws(() => validateUsageRequest(input), hasCode('usage/invalid-request'));
      assert.equal((await host.dispatch('usage/read', input)).error.code, 'usage/invalid-request');
    }
  }
  for (const extra of [{client}, {apiKey: 'secret'}, {url: 'https://evil.test'}, {force: 'true'}]) {
    assert.throws(() => validateUsageRequest({kind: 'deepseek-api', provider: 'deepseek-official', ...extra}), hasCode('usage/invalid-request'));
  }
  assert.throws(() => validateUsageRequest({kind: 'deepseek-api', provider: 'deepseek-official'}, true), hasCode('usage/invalid-request'));
});

test('actual client components route deepseek-official to deepseek-api and hide missing monetary detail rows while showing zero', async () => {
  const source = await readFile(new URL('../client.source.js', import.meta.url), 'utf8');
  let plugin, Usage, snapshot = {status: 'ready', value: {totals: [], recharge: [], bonus: [], isAvailable: false}};
  const requests = [];
  let hostResult = {ok: true, value: {}};
  const React = {
    Fragment: 'fragment', createElement: (type, props, ...children) => ({type, props: {...props, children}}),
    useSyncExternalStore: (_subscribe, get) => get(),
    useState: initial => [initial === false ? true : typeof initial === 'function' ? initial() : initial, () => {}],
    useRef: current => ({current}), useId: () => 'api-usage',
    useEffect() {}, useLayoutEffect() {}, useCallback: fn => fn,
  };
  const locale = {register() {}, bind: () => key => key, subscribe() {}, getSnapshot: () => ({active: 'en'})};
  vm.runInNewContext(source, {...logic,
    createUsageStore: request => { requests.push(request); return {subscribe() {}, getSnapshot: () => snapshot}; },
    fetch: async (_url, options) => { requests.push(JSON.parse(options.body)); return {ok: true, json: async () => hostResult}; },
    window: {__ModuleLoader__: {load: value => { plugin = value; }}}, document: {}, console,
  });
  plugin.factory(name => name === 'react' ? React : {createPortal: value => value}).apply({
    locale, get: name => ({locale, configForms: {get: () => ({subscribe() {}, getSnapshot: () => ({})})}})[name],
    effect() {}, on() {}, slots: {inject: (_name, register) => register(), register: (_options, Component) => { Usage = Component; }},
  });
  const directory = {subscribe() {}, getSnapshot: () => ({current: {provider: 'deepseek-official', model: 'deepseek-chat'}})};
  const expand = node => node == null || node === false ? null : Array.isArray(node) ? node.map(expand)
    : typeof node !== 'object' ? node : typeof node.type === 'function' ? expand(node.type(node.props))
    : {...node, props: {...node.props, children: expand(node.props.children)}};
  const text = node => node == null ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props.children) : String(node);
  const rows = node => node == null || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(rows)
    : node.props.className === 'dshUsageDetailRow' ? [text(node)] : rows(node.props.children);
  const render = () => expand(Usage({controller: {store: directory}}));
  assert.equal(logic.usageKind('deepseek-official'), 'deepseek-api');
  const missing = rows(render());
  assert.equal(missing.some(row => /^(total|recharge|bonus) /.test(row)), false);
  assert.equal(missing.some(row => /apiAvailability|apiAvailable|apiUnavailable/.test(row)), false);
  assert.equal(text(render().props.children[1]), 'empty');
  await requests[0](undefined, {force: true});
  assert.equal(requests[1].kind, 'deepseek-api'); assert.equal(requests[1].provider, 'deepseek-official');
  assert.equal(requests[1].client, undefined);
  snapshot = {status: 'ready', value: {totals: [{currency: 'CNY', amount: '0'}], recharge: [], bonus: [{currency: 'USD', amount: '0.00'}]}};
  const zero = rows(render());
  assert.ok(zero.some(row => /total.*¥0\.00/.test(row)));
  assert.ok(zero.some(row => /bonus.*\$0\.00/.test(row)));
  assert.equal(zero.some(row => /^recharge /.test(row)), false);
  for (const [code, message] of [['usage/auth-required', 'apiKeyRejected'], ['usage/configuration', 'apiConfiguration'], ['usage/unavailable', 'apiQueryFailed']]) {
    hostResult = {ok: false, error: {code, message: 'untrusted detail'}};
    await assert.rejects(requests[0](undefined, {}), error => error.message === message);
  }
  const apiSummary = render().props.children[1].props.children[0].props.children[0];
  assert.equal(apiSummary.props.title, 'apiBalance');
  snapshot = {status: 'ready', value: {totals: [], recharge: [], bonus: [{currency: 'USD', amount: '2'}]}};
  assert.match(text(render().props.children[1]), /bonus.*\$2\.00/);
  assert.equal(rows(render()).some(row => /^total /.test(row)), false);
});
