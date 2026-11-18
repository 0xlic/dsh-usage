import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KimiUsageAdapter, kimiRoute, parseKimiUsage} from '../host-kimi.js';
import {HostUsageCache} from '../host-cache.js';

const URL = 'https://api.kimi.com/coding/v1/usages';
const route = () => ({url: URL, keyRef: 'KIMI_API_KEY'});
const hasCode = code => error => error.code === code;
const iso = '2026-11-14T02:00:00.000Z';
const reset = Date.parse(iso) / 1000;
const payload = (remaining = '74') => ({usage: {limit: '100', remaining, resetTime: iso}, limits: [
  {window: {duration: 300, timeUnit: 'TIME_UNIT_MINUTE'}, detail: {limit: '100', remaining: '85', resetTime: iso}},
]});
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; };
function context({directory, rows = [], environment = {get: () => undefined}} = {}) {
  return {get: name => ({llm: directory && {listConfigurableProviders: () => directory},
    settings: {describe: () => rows}, launchEnvironment: environment})[name]};
}
function fallback(config, ns = 'llm-pi-ai') {
  return context({rows: [{ns, value: {providers: {'kimi-coding': config}}}]});
}
function fixture(t, options = {}) {
  const cache = new HostUsageCache(options);
  const credentials = {token: 'kimi-secret', async resolve(ref) {
    assert.equal(ref, 'KIMI_API_KEY');
    return this.token === undefined ? undefined : {value: this.token};
  }};
  const adapter = new KimiUsageAdapter({cache, credentials, route,
    fetch: async () => Response.json(payload()), ...options});
  t.after(() => { adapter.dispose(); cache.dispose(); });
  return {cache, credentials, adapter};
}

test('Kimi route follows live directory namespace/settingsPath and provider metadata', () => {
  const config = {apiKeyEnv: 'CUSTOM_KIMI_KEY'};
  const reads = [];
  const directory = [{provider: 'unrelated', settingsNs: 'wrong'}, {provider: 'kimi-coding', settingsNs: 'owner',
    settingsPath: ['providers', 'kimi-coding'], baseURLEnv: 'CUSTOM_KIMI_URL', defaultBaseURL: 'https://api.kimi.ai/coding'}];
  const rows = [{ns: 'llm-pi-ai', value: {providers: {'kimi-coding': {baseURL: 'https://evil.test'}}}},
    {ns: 'owner', value: {providers: {'kimi-coding': config}}}];
  const ctx = context({directory, rows, environment: {get: name => { reads.push(name); return undefined; }}});
  assert.deepEqual(kimiRoute(ctx), {url: 'https://api.kimi.ai/coding/v1/usages', keyRef: 'CUSTOM_KIMI_KEY'});
  assert.deepEqual(reads, ['CUSTOM_KIMI_URL']);
  config.baseURL = 'https://api.kimi.com/coding/'; config.apiKeyEnv = 'ROTATED_KEY';
  assert.deepEqual(kimiRoute(ctx), {url: URL, keyRef: 'ROTATED_KEY'});
  assert.equal(reads.length, 1, 'explicit baseURL bypasses environment');
  assert.throws(() => kimiRoute(context({directory})), hasCode('usage/configuration'));
});

test('Kimi route supports only pi-ai provider fallback namespaces and default key', () => {
  for (const ns of ['llm-pi-ai', 'include:llm-pi-ai']) {
    assert.deepEqual(kimiRoute(fallback({}, ns)), route());
    assert.deepEqual(kimiRoute(fallback({apiKeyEnv: '_KIMI_1'}, ns)), {url: URL, keyRef: '_KIMI_1'});
  }
  assert.deepEqual(kimiRoute(context()), route());
  assert.deepEqual(kimiRoute(context({rows: [{ns: 'other', value: {providers: {'kimi-coding': {baseURL: 'https://evil.test'}}}}]})), route());
});

test('Kimi directory baseURLEnv uses launch environment authoritatively, process only when absent', () => {
  const previous = process.env.TEST_KIMI_BASE_URL;
  const options = {directory: [{provider: 'kimi-coding', settingsNs: 'owner', baseURLEnv: 'TEST_KIMI_BASE_URL'}],
    rows: [{ns: 'owner', value: {}}]};
  try {
    process.env.TEST_KIMI_BASE_URL = 'https://evil.test';
    assert.deepEqual(kimiRoute(context(options)), route());
    assert.deepEqual(kimiRoute(context({...options, environment: null})), {unsupported: true});
    assert.deepEqual(kimiRoute(context({...options, environment: {get: () => ({value: 'https://api.kimi.ai/coding/v1/'})}})),
      {url: 'https://api.kimi.ai/coding/v1/usages', keyRef: 'KIMI_API_KEY'});
  } finally {
    if (previous === undefined) delete process.env.TEST_KIMI_BASE_URL;
    else process.env.TEST_KIMI_BASE_URL = previous;
  }
});

