import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply, createUsageHost} from '../index.js';
import {CODEX_USAGE_URL, CODEX_RESET_CARDS_URL, CODEX_CONSUME_RESET_CARD_URL, parseCodexResetCards} from '../host-codex.js';

const provider = `codex-sub-${'a'.repeat(32)}`;
const otherProvider = `codex-sub-${'b'.repeat(32)}`;
const key = `codex-subscribe/account-${'a'.repeat(32)}`;
const otherKey = `codex-subscribe/account-${'b'.repeat(32)}`;
const list = 'usage/codex-reset-cards';
const use = `${list}/use`;
const creditId = 'RateLimitResetCredit_fixture';
const requestId = '3e57b80b-5938-4325-86e5-f02e50148386';
const now = Date.parse('2026-06-13T00:00:00Z');
const credit = {id: creditId, status: 'available', reset_type: 'codex_rate_limits',
  title: ' Full reset ', description: ' Reset usage. ', expires_at: '2026-07-12T03:57:42.677034Z', profile_user_id: 'raw-payload'};
const record = (accountId, access) => ({kind: 'grant', payload: {version: 2, label: 'fixture',
  credential: {type: 'oauth', access, refresh: 'private-refresh', expires: now + 10_000, accountId}}});
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };

function fixture(t, upstream) {
  const calls = [], records = new Map([[key, record('private-account', 'private-access')],
    [otherKey, record('private-other-account', 'private-other-access')]]);
  const enabled = new Set([provider, otherProvider]);
  const beforeLock = {hook: undefined};
  const credentials = {
    listRecords: async () => [...records.keys()].map(key => ({key, kind: 'grant'})),
    readRecord: async key => structuredClone(records.get(key)),
    async modifyRecord(key, update) {
      await beforeLock.hook?.();
      const next = await update(structuredClone(records.get(key)));
      if (next !== undefined) records.set(key, next);
      return structuredClone(records.get(key));
    },
  };
  const host = createUsageHost({credentials, get: name => name === 'llm' && {listProviders: () => [...enabled].map(id => ({id}))}}, {
    now: () => now,
    authFactory: store => ({getAuth: async () => ({auth: {apiKey: (await store.read('openai-codex'))?.access}})}),
    fetch: async (url, options) => {
      calls.push({url, options});
      if (url === CODEX_USAGE_URL) return Response.json({});
      if (url === CODEX_RESET_CARDS_URL) return Response.json({credits: [credit]});
      assert.equal(url, CODEX_CONSUME_RESET_CARD_URL);
      return upstream ? upstream(url, options) : Response.json({code: 'reset', credit: {id: 'raw-credit'}});
    },
  });
  t.after(() => host.dispose());
  return {host, calls, records, enabled, beforeLock};
}

async function selection(host) {
  const response = await host.dispatch(list, {provider});
  assert.equal(response.ok, true);
  return {provider, creditId, requestId, accountRevision: response.value.accountRevision};
}

test('Codex reset list projects only usable cards, sorts by expiration, and preserves nullable expiry', () => {
  const ready = {...credit, id: 'without-expiry', expires_at: null, title: null, description: undefined};
  assert.deepEqual(parseCodexResetCards({credits: [ready, credit, {...credit, id: 'expired', expires_at: '2026-06-12T20:00:00Z'},
    {...credit, id: 'redeemed', status: 'redeemed'}, {...credit, id: 'redeeming', status: 'redeeming'},
    {...credit, id: 'wrong-type', reset_type: 'other'}, credit]}, now), [
    {id: creditId, title: 'Full reset', description: 'Reset usage.', expiresAt: Date.parse(credit.expires_at)},
    {id: 'without-expiry', title: '', description: '', expiresAt: null},
  ]);
  assert.throws(() => parseCodexResetCards({credits: [{...credit, expires_at: 'synthetic-secret'}]}, now), /temporarily unavailable/);
  assert.throws(() => parseCodexResetCards({available_count: 1}, now), /temporarily unavailable/);
});

