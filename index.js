import {HostUsageCache, UsageError, bounded} from './host-cache.js';
import {CodexUsageAdapter} from './host-codex.js';
import {CapinfoUsageAdapter, capinfoRoute} from './host-capinfo.js';
import {DeepSeekUsageAdapter} from './host-deepseek.js';

export const inject = ['connection', 'credentials'];
export function validateUsageRequest(input, accountsOnly = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !['kind', 'provider', 'model', 'force', 'client'].includes(key))
    || !['codex', 'capinfo', 'deepseek'].includes(input.kind)
    || typeof input.provider !== 'string' || input.provider.length > 128
    || (input.model !== undefined && (typeof input.model !== 'string' || input.model.length > 256))
    || (input.force !== undefined && typeof input.force !== 'boolean')
    || (input.kind === 'codex' && !/^codex-sub-[a-f0-9]{32}$/.test(input.provider))
    || (input.kind === 'capinfo' && input.provider !== 'capinfo')
    || (input.kind === 'deepseek' && input.provider !== 'deepseek-account')
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
  const capinfo = new CapinfoUsageAdapter({credentials: ctx.credentials, cache, route: () => capinfoRoute(ctx), ...options});
  const deepseek = new DeepSeekUsageAdapter({cache, account: {
    getPlatformSession: () => ctx.get('deepseekAccount')?.getPlatformSession(),
    getBalance: client => ctx.get('deepseekAccount')?.getBalance(client),
  }, ...options});
  return {
    async dispatch(endpoint, input, signal) {
      try {
        signal?.throwIfAborted();
        const request = validateUsageRequest(input, endpoint === 'usage/accounts');
        const operation = endpoint === 'usage/accounts' ? codex.list(request.provider).then(accounts => ({accounts}))
          : ({codex, capinfo, deepseek}[request.kind]).read(request);
        const value = await (signal ? bounded(operation, signal) : operation);
        signal?.throwIfAborted();
        return {ok: true, value};
      } catch (error) {
        return {ok: false, error: {code: error instanceof UsageError ? error.code : 'usage/unavailable',
          message: error instanceof UsageError ? error.message : 'Usage is temporarily unavailable.', details: {}}};
      }
    },
    dispose() { codex.dispose(); capinfo.dispose(); deepseek.dispose(); cache.dispose(); },
  };
}
export function apply(ctx) {
  const host = createUsageHost(ctx);
  ctx.effect(() => () => host.dispose());
  // Exact Connection routes coexist with other plugins' shared RPC interceptors.
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/plugins/usage/read', methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      let input;
      try { input = await request.json(); }
      catch { return Response.json({ok: false, error: {code: 'usage/invalid-request', message: 'Invalid usage query.', details: {}}}, {status: 400}); }
      return Response.json(await host.dispatch('usage/read', input, request.signal),
        {headers: {'Cache-Control': 'no-store'}});
    },
  }));
}