test('Kimi endpoints are strictly official HTTPS coding paths, fixed to same-origin usages', () => {
  for (const host of ['api.kimi.com', 'api.kimi.ai']) for (const path of ['/coding', '/coding/', '/coding/v1', '/coding/v1/']) {
    assert.deepEqual(kimiRoute(fallback({baseURL: `https://${host}${path}`})),
      {url: `https://${host}/coding/v1/usages`, keyRef: 'KIMI_API_KEY'});
  }
  for (const baseURL of ['http://api.kimi.com/coding', 'https://evil.test/coding', 'https://api.kimi.com.evil.test/coding',
    'https://sub.api.kimi.com/coding', 'https://api.kimi.com:444/coding', 'https://api.kimi.com:443/coding',
    'https://user@api.kimi.com/coding', 'https://user:secret@api.kimi.com/coding', 'https://@api.kimi.com/coding',
    'https://api.kimi.com/coding?key=secret', 'https://api.kimi.com/coding?', 'https://api.kimi.com/coding#',
    'https://api.kimi.com', 'https://api.kimi.com/v1', 'https://api.kimi.com/coding/v2',
    'https://api.kimi.com/coding/v1/usages', 'https://api.kimi.com/proxy/../coding',
    'https://api.kimi.com/%63oding', 'https://api.kimi.com/coding//', ' https://api.kimi.com/coding',
    'https://api.kimi.com/coding\n', 'https://api.kimi.com\\coding', 'not a url', '', 42, {}]) {
    assert.deepEqual(kimiRoute(fallback({baseURL, apiKeyEnv: 'invalid key'})), {unsupported: true}, String(baseURL));
  }
  for (const apiKeyEnv of ['', '1KEY', 'A-B', 'A B', 'KEY\n', 42, {}])
    assert.throws(() => kimiRoute(fallback({apiKeyEnv})), hasCode('usage/configuration'));
});

test('Kimi parser projects seven-day usage and five-hour limit, without identity/totalQuota/booster', () => {
  const result = parseKimiUsage({...payload(), user: {email: 'secret@example.test'}, apiKey: 'kimi-secret',
    totalQuota: {limit: '1000', remaining: '500'}, booster: {remaining: '99'}});
  assert.deepEqual(result, {windows: [
    {remainingPercent: 85, windowSeconds: 18000, resetsAt: reset},
    {remainingPercent: 74, windowSeconds: 604800, resetsAt: reset},
  ]});
  assert.doesNotMatch(JSON.stringify(result), /secret|email|apiKey|totalQuota|booster/);
  assert.deepEqual(parseKimiUsage({}), {windows: []});
  assert.deepEqual(parseKimiUsage({totalQuota: {limit: '100', remaining: '50'}}), {windows: []});
});

test('Kimi parser handles explicit time units and preserves true zero without fabricating missing values', () => {
  for (const [unit, seconds] of [['SECOND', 1], ['MINUTE', 60], ['HOUR', 3600], ['DAY', 86400], ['WEEK', 604800]]) {
    assert.deepEqual(parseKimiUsage({limits: [{window: {duration: '2', timeUnit: `TIME_UNIT_${unit}`},
      detail: {limit: 100, remaining: 0}}]}), {windows: [{remainingPercent: 0, windowSeconds: 2 * seconds, resetsAt: null}]});
  }
  assert.deepEqual(parseKimiUsage({usage: {limit: '0.5', remaining: '0.125'}}),
    {windows: [{remainingPercent: 25, windowSeconds: 604800, resetsAt: null}]});
  for (const resetTime of [undefined, null, 123, '', 'garbage', '2026-11-14', '0', '2026-99-99T02:00:00Z', '2026-02-30T02:00:00Z', '2026-11-14T24:00:00Z']) {
    assert.equal(parseKimiUsage({usage: {limit: '100', remaining: '100', resetTime}}).windows[0].resetsAt, null);
  }
  assert.equal(parseKimiUsage({usage: {limit: '100', remaining: '100', resetTime: '2026-11-14T10:00:00+08:00'}}).windows[0].resetsAt, reset);
});

