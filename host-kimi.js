import {UsageError} from './host-cache.js';
import {fingerprint} from './host-codex.js';

const DEFAULT_URL = 'https://api.kimi.com/coding/v1';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Resolve the provider's own live settings, not client input or another provider's key.
export function kimiRoute(ctx) {
  const directory = ctx.get('llm')?.listConfigurableProviders?.()
    .find(row => row.provider === 'kimi-coding');
  const settings = ctx.get('settings')?.describe() ?? [];
  const row = directory ? settings.find(row => row.ns === directory.settingsNs)
    : settings.find(row => ['llm-pi-ai', 'include:llm-pi-ai'].includes(row.ns));
  if (directory && !row) throw new UsageError('usage/configuration');
  const config = directory
    ? (directory.settingsPath ?? []).reduce((value, key) => value?.[key], row?.value) ?? {}
    : row?.value?.providers?.['kimi-coding'] ?? {};
  const environment = ctx.get('launchEnvironment');
  const envName = directory?.baseURLEnv;
  const envURL = config.baseURL == null && typeof envName === 'string' && envName
    ? (environment ? environment.get(envName)?.value : process.env[envName]) : undefined;
  const baseURL = config.baseURL ?? envURL ?? directory?.defaultBaseURL ?? DEFAULT_URL;
  // Validate the raw path too: URL normalization must not turn a proxy/dot path
  // or backslash authority into a trusted endpoint. No credentials/query/fragment.
  if (typeof baseURL !== 'string' || !/^https:\/\/api\.kimi\.(?:com|ai)\/coding(?:\/v1)?\/?$/.test(baseURL))
    return {unsupported: true};
  const url = new URL(baseURL);
  const keyRef = config.apiKeyEnv ?? 'KIMI_API_KEY';
  if (typeof keyRef !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(keyRef)) throw new UsageError('usage/configuration');
  return {url: `${url.origin}/coding/v1/usages`, keyRef};
}

// Accept bounded plain decimals only; never coerce null, booleans or blank strings to zero.
function number(value) {
  if (typeof value === 'string') {
    if (value.length > 128 || !/^\d+(?:\.\d+)?$/.test(value)) return undefined;
    const [integer, fraction = ''] = value.split('.');
    const whole = integer.replace(/^0+/, '') || '0';
    const maximum = String(Number.MAX_SAFE_INTEGER);
    if (whole.length > maximum.length || (whole.length === maximum.length && whole > maximum)
      || (whole === maximum && /[1-9]/.test(fraction))) return undefined;
    value = Number(value);
  }
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
    ? value : undefined;
}
function resetTime(value) {
  if (typeof value !== 'string' || value.length > 64
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [year, month, day, hour, minute, second] = value.slice(0, 19).split(/[-T:]/).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59) return null;
  const seconds = Math.floor(Date.parse(value) / 1000);
  return Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : null;
}
const units = new Map([
  ['TIME_UNIT_SECOND', 1], ['TIME_UNIT_MINUTE', 60], ['TIME_UNIT_HOUR', 3600],
  ['TIME_UNIT_DAY', 86400], ['TIME_UNIT_WEEK', 604800],
]);

export function parseKimiUsage(payload) {
  if (!object(payload) || payload.error != null || payload.errors != null || payload.success === false
    || (payload.code != null && payload.code !== 0 && payload.code !== '0')) throw new UsageError();
  if (Array.isArray(payload.limits) && payload.limits.length > 100) throw new UsageError();
  const windows = [];
  const add = (detail, windowSeconds) => {
    if (!object(detail) || !Number.isSafeInteger(windowSeconds) || windowSeconds <= 0) return;
    const limit = number(detail.limit), remaining = number(detail.remaining);
    if (limit === undefined || remaining === undefined || limit <= 0 || remaining > limit) return;
    windows.push({remainingPercent: remaining / limit * 100, windowSeconds, resetsAt: resetTime(detail.resetTime)});
  };
  // usage is the rolling weekly allowance, not totalQuota (nor booster credit).
  add(payload.usage, 7 * 86400);
  for (const entry of Array.isArray(payload.limits) ? payload.limits : []) {
    if (!object(entry) || !object(entry.window)) continue;
    const duration = number(entry.window.duration), multiplier = units.get(entry.window.timeUnit);
    if (duration !== undefined && multiplier !== undefined) add(entry.detail, duration * multiplier);
  }
  return {windows: windows.sort((a, b) => a.windowSeconds - b.windowSeconds)};
}

export class KimiUsageAdapter {
  constructor({credentials, cache, route, fetch = globalThis.fetch, now = Date.now}) {
    Object.assign(this, {credentials, cache, route, fetch, now});
    this.lifetime = new AbortController();
  }
  async resolve() {
    const route = this.route();
    if (route.unsupported) return {unsupported: true, identity: 'unsupported'};
    let token;
    try { token = (await this.credentials?.resolve(route.keyRef))?.value; }
    catch { throw new UsageError(); }
    if (token !== undefined && (typeof token !== 'string' || !token.length || /[^\x21-\x7e]/.test(token)))
      throw new UsageError('usage/auth-required');
    return {...route, token, identity: fingerprint([route.url, route.keyRef, token])};
  }
  async read({force = false} = {}) {
    if (this.lifetime.signal.aborted) throw new UsageError('usage/cancelled');
    const initial = await this.resolve();
    if (initial.unsupported || !initial.token) {
      this.cache.invalidate('kimi-coding');
      return initial.unsupported ? {unsupported: true} : {unconfigured: true};
    }
    return this.cache.read('kimi-coding', {identity: initial.identity, force,
      isCurrent: async () => (await this.resolve()).identity === initial.identity,
      signal: this.lifetime.signal, load: async signal => {
        const response = await this.fetch(initial.url, {method: 'GET', redirect: 'error', cache: 'no-store',
          headers: {Authorization: `Bearer ${initial.token}`, Accept: 'application/json'},
          signal: AbortSignal.any([signal, this.lifetime.signal, AbortSignal.timeout(20_000)])});
        if (!response.ok) throw new UsageError(response.status === 401 || response.status === 403
          ? 'usage/auth-required' : 'usage/unavailable');
        return {...parseKimiUsage(await response.json()), updatedAt: this.now()};
      }});
  }
  dispose() { this.lifetime.abort(); }
}
