import {createHash} from 'node:crypto';
import {UsageError, staleIdentity, bounded} from './host-cache.js';

// Protocol reference: WSL043/dsh-codex-subscription src/usage.js (MIT).
// Only the upstream HTTP protocol is shared; no WSL RPC, cache or account state is used.
export const CODEX_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';
const keyPattern = /^codex-subscribe\/(account-[a-f0-9]{32})$/;
export const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function parseCodexUsage(value, now = Date.now()) {
  if (!object(value)) throw new UsageError();
  const rateLimits = [], seen = new Set();
  function window(raw) {
    if (raw == null) return undefined;
    if (!object(raw) || !Number.isFinite(raw.used_percent) || raw.used_percent < 0 || raw.used_percent > 100
      || !Number.isSafeInteger(raw.limit_window_seconds) || raw.limit_window_seconds <= 0) throw new UsageError();
    let resetsAt;
    if (raw.reset_at != null && raw.reset_at !== 0) {
      if (!Number.isSafeInteger(raw.reset_at) || raw.reset_at < 0) throw new UsageError();
      resetsAt = raw.reset_at;
    } else if (Number.isSafeInteger(raw.reset_after_seconds) && raw.reset_after_seconds > 0)
      resetsAt = Math.floor(now / 1000) + raw.reset_after_seconds;
    return {usedPercent: raw.used_percent, remainingPercent: 100 - raw.used_percent,
      windowSeconds: raw.limit_window_seconds, ...(resetsAt === undefined ? {} : {resetsAt})};
  }
  function add(id, name, raw) {
    if (raw == null) return;
    if (!object(raw)) throw new UsageError();
    const windows = [window(raw.primary_window), window(raw.secondary_window)].filter(Boolean);
    if (windows.length && !seen.has(id)) { seen.add(id); rateLimits.push({id, name, windows}); }
  }
  add('codex', 'Codex', value.rate_limit);
  if (value.additional_rate_limits != null && !Array.isArray(value.additional_rate_limits)) throw new UsageError();
  for (const extra of value.additional_rate_limits ?? []) {
    if (!object(extra) || typeof extra.metered_feature !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(extra.metered_feature)
      || (extra.limit_name != null && typeof extra.limit_name !== 'string')) throw new UsageError();
    // Names are display-only protocol labels, bounded independently of the raw response.
    add(extra.metered_feature, (extra.limit_name || extra.metered_feature).slice(0, 120), extra.rate_limit);
  }
  add('code_review', 'Code review', value.code_review_rate_limit);
  return {rateLimits, fetchedAt: now};
}
function payload(record) {
  const p = record?.kind === 'grant' ? record.payload : undefined;
  const c = p?.credential;
  if (![1, 2].includes(p?.version) || typeof p.label !== 'string' || c?.type !== 'oauth'
    || typeof c.access !== 'string' || !c.access || typeof c.refresh !== 'string' || !c.refresh
    || !Number.isFinite(c.expires)) throw new UsageError('usage/auth-required', 'Sign in again in Codex subscriptions settings.');
  return p;
}
function identity(p) { return fingerprint([p.credential.access, p.credential.accountId, p.credential.expires]); }
function emailOf(p) {
  const email = p.email || p.credential.email;
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}
async function defaultAuthFactory(store) {
  const [{createModels}, {openaiCodexProvider}] = await Promise.all([
    import('@earendil-works/pi-ai'), import('@earendil-works/pi-ai/providers/openai-codex'),
  ]);
  const auth = createModels({credentials: store, authContext: {env: async () => undefined, fileExists: async () => false}});
  auth.setProvider(openaiCodexProvider());
  return auth;
}
export class CodexUsageAdapter {
  constructor({credentials, cache, fetch = globalThis.fetch, authFactory = defaultAuthFactory, now = Date.now, enabled = () => true}) {
    Object.assign(this, {credentials, cache, fetch, authFactory, now, enabled});
    this.auth = new Map(); this.lifetime = new AbortController();
  }
  async list(provider) {
    if (!this.credentials || !this.enabled()) return [];
    const rows = [];
    for (const entry of await this.credentials.listRecords()) {
      const match = keyPattern.exec(entry.key);
      if (!match || entry.kind !== 'grant' || !this.enabled(`codex-sub-${match[1].slice(8)}`)) continue;
      const record = await this.credentials.readRecord(entry.key);
      if (!record) continue;
      let p;
      try { p = payload(record); } catch { continue; }
      rows.push({id: match[1], provider: `codex-sub-${match[1].slice(8)}`, suffix: p.label.slice(0, 64), email: emailOf(p)});
    }
    const ids = new Set(rows.map(row => row.id));
    for (const id of this.auth.keys()) if (!ids.has(id)) this.auth.delete(id);
    return rows.map(row => ({...row, label: rows.length === 1 ? 'Codex' : `Codex-${row.suffix}`, active: row.provider === provider}))
      .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  }
  async authorize(id, signal) {
    const key = `codex-subscribe/${id}`;
    let auth = this.auth.get(id);
    if (!auth) {
      const assert = provider => { if (provider !== 'openai-codex') throw new UsageError(); };
      // Same record lock and public pi-ai auth lifecycle as the owning subscription adapter.
      const store = {
        read: async (provider, options) => { assert(provider); options?.signal?.throwIfAborted();
          const record = await this.credentials.readRecord(key); return record ? structuredClone(payload(record).credential) : undefined; },
        modify: async (provider, update, options) => { assert(provider);
          const record = await this.credentials.modifyRecord(key, async current => {
            options?.signal?.throwIfAborted();
            if (!current) throw staleIdentity();
            const p = payload(current), next = await update(structuredClone(p.credential));
            if (next === undefined) return undefined;
            const replacement = {...current, payload: {...p, credential: next}};
            payload(replacement);
            if (p.credential.accountId && next.accountId !== p.credential.accountId) throw staleIdentity();
            return replacement;
          });
          return record ? structuredClone(payload(record).credential) : undefined;
        },
        list: async () => await this.credentials.readRecord(key) ? [{providerId: 'openai-codex', type: 'oauth'}] : [],
        delete: async () => { throw new UsageError(); },
      };
      auth = Promise.resolve(this.authFactory(store)); this.auth.set(id, auth);
      auth.catch(() => { if (this.auth.get(id) === auth) this.auth.delete(id); });
    }
    const result = await (await auth).getAuth('openai-codex', {signal});
    const p = payload(await this.credentials.readRecord(key));
    if (!result?.auth?.apiKey || result.auth.apiKey !== p.credential.access || !p.credential.accountId) throw staleIdentity();
    return p;
  }
  async readAccount(row, force) {
    const signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(20_000)]);
    const p = await bounded(this.authorize(row.id, signal), signal), expected = identity(p);
    const current = async () => {
      if (!this.enabled(row.provider)) return false;
      try { return identity(payload(await this.credentials.readRecord(`codex-subscribe/${row.id}`))) === expected; }
      catch { return false; }
    };
    return this.cache.read(`codex:${row.id}`, {identity: expected, force, signal, isCurrent: current,
      load: async shared => {
        const response = await this.fetch(CODEX_USAGE_URL, {method: 'GET', redirect: 'error', cache: 'no-store',
          headers: {authorization: `Bearer ${p.credential.access}`, 'chatgpt-account-id': p.credential.accountId,
            accept: 'application/json', 'user-agent': 'dsh-usage/0.3', 'cache-control': 'no-store'},
          signal: AbortSignal.any([shared, this.lifetime.signal, AbortSignal.timeout(15_000)])});
        if (!response.ok) {
          const seconds = Number(response.headers?.get?.('retry-after'));
          throw new UsageError(response.status === 401 || response.status === 403 ? 'usage/auth-required' : 'usage/unavailable',
            response.status === 401 || response.status === 403 ? 'Sign in again in Codex subscriptions settings.' : undefined,
            response.status === 429 && Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined);
        }
        return parseCodexUsage(await response.json(), this.now());
      }});
  }
  async read({provider, force = false}) {
    const accounts = await this.list(provider);
    // A model selection names one independent subscription; never query other accounts implicitly.
    const rows = await Promise.all(accounts.filter(row => row.active).map(async row =>
      ({...row, usage: await this.readAccount(row, force)})));
    // Do not return removed identities if sign-out raced an HTTP request.
    const latest = await this.list(provider), byId = new Map(latest.map(row => [row.id, row]));
    return {rows: rows.filter(row => byId.has(row.id)).map(row => ({...row, ...byId.get(row.id)})), accounts: latest,
      signedOut: latest.length === 0 || !latest.some(row => row.active)};
  }
  dispose() { this.lifetime.abort(); this.auth.clear(); }
}