test('Kimi parser ignores malformed/missing fields and unsafe numeric coercions', () => {
  for (const invalid of [undefined, null, false, true, {}, [], NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1,
    '', ' ', '1\n', 'NaN', 'Infinity', '1e2', '+1', '-1', '.5', '1.', '0x10', '9007199254740991.1', '1'.repeat(129)]) {
    assert.deepEqual(parseKimiUsage({usage: {limit: '100', remaining: invalid}}), {windows: []});
    assert.deepEqual(parseKimiUsage({usage: {limit: invalid, remaining: '0'}}), {windows: []});
  }
  for (const usage of [null, [], false, {}, {remaining: 1}, {limit: 1}, {limit: 0, remaining: 0}, {limit: 1, remaining: 2}])
    assert.deepEqual(parseKimiUsage({usage}), {windows: []});
  for (const window of [undefined, null, [], {}, {duration: 300}, {timeUnit: 'TIME_UNIT_MINUTE'},
    {duration: 0, timeUnit: 'TIME_UNIT_MINUTE'}, {duration: 300, timeUnit: 'MINUTE'},
    {duration: 300, timeUnit: 'TIME_UNIT_MONTH'}, {duration: Number.MAX_SAFE_INTEGER, timeUnit: 'TIME_UNIT_WEEK'}]) {
    assert.deepEqual(parseKimiUsage({limits: [{window, detail: {limit: '100', remaining: '50'}}]}), {windows: []});
  }
  assert.deepEqual(parseKimiUsage({limits: [null, {}, [], false, {window: {duration: 1, timeUnit: 'TIME_UNIT_SECOND'}, detail: {}}]}), {windows: []});
  assert.deepEqual(parseKimiUsage({limits: 'unknown'}), {windows: []});
});

test('Kimi parser rejects error/non-object envelopes and bounds limit array length', () => {
  for (const value of [undefined, null, [], 'usage', 0, {error: {message: 'secret'}}, {errors: ['secret']},
    {success: false}, {code: 401}, {code: 'unauthorized'}, {...payload(), error: 'secret'}, {limits: Array(101).fill({})}])
    assert.throws(() => parseKimiUsage(value), error => error.code === 'usage/unavailable' && !error.message.includes('secret'));
  assert.deepEqual(parseKimiUsage({code: 0, limits: Array(100).fill({})}), {windows: []});
});

test('Kimi adapter coalesces reads, clones cache values, respects TTL/force and sends safe GET Bearer request', async t => {
  let now = 100, calls = 0;
  const {adapter, cache} = fixture(t, {now: () => now, ttlMs: 60, fetch: async (url, options) => {
    calls++; assert.equal(url, URL);
    assert.deepEqual(options.headers, {Authorization: 'Bearer kimi-secret', Accept: 'application/json'});
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    assert.equal(options.signal.aborted, false);
    return Response.json({...payload('0'), api_key: 'upstream-secret'});
  }});
  const [a, b] = await Promise.all([adapter.read(), adapter.read({force: true})]);
  assert.equal(calls, 1); assert.equal(a.updatedAt, 100);
  a.windows[1].remainingPercent = 999; assert.equal(b.windows[1].remainingPercent, 0);
  assert.equal((await adapter.read()).windows[1].remainingPercent, 0); assert.equal(calls, 1);
  now = 161; await adapter.read(); assert.equal(calls, 2);
  await adapter.read({force: true}); assert.equal(calls, 3);
  assert.match(cache.entries.get('kimi-coding').identity, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(b), /kimi-secret|upstream-secret|api_key/);
});

test('Kimi adapter rotates keys and discards cached data when credentials disappear', async t => {
  let calls = 0;
  const {adapter, credentials, cache} = fixture(t, {fetch: async () => Response.json(payload(String(++calls)))});
  assert.equal((await adapter.read()).windows[1].remainingPercent, 1);
  credentials.token = 'next-secret';
  assert.equal((await adapter.read()).windows[1].remainingPercent, 2);
  credentials.token = undefined;
  assert.deepEqual(await adapter.read(), {unconfigured: true});
  assert.equal(cache.entries.has('kimi-coding'), false);
  credentials.token = 'next-secret'; await adapter.read(); assert.equal(calls, 3);
});

