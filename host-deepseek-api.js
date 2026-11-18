import {UsageError} from './host-cache.js';
import {fingerprint} from './host-codex.js';

export const DEEPSEEK_BALANCE_URL = 'https://api.deepseek.com/user/balance';

// Follow the provider's live settings and launch environment, never account login.
export function deepseekApiRoute(ctx) {
  const directory = ctx.get('llm')?.listConfigurableProviders?.()
    .find(row => row.provider === 'deepseek-official');
  const settings = ctx.get('settings')?.describe() ?? [];
  const row = directory ? settings.find(row => row.ns === directory.settingsNs)
    : settings.find(row => ['llm-deepseek', 'llm-deepseek-api-key', 'include:llm-deepseek', 'include:llm-deepseek-api-key'].includes(row.ns));
  if (directory && !row) throw new UsageError('usage/configuration');
  const config = (directory?.settingsPath ?? []).reduce((value, key) => value?.[key], row?.value) ?? {};
  const environment = ctx.get('launchEnvironment');
  const baseURL = config.baseURL ?? (environment ? environment.get('DEEPSEEK_BASE_URL')?.value : process.env.DEEPSEEK_BASE_URL)
    ?? 'https://api.deepseek.com/anthropic';
  const url = new URL(baseURL);
  // A proxied/custom deployment is not necessarily billed to the official key's account.
  // Never send a key to a client-selected URL or silently query a different billing origin.
  if (url.protocol !== 'https:' || url.hostname !== 'api.deepseek.com' || url.port
    || url.username || url.password || url.search || url.hash) return {unsupported: true};
  const keyRef = config.apiKeyEnv ?? 'DEEPSEEK_API_KEY';
  if (typeof keyRef !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(keyRef)) throw new UsageError('usage/configuration');
  return {url: DEEPSEEK_BALANCE_URL, keyRef};
}

// Project each optional field independently: missing data is not zero. The API's
// total is authoritative; never infer spend or add balances across currencies.
export function parseDeepseekApiBalance(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || (value.balance_infos !== undefined && !Array.isArray(value.balance_infos))) throw new UsageError();
  const rows = value.balance_infos ?? [];
  if (rows.length > 100) throw new UsageError();
  const project = field => rows.filter(row => row && ['CNY', 'USD'].includes(row.currency)
    && typeof row[field] === 'string' && row[field].length <= 128 && /^-?\d+(\.\d+)?$/.test(row[field]))
    .map(row => ({currency: row.currency, amount: row[field]}));
  const result = {totals: project('total_balance'), recharge: project('topped_up_balance'), bonus: project('granted_balance')};
  if (typeof value.is_available === 'boolean') result.isAvailable = value.is_available;
  if (!result.totals.length && !result.recharge.length && !result.bonus.length && result.isAvailable === undefined) throw new UsageError();
  return result;
}

export class DeepSeekApiUsageAdapter {
  constructor({credentials, cache, route, fetch = globalThis.fetch, now = Date.now}) {
    Object.assign(this, {credentials, cache, route, fetch, now});
    this.lifetime = new AbortController();
  }
  async resolve() {
    const route = this.route();
    if (route.unsupported) return {unsupported: true, identity: 'unsupported'};
    const token = (await this.credentials?.resolve(route.keyRef))?.value;
    if (token !== undefined && (typeof token !== 'string' || !token.length || /[^\x21-\x7e]/.test(token)))
      throw new UsageError('usage/auth-required');
    return {...route, token, identity: fingerprint([route.url, route.keyRef, token])};
  }
  async read({force = false}) {
    const initial = await this.resolve();
    if (initial.unsupported || !initial.token) {
      this.cache.invalidate('deepseek-api');
      return initial.unsupported ? {unsupported: true} : {unconfigured: true};
    }
    return this.cache.read('deepseek-api', {identity: initial.identity, force,
      isCurrent: async () => (await this.resolve()).identity === initial.identity,
      signal: this.lifetime.signal, load: async signal => {
        const response = await this.fetch(initial.url, {method: 'GET', redirect: 'error', cache: 'no-store',
          headers: {Authorization: `Bearer ${initial.token}`, Accept: 'application/json'},
          signal: AbortSignal.any([signal, this.lifetime.signal, AbortSignal.timeout(20_000)])});
        if (!response.ok) throw new UsageError(response.status === 401 || response.status === 403
          ? 'usage/auth-required' : 'usage/unavailable');
        return {...parseDeepseekApiBalance(await response.json()), updatedAt: this.now()};
      }});
  }
  dispose() { this.lifetime.abort(); }
}