test('scoped reset list cache isolates subscriptions and revision survives same-account credential rotation', async t => {
  const {host, calls, records} = fixture(t);
  const first = await host.dispatch(list, {provider});
  assert.equal(first.ok, true);
  assert.match(first.value.accountRevision, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(first), /private-|raw-payload/);
  await host.dispatch(list, {provider});
  await host.dispatch(list, {provider, force: true});
  assert.equal(calls.length, 2);
  for (const {url, options} of calls) {
    assert.equal(url, CODEX_RESET_CARDS_URL);
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.authorization, 'Bearer private-access');
    assert.equal(options.headers['chatgpt-account-id'], 'private-account');
  }
  const other = await host.dispatch(list, {provider: otherProvider});
  assert.notEqual(other.value.accountRevision, first.value.accountRevision);
  assert.equal(calls.at(-1).options.headers.authorization, 'Bearer private-other-access');
  records.set(key, record('private-account', 'rotated-token'));
  const rotated = await host.dispatch(list, {provider});
  assert.equal(rotated.value.accountRevision, first.value.accountRevision);
  assert.equal(calls.at(-1).options.headers.authorization, 'Bearer rotated-token');
  assert.deepEqual(await host.dispatch(use, {provider, creditId, requestId, accountRevision: first.value.accountRevision}),
    {ok: true, value: {code: 'reset'}});
  assert.equal(calls.at(-1).options.headers.authorization, 'Bearer rotated-token');
});