for (const change of ['rotate', 'remove', 'route']) test(`Kimi adapter rejects stale in-flight responses after ${change}`, async t => {
  const started = deferred(), gate = deferred();
  const {adapter, credentials} = fixture(t, {fetch: async () => { started.resolve(); await gate.promise; return Response.json(payload()); }});
  const rejected = assert.rejects(adapter.read(), hasCode('usage/identity-changed'));
  await started.promise;
  if (change === 'route') adapter.route = () => ({unsupported: true});
  else credentials.token = change === 'rotate' ? 'next-secret' : undefined;
  gate.resolve(); await rejected;
});

test('Kimi unsupported route skips credentials/fetch, clears prior data, and missing credentials are unconfigured', async t => {
  const {adapter, cache} = fixture(t);
  await adapter.read();
  adapter.route = () => ({unsupported: true});
  adapter.credentials.resolve = () => { assert.fail('unsupported must not read credentials'); };
  adapter.fetch = () => { assert.fail('unsupported must not fetch'); };
  assert.deepEqual(await adapter.read(), {unsupported: true});
  assert.equal(cache.entries.has('kimi-coding'), false);
  adapter.route = route; adapter.credentials = undefined;
  assert.deepEqual(await adapter.read(), {unconfigured: true});
});

test('Kimi adapter rejects malformed credentials before network access', async t => {
  const {adapter, credentials} = fixture(t, {fetch: () => assert.fail('must not fetch')});
  for (const token of ['', null, 42, {}, 'a b', 'a\nb', '密钥', 'a\x7fb']) {
    credentials.token = token;
    await assert.rejects(adapter.read(), hasCode('usage/auth-required'));
  }
});

for (const status of [401, 403, 404, 429, 500]) test(`Kimi HTTP ${status} errors are sanitized and cooldown survives force`, async t => {
  let now = 0, calls = 0;
  const {adapter} = fixture(t, {now: () => now, cooldownMs: 5,
    fetch: async () => { calls++; return new Response('kimi-secret upstream detail', {status}); }});
  const check = error => error.code === ([401, 403].includes(status) ? 'usage/auth-required' : 'usage/unavailable')
    && !/kimi-secret|upstream detail/.test(error.message);
  await assert.rejects(adapter.read(), check);
  await assert.rejects(adapter.read({force: true}), check); assert.equal(calls, 1);
  now = 6; await assert.rejects(adapter.read({force: true}), check); assert.equal(calls, 2);
});

test('Kimi network/JSON/error-envelope failures never expose upstream secrets', async t => {
  for (const fetch of [async () => { throw new Error('kimi-secret network'); },
    async () => ({ok: true, json: async () => { throw new Error('kimi-secret JSON'); }}),
    async () => Response.json({error: {message: 'kimi-secret'}})]) {
    const {adapter} = fixture(t, {fetch});
    await assert.rejects(adapter.read(), error => error.code === 'usage/unavailable' && !error.message.includes('kimi-secret'));
  }
});

test('Kimi credential backend failures are sanitized before reaching the caller', async t => {
  const {adapter} = fixture(t);
  adapter.credentials.resolve = async () => { throw new Error('kimi-secret credential backend'); };
  await assert.rejects(adapter.read(), error => error.code === 'usage/unavailable'
    && !/kimi-secret|credential backend/.test(error.message));
});

test('Kimi cache timeout bounds a fetch that ignores abort', async t => {
  const gate = deferred();
  const {adapter} = fixture(t, {timeoutMs: 10, fetch: async () => { await gate.promise; return Response.json(payload()); }});
  // AbortSignal.timeout is unref'ed; keep this test alive without polling.
  const keeper = setTimeout(() => {}, 1000);
  try { await assert.rejects(adapter.read(), hasCode('usage/cancelled')); }
  finally { clearTimeout(keeper); gate.resolve(); }
});

test('Kimi dispose aborts pending request and rejects future reads including unconfigured', async t => {
  const started = deferred(), gate = deferred(); let signal;
  const {adapter, credentials} = fixture(t, {fetch: async (_url, options) => {
    signal = options.signal; started.resolve(); await gate.promise; return Response.json(payload());
  }});
  const rejected = assert.rejects(adapter.read(), hasCode('usage/cancelled'));
  await started.promise; adapter.dispose(); assert.equal(signal.aborted, true);
  await rejected; gate.resolve();
  credentials.token = undefined;
  await assert.rejects(adapter.read(), hasCode('usage/cancelled'));
});
