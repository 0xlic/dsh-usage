import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as logic from '../logic.js';

test('live performance preference hides only weekly dock quotas, never popover details', async () => {
  const source = await readFile(new URL('../client.source.js', import.meta.url), 'utf8');
  let plugin, Usage, mode, settingsListener;
  const subscriptions = [];
  const quota = seconds => ({ windowSeconds: seconds, remainingPercent: 80, resetsAt: 2000000000 });
  const snapshot = { status: 'ready', value: { rows: [{
    id: 'account', label: 'Account', usage: { rateLimits: [{ id: 'codex', windows: [quota(18000), quota(604800)] }] },
  }] } };
  const React = {
    Fragment: 'fragment',
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useSyncExternalStore: (subscribe, get) => { subscriptions.push(subscribe); return get(); },
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useRef: current => ({ current }), useId: () => 'usage',
    useEffect() {}, useLayoutEffect() {}, useCallback: fn => fn,
  };
  const settings = {
    subscribe: listener => { settingsListener = listener; return () => { settingsListener = null; }; },
    getSnapshot: () => ({ value: mode === undefined ? undefined : { performanceUsage: mode } }),
  };
  const locale = { register() {}, bind: () => key => key, subscribe() {}, getSnapshot: () => ({ active: 'en' }) };
  const directory = { subscribe() {}, getSnapshot: () => ({ current: { provider: `codex-sub-${'a'.repeat(32)}`, model: 'gpt-5' } }) };
  const services = { locale, configForms: { get: id => { assert.equal(id, 'ui-chat'); return settings; } } };
  vm.runInNewContext(source, {
    ...logic,
    createUsageStore: () => ({ subscribe() {}, getSnapshot: () => snapshot }),
    window: { __ModuleLoader__: { load: value => { plugin = value; } } },
    document: {}, console,
  });
  const client = plugin.factory(name => name === 'react' ? React : { createPortal: value => value });
  client.apply({
    locale, get: id => services[id], effect() {}, on() {},
    slots: { inject: (_name, register) => register(), register: (_options, Component) => { Usage = Component; } },
  });
  const text = node => node == null || node === false ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props.children) : String(node);
  const render = () => {
    const value = Usage({ directory });
    return value.type(value.props);
  };
  const summary = () => text(render().props.children[1]);
  assert.match(summary(), /5h 80%.*7day 80%/); // unset retains the detailed default
  const unsubscribe = subscriptions.at(-2)(() => {}); // preference source, before the usage source
  assert.equal(typeof settingsListener, 'function');
  mode = 'compact';
  settingsListener();
  assert.match(summary(), /5h 80%/);
  assert.doesNotMatch(summary(), /7day/);

  // Render the actual popover component using the same compact preference.
  const originalState = React.useState;
  let call = 0;
  React.useState = initial => ++call === 3 ? [true, () => {}] : originalState(initial);
  const opened = render();
  const detailsElement = opened.props.children[2].props.children[1];
  const details = text(detailsElement.type(detailsElement.props));
  assert.match(details, /fiveHour/);
  assert.match(details, /sevenDay/);
  React.useState = originalState;
  mode = 'detailed';
  settingsListener();
  assert.match(summary(), /5h 80%.*7day 80%/);
  unsubscribe();
});
