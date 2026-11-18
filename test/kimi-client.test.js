import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as logic from '../logic.js';
import {createUsageHost, validateUsageRequest} from '../index.js';

test('Kimi RPC accepts only the exact provider and no client-controlled secrets or endpoints', async t => {
  const host = createUsageHost({get() {}}); t.after(() => host.dispose());
  const request = {kind: 'kimi-coding', provider: 'kimi-coding'};
  assert.equal(validateUsageRequest(request), request);
  for (const extra of [{provider: 'moonshotai'}, {provider: 'deepseek-official'}, {apiKey: 'secret'}, {url: 'https://evil.test'}, {client: {}}]) {
    assert.equal((await host.dispatch('usage/read', {...request, ...extra})).error.code, 'usage/invalid-request');
  }
  assert.throws(() => validateUsageRequest(request, true));
  assert.equal(logic.usageKind('kimi-coding'), 'kimi-coding');
  assert.equal(logic.usageKind('moonshotai'), null);
  assert.equal(logic.usageProviderTitle('kimi-coding'), 'Kimi Coding');
  assert.equal(logic.windowLabel(1800), '30m');
  assert.equal(logic.windowLabel(90), '90s');
  const configured = createUsageHost({get() {}, credentials: {resolve: async ref => {
    assert.equal(ref, 'KIMI_API_KEY'); return {value: 'secret'};
  }}}, {fetch: async url => {
    assert.equal(url, 'https://api.kimi.com/coding/v1/usages');
    return Response.json({usage: {limit: '100', remaining: '0'}});
  }});
  t.after(() => configured.dispose());
  const result = await configured.dispatch('usage/read', request);
  assert.equal(result.ok, true);
  assert.equal(result.value.windows[0].remainingPercent, 0);
  assert.doesNotMatch(JSON.stringify(result), /secret/);
});

test('Kimi client renders remaining quota, reset details, compact mode and localized failures', async () => {
  const source = await readFile(new URL('../client.source.js', import.meta.url), 'utf8');
  let plugin, Usage, mode = 'detailed', request, body;
  let snapshot = {status: 'ready', value: {windows: [
    {windowSeconds: 18000, remainingPercent: 0, resetsAt: 2000000000},
    {windowSeconds: 604800, remainingPercent: 74, resetsAt: null},
  ], updatedAt: 1900000000000}};
  let result = {ok: true, value: {}};
  const React = {
    Fragment: 'fragment', createElement: (type, props, ...children) => ({type, props: {...props, children}}),
    useSyncExternalStore: (_subscribe, get) => get(),
    useState: initial => [initial === false ? true : typeof initial === 'function' ? initial() : initial, () => {}],
    useRef: current => ({current}), useId: () => 'kimi-usage',
    useEffect() {}, useLayoutEffect() {}, useCallback: fn => fn,
  };
  const locale = {register() {}, bind: () => key => key, getSnapshot: () => ({active: 'en'}), subscribe() {}};
  vm.runInNewContext(source, {...logic,
    createUsageStore: fn => { request = fn; return {subscribe() {}, getSnapshot: () => snapshot}; },
    fetch: async (_url, options) => { body = JSON.parse(options.body); return {ok: true, json: async () => result}; },
    window: {__ModuleLoader__: {load: value => { plugin = value; }}}, document: {}, console,
  });
  plugin.factory(name => name === 'react' ? React : {createPortal: node => node}).apply({
    locale, get: name => ({locale, configForms: {get: () => ({subscribe() {}, getSnapshot: () => ({value: {performanceUsage: mode}})})}})[name],
    effect() {}, on() {}, slots: {inject: (_name, fn) => fn(), register: (_options, Component) => { Usage = Component; }},
  });
  const directory = {getSnapshot: () => ({current: {provider: 'kimi-coding', model: 'kimi-for-coding'}})};
  const expand = node => node == null || node === false ? null : Array.isArray(node) ? node.map(expand)
    : typeof node !== 'object' ? node : typeof node.type === 'function' ? expand(node.type(node.props))
    : {...node, props: {...node.props, children: expand(node.props.children)}};
  const text = node => node == null ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props.children) : String(node);
  const render = () => expand(Usage({controller: {store: directory}}));
  assert.match(text(render().props.children[1]), /5h 0%.*7day 74%/);
  mode = 'compact';
  assert.doesNotMatch(text(render().props.children[1]), /7day/);
  assert.match(text(render()), /fiveHour.*remainingValue.*sevenDay/);
  await request(undefined, {force: true});
  assert.equal(body.kind, 'kimi-coding'); assert.equal(body.provider, 'kimi-coding');
  assert.equal(body.client, undefined); assert.equal(body.force, true);
  for (const [code, message] of [['usage/auth-required', 'apiKeyRejected'], ['usage/configuration', 'kimiConfiguration'], ['usage/unavailable', 'kimiQueryFailed']]) {
    result = {ok: false, error: {code, message: 'secret'}};
    await assert.rejects(request(undefined, {}), error => error.message === message);
  }
  for (const [value, expected] of [[{windows: []}, 'empty'], [{unconfigured: true}, 'keyRequired'], [{unsupported: true}, 'kimiUnsupported']]) {
    snapshot = {status: 'ready', value}; assert.match(text(render()), new RegExp(expected));
  }
});
