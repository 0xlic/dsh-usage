import {createHash, createHmac, randomBytes} from 'node:crypto';
import {UsageError, staleIdentity, bounded} from './host-cache.js';

// Usage protocol reference: WSL043/dsh-codex-subscription src/usage.js (MIT).
// Reset protocol: openai/codex codex-rs/backend-client/src/client/rate_limit_resets.rs.
export const CODEX_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';
export const CODEX_RESET_CARDS_URL = 'https://chatgpt.com/backend-api/wham/rate-limit-reset-credits';
export const CODEX_CONSUME_RESET_CARD_URL = `${CODEX_RESET_CARDS_URL}/consume`;
export const codexProviderPattern = /^codex-sub-([a-f0-9]{32})(?![\s\S])/;
export const codexCreditIdPattern = /^[A-Za-z0-9_-]{1,256}(?![\s\S])/;
const keyPattern = /^codex-subscribe\/(account-[a-f0-9]{32})$/;
const resetCodes = new Set(['reset', 'already_redeemed', 'nothing_to_reset', 'no_credit']);
export const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function parseCodexResetCards(value, now = Date.now()) {
  if (!object(value) || !Array.isArray(value.credits)) throw new UsageError();
  const cards = [], seen = new Set();
  for (const credit of value.credits) {
    if (!object(credit)) throw new UsageError();
    if (credit.status !== 'available' || credit.reset_type !== 'codex_rate_limits') continue;
    if (typeof credit.id !== 'string' || !codexCreditIdPattern.test(credit.id)) throw new UsageError();
    let expiresAt = null;
    if (credit.expires_at != null) {
      if (typeof credit.expires_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(credit.expires_at)) throw new UsageError();
      expiresAt = Date.parse(credit.expires_at);
      if (!Number.isFinite(expiresAt)) throw new UsageError();
      if (expiresAt <= now) continue;
    }
    if (seen.has(credit.id)) continue;
    seen.add(credit.id);
    cards.push({id: credit.id, title: typeof credit.title === 'string' ? credit.title.trim().slice(0, 200) : '',
      description: typeof credit.description === 'string' ? credit.description.trim().slice(0, 1000) : '', expiresAt});
  }
  return cards.sort((a, b) => (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity));
}
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
    this.revisionKey = randomBytes(32); this.pendingResets = new Map();
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
  async request(url, p, signal, body) {
    const response = await this.fetch(url, {method: body === undefined ? 'GET' : 'POST', redirect: 'error', cache: 'no-store',
      headers: {authorization: `Bearer ${p.credential.access}`, 'chatgpt-account-id': p.credential.accountId,
        accept: 'application/json', 'user-agent': 'dsh-usage/0.3', 'cache-control': 'no-store',
        ...(body === undefined ? {} : {'content-type': 'application/json'})},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal});
    if (!response.ok) {
      const seconds = Number(response.headers?.get?.('retry-after'));
      throw new UsageError(response.status === 401 || response.status === 403 ? 'usage/auth-required' : 'usage/unavailable',
        response.status === 401 || response.status === 403 ? 'Sign in again in Codex subscriptions settings.' : undefined,
        response.status === 429 && Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined);
    }
    return response.json();
  }
  async currentAccount(row) {
    if (this.lifetime.signal.aborted || !this.credentials || !this.enabled(row.provider)) throw staleIdentity();
    let p;
    try { p = payload(await this.credentials.readRecord(`codex-subscribe/${row.id}`)); }
    catch { throw staleIdentity(); }
    if (this.lifetime.signal.aborted || !this.enabled(row.provider) || !p.credential.accountId) throw staleIdentity();
    return p;
  }
  resetRow(provider) {
    const match = codexProviderPattern.exec(provider);
    if (!match) throw new UsageError('usage/invalid-request', 'Invalid usage query.');
    return {id: `account-${match[1]}`, provider};
  }
  resetRevision(row, p) {
    // The owner mints a new slot ID on add and requires the same account ID on renewal.
    // Avoid binding a confirmation or retry to an access token that may rotate at any time.
    return createHmac('sha256', this.revisionKey).update(JSON.stringify([row.id, p.credential.accountId])).digest('hex');
  }
  async readAccountData(row, {kind, url, parse, force, signal}) {
    const p = await bounded(this.authorize(row.id, signal), signal), expected = identity(p);
    const isCurrent = async () => {
      try { return identity(await this.currentAccount(row)) === expected; }
      catch { return false; }
    };
    return this.cache.read(`${kind}:${row.id}`, {identity: expected, force, signal, isCurrent,
      load: async shared => {
        if (kind === 'codex-reset-cards' && !await isCurrent()) throw staleIdentity();
        const upstream = AbortSignal.any([shared, this.lifetime.signal, AbortSignal.timeout(15_000)]);
        upstream.throwIfAborted();
        return parse(await this.request(url, p, upstream), p);
      }});
  }
  async readAccount(row, force) {
    const signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(20_000)]);
    return this.readAccountData(row, {kind: 'codex', url: CODEX_USAGE_URL, force, signal,
      parse: value => parseCodexUsage(value, this.now())});
  }
  async listResetCards({provider, force = false}, caller) {
    const row = this.resetRow(provider);
    const signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(20_000), ...(caller ? [caller] : [])]);
    await bounded(this.currentAccount(row), signal);
    const value = await this.readAccountData(row, {kind: 'codex-reset-cards', url: CODEX_RESET_CARDS_URL, force, signal,
      parse: (raw, p) => ({cards: parseCodexResetCards(raw, this.now()), accountRevision: this.resetRevision(row, p)})});
    const now = this.now();
    return {...value, cards: value.cards.filter(card => card.expiresAt === null || card.expiresAt > now)};
  }
  invalidateResetCaches(row) {
    this.cache.invalidate(`codex:${row.id}`);
    this.cache.invalidate(`codex-reset-cards:${row.id}`);
  }
  useResetCard(input, caller) {
    const row = this.resetRow(input.provider);
    const {creditId, requestId, accountRevision} = input;
    const existing = this.pendingResets.get(row.id);
    if (existing) {
      if (accountRevision !== existing.accountRevision) throw staleIdentity();
      if (requestId !== existing.requestId || creditId !== existing.creditId)
        throw new UsageError('usage/unavailable', 'Another Codex reset request is in progress. Retry shortly.');
      return existing.promise;
    }
    const promise = this.consumeResetCard(row, {creditId, requestId, accountRevision}, caller).finally(() => {
      this.pendingResets.delete(row.id);
    });
    this.pendingResets.set(row.id, {creditId, requestId, accountRevision, promise});
    return promise;
  }
  async consumeResetCard(row, {creditId, requestId, accountRevision}, caller) {
    const lifetime = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(20_000)]);
    const before = caller ? AbortSignal.any([lifetime, caller]) : lifetime;
    before.throwIfAborted();
    const initial = await bounded(this.currentAccount(row), before);
    if (this.resetRevision(row, initial) !== accountRevision) throw staleIdentity();
    const p = await bounded(this.authorize(row.id, before), before);
    if (this.resetRevision(row, p) !== accountRevision) throw staleIdentity();
    const expected = identity(p);
    let pending;
    try {
      // The credential owner's record lock serializes replacement/sign-out against
      // the last check and dispatch. Start HTTP under that lock, but do not wait for
      // the network there or write any changes to the record.
      await bounded(this.credentials.modifyRecord(`codex-subscribe/${row.id}`, record => {
        before.throwIfAborted();
        if (!record || !this.enabled(row.provider) || identity(payload(record)) !== expected) throw staleIdentity();
        this.invalidateResetCaches(row);
        // Once dispatched, a closing browser only cancels its own waiter. A retry
        // joins the same in-flight action, or replays the exact UUID with upstream.
        const upstream = AbortSignal.any([lifetime, AbortSignal.timeout(15_000)]);
        pending = bounded(this.request(CODEX_CONSUME_RESET_CARD_URL, p, upstream,
          {redeem_request_id: requestId, credit_id: creditId}), upstream);
        pending.catch(() => {});
        return undefined;
      }), lifetime);
      const value = await pending;
      if (this.resetRevision(row, await bounded(this.currentAccount(row), lifetime)) !== accountRevision) throw staleIdentity();
      if (!object(value) || !resetCodes.has(value.code)) throw new UsageError();
      return {code: value.code};
    } finally {
      // A lost or undecodable reply does not guarantee the server did nothing.
      if (pending) this.invalidateResetCaches(row);
    }
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
