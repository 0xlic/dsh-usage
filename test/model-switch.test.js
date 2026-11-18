import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as logic from '../logic.js';

const a = `codex-sub-${'a'.repeat(32)}`, b = `codex-sub-${'b'.repeat(32)}`;
const groups = [a, b].map((id, i) => ({ id, name: `Codex-${i}`, models: [{ id: 'other-model', name: 'Other model' }, { id: 'gpt-5', name: 'GPT 5' }] }));

test('preview cycles accounts once each while preserving the current model, excluding non-Codex catalogs', () => {
  const choices = logic.codexModelChoices([...groups, { id: 'capinfo', models: [{ id: 'other' }] }], 'gpt-5');
  assert.equal(choices.length, 2);
  const original = { provider: a, model: 'gpt-5' };
  const next = logic.nextUsageModel(choices, original);
  assert.equal(next.provider, b);
  assert.equal(next.model, 'gpt-5');
  assert.deepEqual(choices.map(choice => choice.provider), [a, b]);
  assert.equal(logic.sameUsageModel(original, next), false);
  assert.equal(logic.sameUsageModel(original, logic.nextUsageModel(choices, next)), true);
  assert.deepEqual(logic.codexModelChoices([groups[0]]), []);
  assert.equal(logic.nextUsageModel([], original), null);
});

test('account fallback never expands the cycle or changes the original model on return', () => {
  const missing = [groups[0], { ...groups[1], models: [{ id: 'fallback', name: 'Fallback' }] }];
  const choices = logic.codexModelChoices(missing, 'gpt-5');
  const original = { provider: a, model: 'gpt-5' };
  const next = logic.nextUsageModel(choices, original);
  assert.equal(next.provider, b);
  assert.equal(next.model, 'fallback');
  assert.equal(logic.sameUsageModel(logic.nextUsageModel(choices, next), original), true);
  // Account identity drives stepping, even if the catalog changes its model.
  assert.equal(logic.nextUsageModel(choices, { provider: b, model: 'removed-model' }).provider, a);
});

test('popover previews only details, refreshes the preview, and submits only on confirmation', async () => {
  const source = await readFile(new URL('../client.source.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /dshUsageClose|t\('close'\)/);
  let plugin, Usage, cursor = 0, usageStatus = 'ready';
  const states = [], refs = [], refreshes = [], submissions = [];
  const state = { current: { provider: a, model: 'gpt-5' }, groups, status: 'ready', pending: null };
  const controller = { store: { subscribe() {}, getSnapshot: () => state }, select: async value => {
    submissions.push(value); return { ok: false, error: { message: 'Rejected' } };
  } };
  const React = {
    Fragment: 'fragment', createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useSyncExternalStore: (_subscribe, get) => get(),
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return refs[index] ??= { current: initial }; },
    useId: () => 'usage', useEffect(fn, deps) { if (deps?.length === 0) fn(); }, useLayoutEffect() {}, useCallback: fn => fn,
  };
  const locale = { register() {}, bind: () => key => key, subscribe() {}, getSnapshot: () => ({ active: 'en' }) };
  const stores = new Map();
  const services = { locale, configForms: { get: () => ({ subscribe() {}, getSnapshot: () => ({}) }) } };
  vm.runInNewContext(source, { ...logic,
    createUsageStore: () => {
      const index = stores.size;
      const store = { subscribe() {}, getSnapshot: () => ({ status: usageStatus, value: { rows: [{ id: index }] } }), refresh: async () => refreshes.push(index), invalidate() {} };
      stores.set(index, store); return store;
    },
    window: { __ModuleLoader__: { load: value => { plugin = value; } } }, document: { body: {} }, console,
  });
  plugin.factory(name => name === 'react' ? React : { createPortal: value => value }).apply({
    locale, get: id => services[id], effect() {}, on() {},
    slots: { inject: (_name, register) => register(), register: (_options, component) => { Usage = component; } },
  });
  const render = () => { cursor = 0; const value = Usage({ controller }); return value.type(value.props); };
  const panel = tree => tree.props.children[2];
  const buttons = tree => panel(tree).props.children[0].props.children.filter(node => node?.type === 'button');
  const button = (tree, label) => buttons(tree).find(node => node.props['aria-label'] === label);
  const details = tree => panel(tree).props.children.find(node => node?.type?.name === 'UsageDetails').props;
  let tree = render();
  tree.props.children[1].props.onClick();
  tree = render();
  assert.equal(button(tree, 'confirmModel'), undefined);
  assert.equal(button(tree, 'close'), undefined); // dismissal stays outside the header
  assert.equal(button(tree, 'switchModel').props.children[0], '→');
  panel(tree).props.ref.current = { getBoundingClientRect: () => ({ height: 420 }) };
  button(tree, 'switchModel').props.onClick(); tree = render();
  assert.equal(panel(tree).props.style.minHeight, 'min(420px, calc(100dvh - 24px))');
  assert.equal(details(tree).model, 'gpt-5');
  assert.equal(details(tree).snapshot.value.rows[0].id, 1);
  assert.ok(button(tree, 'confirmModel'));
  assert.equal(submissions.length, 0);
  await button(tree, 'refresh').props.onClick();
  assert.deepEqual(refreshes, [1]);
  button(tree, 'switchModel').props.onClick(); tree = render();
  assert.equal(button(tree, 'confirmModel'), undefined);
  assert.equal(details(tree).model, 'gpt-5');
  assert.equal(details(tree).snapshot.value.rows[0].id, 0);
  button(tree, 'switchModel').props.onClick(); tree = render();
  assert.equal(details(tree).snapshot.value.rows[0].id, 1);
  await button(tree, 'confirmModel').props.onClick(); tree = render();
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].provider, b);
  assert.equal(panel(tree).props.children[1].props.children[0], 'Rejected');
  assert.ok(button(tree, 'confirmModel')); // failure retains the preview and retry
  assert.equal(state.current.provider, a);
  // Removing a preview route makes confirmation disappear without a submission.
  state.groups = [groups[0]]; tree = render();
  assert.equal(button(tree, 'switchModel'), undefined);
  assert.equal(button(tree, 'confirmModel'), undefined);
  assert.equal(submissions.length, 1);
  state.groups = groups;
  tree.props.children[1].props.onClick(); tree = render();
  tree.props.children[1].props.onClick(); tree = render();
  button(tree, 'switchModel').props.onClick();
  usageStatus = 'loading'; tree = render();
  assert.equal(panel(tree).props.children[2].props.children[1].props.children[0], 'Codex-1');
  assert.ok(button(tree, 'confirmModel')); // identity is visible even before quota loads
  usageStatus = 'ready';
  let settle;
  controller.select = () => new Promise(resolve => { settle = resolve; });
  const pending = button(tree, 'confirmModel').props.onClick(); tree = render();
  assert.equal(button(tree, 'switchModel').props.disabled, true);
  tree.props.children[1].props.onClick(); tree = render();
  tree.props.children[1].props.onClick(); tree = render();
  settle({ ok: false, error: { message: 'Old failure' } }); await pending; tree = render();
  assert.equal(panel(tree).props.children[1], null); // old request cannot pollute reopened popover
  button(tree, 'switchModel').props.onClick(); tree = render();
  let focused = false;
  tree.props.children[1].props.ref.current = { focus: () => { focused = true; } };
  controller.select = async () => ({ ok: true });
  await button(tree, 'confirmModel').props.onClick(); tree = render();
  assert.equal(panel(tree), false);
  assert.equal(focused, true);
});