test('consume sends exact credit/UUID, reuses UUID after an ambiguous error and invalidates both caches', async t => {
  let attempts = 0;
  const {host, calls} = fixture(t, async () => {
    if (++attempts === 1) throw new Error('private-network-detail');
    return Response.json({code: 'already_redeemed', windows_reset: 2, credit: {secret: 'private-raw'}});
  });
  const input = await selection(host), read = {kind: 'codex', provider};
  await host.dispatch('usage/read', read);
  const ambiguous = await host.dispatch(use, input);
  assert.equal(ambiguous.error.code, 'usage/unavailable');
  assert.doesNotMatch(JSON.stringify(ambiguous), /private-network-detail/);
  await host.dispatch(list, {provider});
  await host.dispatch('usage/read', read);
  assert.deepEqual(await host.dispatch(use, input), {ok: true, value: {code: 'already_redeemed'}});
  await host.dispatch(list, {provider});
  await host.dispatch('usage/read', read);
  assert.deepEqual(calls.map(x => x.url), [CODEX_RESET_CARDS_URL, CODEX_USAGE_URL, CODEX_CONSUME_RESET_CARD_URL,
    CODEX_RESET_CARDS_URL, CODEX_USAGE_URL, CODEX_CONSUME_RESET_CARD_URL, CODEX_RESET_CARDS_URL, CODEX_USAGE_URL]);
  for (const {options} of calls.filter(x => x.url === CODEX_CONSUME_RESET_CARD_URL)) {
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.authorization, 'Bearer private-access');
    assert.equal(options.headers['chatgpt-account-id'], 'private-account');
    assert.equal(options.headers['content-type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), {redeem_request_id: requestId, credit_id: creditId});
  }
});

test('known non-success outcomes stay distinct; unrecognized response codes are safe errors', async t => {
  const codes = ['nothing_to_reset', 'no_credit', 'private-unknown-code'];
  const {host} = fixture(t, () => Response.json({code: codes.shift(), raw: 'private-response'}));
  const input = await selection(host);
  for (const code of ['nothing_to_reset', 'no_credit'])
    assert.deepEqual(await host.dispatch(use, input), {ok: true, value: {code}});
  const unknown = await host.dispatch(use, input);
  assert.equal(unknown.error.code, 'usage/unavailable');
  assert.doesNotMatch(JSON.stringify(unknown), /private-/);
});

test('foreign revisions, disabled providers, and credential replacement before network do not consume', async t => {
  const {host, calls, records, enabled, beforeLock} = fixture(t);
  const input = await selection(host);
  assert.equal((await host.dispatch(use, {...input, provider: otherProvider})).error.code, 'usage/identity-changed');
  enabled.delete(provider);
  assert.equal((await host.dispatch(use, input)).error.code, 'usage/identity-changed');
  enabled.add(provider);
  beforeLock.hook = () => { records.set(key, record('private-replacement', 'private-replacement-token')); };
  assert.equal((await host.dispatch(use, input)).error.code, 'usage/identity-changed');
  assert.equal((await host.dispatch(use, input)).error.code, 'usage/identity-changed');
  assert.deepEqual(calls.map(x => x.url), [CODEX_RESET_CARDS_URL]);
});

test('concurrent retry shares upstream, caller disconnect does not cancel dispatch, sign-out hides late result', async t => {
  const gate = deferred(), started = deferred();
  const {host, records, calls} = fixture(t, async (_url, options) => {
    started.resolve(options.signal);
    await gate.promise;
    return Response.json({code: 'reset'});
  });
  const input = await selection(host), caller = new AbortController();
  const first = host.dispatch(use, input, caller.signal);
  const upstreamSignal = await started.promise;
  caller.abort();
  assert.equal((await first).error.code, 'usage/cancelled');
  assert.equal(upstreamSignal.aborted, false);
  const retry = host.dispatch(use, input);
  assert.equal((await host.dispatch(use, {...input, creditId: 'some-other-credit'})).error.code, 'usage/unavailable');
  records.delete(key);
  gate.resolve();
  assert.equal((await retry).error.code, 'usage/identity-changed');
  assert.equal(calls.filter(x => x.url === CODEX_CONSUME_RESET_CARD_URL).length, 1);
});

test('Connection registers independent exact POST routes, rejecting simple/cross-site consume and malformed inputs', async t => {
  const routes = new Map(), cleanups = [];
  const ctx = {credentials: {}, get: () => undefined, effect: run => cleanups.push(run()),
    connection: {fetch: {register(route) { routes.set(route.path, route); return () => routes.delete(route.path); }}}};
  apply(ctx);
  t.after(() => cleanups.forEach(cleanup => cleanup()));
  for (const endpoint of [list, use, 'usage/read']) {
    const route = routes.get(`/api/plugins/${endpoint}`);
    assert.deepEqual(route.methods, ['POST']);
    assert.equal(route.requestBody, 'buffered');
  }
  const route = routes.get(`/api/plugins/${use}`);
  const base = {provider, creditId, requestId, accountRevision: 'a'.repeat(64)};
  const post = (body, headers) => route.fetch(new Request(`http://127.0.0.1${route.path}`, {method: 'POST',
    headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)}));
  assert.equal((await post(base, {'Content-Type': 'text/plain'})).status, 415);
  assert.equal((await post(base, {'Sec-Fetch-Site': 'cross-site'})).status, 403);
  assert.equal((await post(base, {'Sec-Fetch-Site': 'same-site'})).status, 403);
  for (const body of [{...base, force: true}, {...base, creditId: ''}, {...base, creditId: `${creditId}\n`},
    {...base, creditId: null}, {...base, requestId: 'not-a-uuid'}, {...base, requestId: `${requestId}\n`},
    {...base, accountRevision: 'plaintext'}, {...base, provider: `${provider}\n`}]) {
    const response = await post(body);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).error.code, 'usage/invalid-request');
  }
  const listRoute = routes.get(`/api/plugins/${list}`);
  const response = await listRoute.fetch(new Request(`http://127.0.0.1${listRoute.path}`, {method: 'POST',
    body: JSON.stringify({provider, force: 'true'})}));
  assert.equal((await response.json()).error.code, 'usage/invalid-request');
});
