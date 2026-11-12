// Host-only cache. Keys/identities must be non-secret fingerprints; values are public projections.
export class UsageError extends Error {
  constructor(code = 'usage/unavailable', message = 'Usage is temporarily unavailable.', retryAfterMs) {
    super(message); this.code = code; this.retryAfterMs = retryAfterMs;
  }
}
export const staleIdentity = () => new UsageError('usage/identity-changed', 'Account credentials changed. Retry the usage query.');
const aborted = () => new UsageError('usage/cancelled', 'Usage query cancelled.');
function waitFor(promise, signal) {
  if (!signal) return promise.then(structuredClone);
  if (signal.aborted) return Promise.reject(aborted());
  return new Promise((resolve, reject) => {
    const cancel = () => { signal.removeEventListener('abort', cancel); reject(aborted()); };
    signal.addEventListener('abort', cancel, {once: true});
    promise.then(value => { signal.removeEventListener('abort', cancel); resolve(structuredClone(value)); },
      error => { signal.removeEventListener('abort', cancel); reject(error); });
  });
}
// A service may not accept AbortSignal (e.g. DeepSeek getBalance); bound the waiter anyway.
export function bounded(promise, signal) {
  if (signal.aborted) return Promise.reject(aborted());
  return new Promise((resolve, reject) => {
    const cancel = () => { signal.removeEventListener('abort', cancel); reject(aborted()); };
    signal.addEventListener('abort', cancel, {once: true});
    Promise.resolve(promise).then(value => { signal.removeEventListener('abort', cancel); resolve(value); },
      error => { signal.removeEventListener('abort', cancel); reject(error); });
  });
}
export class HostUsageCache {
  constructor({ttlMs = 60_000, cooldownMs = 5_000, timeoutMs = 25_000, now = Date.now, maxEntries = 128} = {}) {
    Object.assign(this, {ttlMs, cooldownMs, timeoutMs, now, maxEntries}); this.entries = new Map(); this.disposed = false;
  }
  async read(key, {identity, load, isCurrent = async () => true, force = false, signal}) {
    if (this.disposed || signal?.aborted) throw aborted();
    let entry = this.entries.get(key);
    if (entry && entry.identity !== identity) { entry.controller?.abort(); this.entries.delete(key); entry = undefined; }
    if (!entry) {
      entry = {identity}; this.entries.set(key, entry);
      while (this.entries.size > this.maxEntries) {
        const first = this.entries.keys().next().value;
        this.entries.get(first).controller?.abort(); this.entries.delete(first);
      }
    }
    const current = async () => !this.disposed && this.entries.get(key) === entry && await isCurrent();
    // Force bypasses success TTL, never upstream failure backoff or in-flight dedupe.
    if (entry.failure && this.now() < entry.retryAt) throw entry.failure;
    if (!force && entry.value !== undefined && this.now() < entry.expiresAt) {
      if (!await current()) throw staleIdentity();
      return structuredClone(entry.value);
    }
    if (!entry.pending) {
      const controller = entry.controller = new AbortController();
      const pending = Promise.resolve().then(async () => {
        try {
          const sharedSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(this.timeoutMs)]);
          const value = await bounded(Promise.resolve().then(() => load(sharedSignal)), sharedSignal);
          if (controller.signal.aborted || !await current()) throw staleIdentity();
          entry.value = structuredClone(value); entry.expiresAt = this.now() + this.ttlMs; entry.failure = undefined;
          return value;
        } catch (error) {
          const safe = error instanceof UsageError ? error : new UsageError();
          if (!controller.signal.aborted && await current() && safe.code !== 'usage/identity-changed') {
            entry.value = undefined; entry.expiresAt = 0; entry.failure = safe;
            entry.retryAt = this.now() + Math.min(300_000, Math.max(this.cooldownMs, Number.isFinite(safe.retryAfterMs) ? safe.retryAfterMs : 0));
          }
          throw safe;
        } finally { if (entry.pending === pending) entry.pending = undefined; }
      });
      entry.pending = pending;
    }
    const value = await waitFor(entry.pending, signal);
    if (!await current()) throw staleIdentity();
    return value;
  }
  invalidate(key) {
    this.entries.get(key)?.controller?.abort(); this.entries.delete(key);
  }
  dispose() {
    this.disposed = true;
    for (const entry of this.entries.values()) entry.controller?.abort();
    this.entries.clear();
  }
}
