import {HostUsageCache, UsageError, bounded} from './host-cache.js';
import {CodexUsageAdapter, codexProviderPattern, codexCreditIdPattern} from './host-codex.js';
import {CapinfoUsageAdapter} from './host-capinfo.js';
import {DeepSeekUsageAdapter} from './host-deepseek.js';
import {DeepSeekApiUsageAdapter, deepseekApiRoute} from './host-deepseek-api.js';
import {KimiUsageAdapter, kimiRoute} from './host-kimi.js';

export const inject = ['connection', 'credentials'];
const RESET_CARDS_ENDPOINT = 'usage/codex-reset-cards';
const USE_RESET_CARD_ENDPOINT = `${RESET_CARDS_ENDPOINT}/use`;
const uuidV4 = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const resetKeys = ['provider', 'force'];
const useKeys = ['provider', 'creditId', 'requestId', 'accountRevision'];
const invalidRequest = () => new UsageError('usage/invalid-request', 'Invalid usage query.');
const failure = (error = new UsageError()) => ({ok: false, error: {code: error.code, message: error.message, details: {}}});
function validateResetRequest(input, use) {
  const keys = use ? useKeys : resetKeys;
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !keys.includes(key))
    || typeof input.provider !== 'string' || !codexProviderPattern.test(input.provider)) throw invalidRequest();
  if (use ? (typeof input.creditId !== 'string' || !codexCreditIdPattern.test(input.creditId)
    || typeof input.requestId !== 'string' || input.requestId.length !== 36 || !uuidV4.test(input.requestId)
    || typeof input.accountRevision !== 'string' || input.accountRevision.length !== 64 || !/^[a-f0-9]{64}$/.test(input.accountRevision))
    : (input.force !== undefined && typeof input.force !== 'boolean')) throw invalidRequest();
  return input;
}
export function validateUsageRequest(input, accountsOnly = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !['kind', 'provider', 'model', 'force', 'client'].includes(key))
    || !['codex', 'capinfo', 'deepseek', 'deepseek-api', 'kimi-coding'].includes(input.kind)
    || typeof input.provider !== 'string' || input.provider.length > 128
    || (input.model !== undefined && (typeof input.model !== 'string' || input.model.length > 256))
    || (input.force !== undefined && typeof input.force !== 'boolean')
    || (input.kind === 'codex' && !/^codex-sub-[a-f0-9]{32}$/.test(input.provider))
    || (input.kind === 'capinfo' && input.provider !== 'capinfo')
    || (input.kind === 'deepseek' && input.provider !== 'deepseek-account')
    || (input.kind === 'deepseek-api' && input.provider !== 'deepseek-official')
    || (input.kind === 'kimi-coding' && input.provider !== 'kimi-coding')
    || (accountsOnly && input.kind !== 'codex')) throw new UsageError('usage/invalid-request', 'Invalid usage query.');
  if (input.kind === 'deepseek') {
    const c = input.client;
    if (!c || typeof c !== 'object' || Array.isArray(c) || Object.keys(c).some(key => !['version', 'locale', 'timezoneOffsetSeconds'].includes(key))
      || typeof c.version !== 'string' || !/^[0-9A-Za-z.+-]{1,64}$/.test(c.version)
      || typeof c.locale !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(c.locale)
      || !Number.isInteger(c.timezoneOffsetSeconds) || Math.abs(c.timezoneOffsetSeconds) > 86400)
      throw new UsageError('usage/invalid-request', 'Invalid usage query.');
  } else if (input.client !== undefined) throw new UsageError('usage/invalid-request', 'Invalid usage query.');
  return input;
}
export function createUsageHost(ctx, options = {}) {
  const cache = new HostUsageCache(options);
  const codex = new CodexUsageAdapter({credentials: ctx.credentials, cache, ...options,
    enabled: provider => !!ctx.get('llm')?.listProviders().some(row => provider ? row.id === provider : /^codex-sub-[a-f0-9]{32}$/.test(row.id))});
  // dsh-capinfo is optional; resolve its Cordis service lazily instead of taking
  // a hard activation dependency, and let the adapter report a quiet missing state.
  const capinfo = new CapinfoUsageAdapter({capinfoUsage: () => ctx.get('capinfoUsage'), ...options});
  const deepseek = new DeepSeekUsageAdapter({cache, account: {
    getPlatformSession: () => ctx.get('deepseekAccount')?.getPlatformSession(),
    getBalance: client => ctx.get('deepseekAccount')?.getBalance(client),
  }, ...options});
  const deepseekApi = new DeepSeekApiUsageAdapter({credentials: ctx.credentials, cache,
    route: () => deepseekApiRoute(ctx), ...options});
  const kimi = new KimiUsageAdapter({credentials: ctx.credentials, cache, route: () => kimiRoute(ctx), ...options});
  return {
    async dispatch(endpoint, input, signal) {
      try {
        signal?.throwIfAborted();
        let operation;
        if (endpoint === RESET_CARDS_ENDPOINT) operation = codex.listResetCards(validateResetRequest(input, false), signal);
        else if (endpoint === USE_RESET_CARD_ENDPOINT) operation = codex.useResetCard(validateResetRequest(input, true), signal);
        else {
          const request = validateUsageRequest(input, endpoint === 'usage/accounts');
          operation = endpoint === 'usage/accounts' ? codex.list(request.provider).then(accounts => ({accounts}))
            : ({codex, capinfo, deepseek, 'deepseek-api': deepseekApi, 'kimi-coding': kimi}[request.kind]).read(request);
        }
        const value = await (signal ? bounded(operation, signal) : operation);
        signal?.throwIfAborted();
        return {ok: true, value};
      } catch (error) {
        return failure(error instanceof UsageError ? error : undefined);
      }
    },
    dispose() { codex.dispose(); capinfo.dispose(); deepseek.dispose(); deepseekApi.dispose(); kimi.dispose(); cache.dispose(); },
  };
}
export function apply(ctx) {
  const host = createUsageHost(ctx);
  ctx.effect(() => () => host.dispose());
  // Exact Connection routes are owner-only behind DSH's Host/Origin and
  // Fetch-Metadata admission fence; they coexist with shared RPC interceptors.
  for (const endpoint of [RESET_CARDS_ENDPOINT, USE_RESET_CARD_ENDPOINT, 'usage/read']) {
    const headers = {'Cache-Control': 'no-store'};
    ctx.effect(() => ctx.connection.fetch.register({
      path: `/api/plugins/${endpoint}`, methods: ['POST'], requestBody: 'buffered',
      async fetch(request) {
        if (endpoint === USE_RESET_CARD_ENDPOINT) {
          const site = request.headers.get('sec-fetch-site');
          if (site === 'cross-site' || site === 'same-site') return Response.json(failure(
            new UsageError('usage/forbidden', 'This request is not allowed.')), {status: 403, headers});
          // Reject browser-simple submissions even if their body happens to parse as JSON.
          if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
            return Response.json(failure(invalidRequest()), {status: 415, headers});
        }
        let input;
        try { input = await request.json(); }
        catch { return Response.json(failure(invalidRequest()), {status: 400, headers}); }
        return Response.json(await host.dispatch(endpoint, input, request.signal), {headers});
      },
    }));
  }
}
