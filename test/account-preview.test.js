import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usageKind, observeModelSelection } from '../logic.js';

test('independent Codex providers are routed by exact credential namespace', () => {
  assert.equal(usageKind(`codex-sub-${'a'.repeat(32)}`), 'codex');
  for (const id of ['codex-sub-other', 'codex-sub-', 'openai', 'custom']) assert.equal(usageKind(id), null);
});

test('successful selection refreshes even for the same provider/model and effort-only selection', () => {
  let state = { current: { provider: 'capinfo', model: 'test' }, pending: null, status: 'ready' };
  const listeners = new Set();
  const directory = { getSnapshot: () => state, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
  let refreshes = 0;
  const off = observeModelSelection(directory, () => refreshes++);
  const publish = change => { state = { ...state, ...change }; listeners.forEach(fn => fn()); };
  publish({ pending: state.current, status: 'selecting' });
  publish({ status: 'selecting' });
  assert.equal(refreshes, 0);
  publish({ pending: null, status: 'ready' });
  assert.equal(refreshes, 1);
  publish({ pending: { ...state.current, reasoningEffort: 'high' }, status: 'selecting' });
  publish({ pending: null, status: 'ready' });
  assert.equal(refreshes, 2);
  publish({ pending: state.current, status: 'selecting' });
  publish({ pending: null, status: 'error' });
  assert.equal(refreshes, 2);
  off();
  assert.equal(listeners.size, 0);
});
