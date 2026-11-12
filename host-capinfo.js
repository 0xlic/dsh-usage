import {UsageError} from './host-cache.js';
import {fingerprint} from './host-codex.js';
const DEFAULT_URL = 'https://api.capinfo.com.cn/v1';

// Read configuration only, never the Capinfo balance service/cache, private bridge or demo mode.
export function capinfoRoute(ctx) {
  const settings = ctx.get('settings')?.describe() ?? [];
  const config = settings.find(row => row.ns === 'include:capinfo-models')?.value ?? {};
  const stored = ctx.get('storageDomain')?.get('capinfo_models')?.global.get()?.profile;
  const legacy = settings.map(row => row.value?.providers?.capinfo).find(Boolean);
  const profile = stored ?? legacy ?? {};
  const baseURL = config.baseURL || profile.baseURL || DEFAULT_URL;
  const url = new URL(baseURL);
  // Exact trusted authority; arbitrary client-selected endpoints are never accepted.
  if (url.protocol !== 'https:' || url.hostname !== 'api.capinfo.com.cn' || url.port || url.username || url.password
    || url.search || url.hash) throw new UsageError('usage/configuration', 'Capinfo usage configuration is unavailable.');
  const keyRef = profile.apiKeyEnv || 'CAPINFO_API_KEY';
  if (typeof keyRef !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(keyRef)) throw new UsageError('usage/configuration');
  return {url: `${url.href.replace(/\/+$/, '')}/user/balance`, keyRef};
}
export function parseCapinfoBalance(value) {
  if (!value || value.success !== true || value.source !== 'api_key' || value.currency !== 'CNY' || value.unit !== 'CNY'
    || typeof value.is_active !== 'boolean' || typeof value.unlimited_quota !== 'boolean'
    || !Number.isFinite(value.used)) throw new UsageError();
  if (value.unlimited_quota ? value.balance !== null || value.total !== null
    : !Number.isFinite(value.balance) || !Number.isFinite(value.total)) throw new UsageError();
  return {isValid: value.is_active, remaining: value.balance, total: value.total, used: value.used,
    unit: 'CNY', planName: 'Key 额度', extra: value.unlimited_quota ? '无限额度' : '人民币',
    unlimited: value.unlimited_quota, invalidMessage: value.is_active ? null : 'API Key 当前不可用'};
}
export class CapinfoUsageAdapter {
  constructor({credentials, cache, route, fetch = globalThis.fetch, now = Date.now}) {
    Object.assign(this, {credentials, cache, route, fetch, now});
    this.lifetime = new AbortController();
  }
  async resolve() {
    const route = this.route();
    const token = (await this.credentials?.resolve(route.keyRef))?.value;
    return {...route, token, identity: fingerprint([route.url, route.keyRef, token])};
  }
  async read({force = false}) {
    const initial = await this.resolve();
    const isCurrent = async () => (await this.resolve()).identity === initial.identity;
    if (!initial.token) {
      this.cache.invalidate('capinfo');
      return {status: 'unconfigured', data: null, checkedAt: null, updatedAt: null, error: null};
    }
    if (typeof initial.token !== 'string' || /[\r\n]/.test(initial.token)) throw new UsageError('usage/auth-required');
    return this.cache.read('capinfo', {identity: initial.identity, force, isCurrent,
      signal: this.lifetime.signal, load: async signal => {
        const checkedAt = new Date(this.now()).toISOString();
        const response = await this.fetch(initial.url, {method: 'GET', redirect: 'error', cache: 'no-store',
          headers: {Authorization: `Bearer ${initial.token}`, 'User-Agent': 'cc-switch/1.0'},
          signal: AbortSignal.any([signal, this.lifetime.signal, AbortSignal.timeout(20_000)])});
        if (response.status === 404) throw new UsageError('usage/not-available', 'Capinfo balance is not available yet.');
        if (!response.ok) throw new UsageError(response.status === 401 || response.status === 403 ? 'usage/auth-required' : 'usage/unavailable');
        const data = parseCapinfoBalance(await response.json());
        return {status: 'ready', data, checkedAt, updatedAt: new Date(this.now()).toISOString(), error: null};
      }});
  }
  dispose() { this.lifetime.abort(); }
}
