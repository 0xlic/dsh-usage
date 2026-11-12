import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HostUsageCache, UsageError} from '../host-cache.js';
import {CodexUsageAdapter, parseCodexUsage, CODEX_USAGE_URL} from '../host-codex.js';
import {CapinfoUsageAdapter, capinfoRoute, parseCapinfoBalance} from '../host-capinfo.js';
import {DeepSeekUsageAdapter} from '../host-deepseek.js';
import {apply, inject, createUsageHost, validateUsageRequest} from '../index.js';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const quota = {rate_limit: {primary_window: {used_percent: 12, limit_window_seconds: 18000, reset_after_seconds: 10}}};
const balance = {success: true, source: 'api_key', currency: 'CNY', unit: 'CNY', is_active: true,
  unlimited_quota: false, balance: 12.25, total: 100, used: 87.75};
const id = `account-${'a'.repeat(32)}`, provider = `codex-sub-${'a'.repeat(32)}`, key = `codex-subscribe/${id}`;
function credentials() {
  const records = new Map([[key, {kind:'grant', payload:{version:2,label:'first',email:'a@example.com',credential:{type:'oauth',access:'secret-access',refresh:'secret-refresh',expires:9999999999999,accountId:'account-id'}}}]]);
  return {records, token:'capinfo-secret',
    async resolve() { return this.token ? {value:this.token,source:'test'} : undefined; },
    async listRecords() { return [...records].map(([key,value]) => ({key,kind:value.kind})); },
    async readRecord(key) { return structuredClone(records.get(key)); },
    async modifyRecord(key, update) { const next = await update(structuredClone(records.get(key))); if(next) records.set(key,next); return structuredClone(records.get(key)); },
  };
}
const authFactory = async store => ({async getAuth(_provider, options) { const credential = await store.read('openai-codex',options); return {auth:{apiKey:credential?.access}}; }});

test('cache TTL, force, cloning and concurrent request coalescing', async () => {
  let now=0, calls=0; const cache=new HostUsageCache({now:()=>now,ttlMs:60});
  const gate=deferred(), request={identity:'one',load:async()=>{calls++;await gate.promise;return {n:1};}};
  const first=cache.read('a',request), second=cache.read('a',{...request,force:true}); gate.resolve();
  const [a,b]=await Promise.all([first,second]); assert.equal(calls,1); a.n=8; assert.equal(b.n,1);
  assert.equal((await cache.read('a',request)).n,1); now=61; await cache.read('a',request); assert.equal(calls,2);
  await cache.read('a',{...request,force:true}); assert.equal(calls,3); cache.dispose();
});
test('cache sanitizes failures, applies cooldown even to force and bounds Retry-After', async () => {
  let now=0,calls=0; const cache=new HostUsageCache({now:()=>now,cooldownMs:5});
  const request={identity:'one',force:true,load:async()=>{calls++;throw new Error('secret-token');}};
  await assert.rejects(cache.read('a',request), /temporarily unavailable/);
  await assert.rejects(cache.read('a',request), /temporarily unavailable/); assert.equal(calls,1);
  now=6; await assert.rejects(cache.read('a',request)); assert.equal(calls,2);
  const retry={identity:'one',load:async()=>{throw new UsageError('usage/unavailable',undefined,999999999);}};
  await assert.rejects(cache.read('b',retry)); assert.equal(cache.entries.get('b').retryAt,300006); cache.dispose();
});
test('identity replacement rejects late results and cache hits recheck identity', async () => {
  const cache=new HostUsageCache(), old=deferred(); let current='old';
  const first=cache.read('a',{identity:'old',isCurrent:async()=>current==='old',load:()=>old.promise});
  await Promise.resolve(); current='new';
  assert.equal(await cache.read('a',{identity:'new',load:async()=>2}),2); old.resolve(1);
  await assert.rejects(first, /changed|cancelled/);
  await assert.rejects(cache.read('a',{identity:'new',load:async()=>3,isCurrent:async()=>false}), /changed/); cache.dispose();
});
test('consumer cancellation does not cancel other readers; disposal aborts loaders', async () => {
  const cache=new HostUsageCache(), gate=deferred(), abort=new AbortController(); let upstream;
  const request={identity:'one',load:async signal=>{upstream=signal;await gate.promise;return 1;}};
  const a=cache.read('a',{...request,signal:abort.signal}),b=cache.read('a',request);
  abort.abort(); await assert.rejects(a,/cancelled/); assert.equal(upstream.aborted,false); gate.resolve(); assert.equal(await b,1);
  const late=deferred(); const c=cache.read('b',{identity:'one',load:async signal=>{upstream=signal;await late.promise;return 2;}});
  await Promise.resolve(); cache.dispose(); assert.equal(upstream.aborted,true);late.resolve();await assert.rejects(c);
  await assert.rejects(cache.read('a',request),/cancelled/);
});
test('Codex parser normalizes windows and rejects malformed data, excludes all raw fields', () => {
  const parsed=parseCodexUsage({...quota,access_token:'should-not-pass'},1000);
  assert.deepEqual(parsed,{rateLimits:[{id:'codex',name:'Codex',windows:[{usedPercent:12,remainingPercent:88,windowSeconds:18000,resetsAt:11}]}],fetchedAt:1000});
  for(const invalid of [null,[],{rate_limit:[]},{rate_limit:{primary_window:{used_percent:101,limit_window_seconds:2}}},{additional_rate_limits:{}}]) assert.throws(()=>parseCodexUsage(invalid));
  const extras=parseCodexUsage({...quota,additional_rate_limits:[{metered_feature:'codex',rate_limit:quota.rate_limit},{metered_feature:'spark',limit_name:'Spark',rate_limit:quota.rate_limit}]});
  assert.deepEqual(extras.rateLimits.map(x=>x.id),['codex','spark']);
});
test('Codex uses current scoped records, trusted HTTP headers, selected route and independent cache', async () => {
  const creds=credentials(); creds.records.set('other/account-other',{kind:'grant',payload:{secret:'not-codex'}});
  let calls=0; const cache=new HostUsageCache();
  const adapter=new CodexUsageAdapter({credentials:creds,cache,authFactory,fetch:async(url,options)=>{
    calls++; assert.equal(url,CODEX_USAGE_URL); assert.equal(options.headers.authorization,'Bearer secret-access');
    assert.equal(options.headers['chatgpt-account-id'],'account-id');assert.equal(options.redirect,'error');return Response.json(quota);
  }});
  const value=await adapter.read({provider});assert.equal(value.rows[0].active,true);assert.equal(value.signedOut,false);
  assert.equal(value.accounts[0].provider,provider);assert.ok(value.rows[0].usage.rateLimits.length);
  assert.doesNotMatch(JSON.stringify(value),/secret-access|secret-refresh|account-id/);
  await adapter.read({provider});assert.equal(calls,1);await adapter.read({provider,force:true});assert.equal(calls,2);
  creds.records.delete(key);const removed=await adapter.read({provider});assert.equal(removed.signedOut,true);assert.deepEqual(removed.rows,[]);
  adapter.dispose();cache.dispose();
});
test('Codex refresh persists through the credential owner record lock without losing metadata', async () => {
  const creds=credentials();let updates=0;const cache=new HostUsageCache();
  const adapter=new CodexUsageAdapter({credentials:creds,cache,authFactory:async store=>({async getAuth(){
    const c=await store.modify('openai-codex',async current=>{updates++;return {...current,access:'renewed-access',refresh:'renewed-refresh'};});return {auth:{apiKey:c.access}};
  }}),fetch:async(_url,options)=>{assert.equal(options.headers.authorization,'Bearer renewed-access');return Response.json(quota);}});
  await adapter.read({provider});assert.equal(updates,1);assert.equal(creds.records.get(key).payload.label,'first');
  assert.equal(creds.records.get(key).payload.email,'a@example.com');assert.equal(creds.records.get(key).payload.credential.refresh,'renewed-refresh');
  adapter.dispose();cache.dispose();
});
test('Codex sign-out racing an upstream response never restores a removed account', async () => {
  const creds=credentials(), gate=deferred(), started=deferred(),cache=new HostUsageCache();
  const adapter=new CodexUsageAdapter({credentials:creds,cache,authFactory,fetch:async()=>{started.resolve();await gate.promise;return Response.json(quota);}});
  const reading=adapter.read({provider});await started.promise;creds.records.delete(key);gate.resolve();
  await assert.rejects(reading,/changed/);assert.deepEqual((await adapter.read({provider})).rows,[]);adapter.dispose();cache.dispose();
});
test('Codex HTTP and parsing errors are generic row failures and obey force cooldown', async () => {
  const creds=credentials(),cache=new HostUsageCache();let calls=0;
  const adapter=new CodexUsageAdapter({credentials:creds,cache,authFactory,fetch:async()=>{calls++;return new Response('secret-access', {status:401});}});
  await assert.rejects(adapter.read({provider}),error=>error.code==='usage/auth-required'&&!error.message.includes('secret-access'));
  await assert.rejects(adapter.read({provider,force:true}));assert.equal(calls,1);
  adapter.dispose();cache.dispose();
});
test('Capinfo exact source schema supports finite and unlimited quotas only', () => {
  assert.equal(parseCapinfoBalance(balance).remaining,12.25);
  assert.equal(parseCapinfoBalance({...balance,unlimited_quota:true,balance:null,total:null}).unlimited,true);
  for(const changes of [{source:'account'},{unit:'USD'},{used:'87.75'},{used:Infinity},{is_active:'true'},{balance:null},{unlimited_quota:true}]) assert.throws(()=>parseCapinfoBalance({...balance,...changes}));
});
test('Capinfo config uses live owner profile and validates origin before credential lookup', () => {
  const values={settings:{describe:()=>[{ns:'include:capinfo-models',value:{baseURL:'https://api.capinfo.com.cn/custom',balanceDemo:true}}]},
    storageDomain:{get:()=>({global:{get:()=>({profile:{apiKeyEnv:'CUSTOM_KEY'}})}})}};
  const ctx={get:key=>values[key]};assert.deepEqual(capinfoRoute(ctx),{url:'https://api.capinfo.com.cn/custom/user/balance',keyRef:'CUSTOM_KEY'});
  for(const baseURL of ['http://api.capinfo.com.cn/v1','https://evil.test/v1','https://api.capinfo.com.cn:123/v1','https://user@api.capinfo.com.cn/v1','https://api.capinfo.com.cn/v1?x=1']){
    values.settings.describe=()=>[{ns:'include:capinfo-models',value:{baseURL}}];assert.throws(()=>capinfoRoute(ctx));
  }
});
test('Capinfo directly queries current key, shares cache, clears on removal and blocks late key responses', async () => {
  const creds=credentials(),cache=new HostUsageCache();let calls=0;const route=()=>({url:'https://api.capinfo.com.cn/v1/user/balance',keyRef:'CAPINFO_API_KEY'});
  const adapter=new CapinfoUsageAdapter({credentials:creds,cache,route,fetch:async(url,options)=>{calls++;assert.equal(url,route().url);assert.equal(options.headers.Authorization,`Bearer ${creds.token}`);assert.equal(options.headers['User-Agent'],'cc-switch/1.0');return Response.json(balance);}});
  assert.equal((await adapter.read({})).data.remaining,12.25);await adapter.read({});assert.equal(calls,1);
  creds.token='';assert.equal((await adapter.read({})).status,'unconfigured');creds.token='capinfo-secret';await adapter.read({});assert.equal(calls,2);
  const gate=deferred(),started=deferred();adapter.fetch=async()=>{started.resolve();await gate.promise;return Response.json(balance);};
  const late=adapter.read({force:true});await started.promise;creds.token='new-secret';gate.resolve();await assert.rejects(late,/changed/);
  adapter.dispose();cache.dispose();
});
test('Capinfo 404 is not simulated and upstream arbitrary errors are not leaked', async () => {
  const creds=credentials(),cache=new HostUsageCache();const adapter=new CapinfoUsageAdapter({credentials:creds,cache,
    route:()=>({url:'https://api.capinfo.com.cn/v1/user/balance',keyRef:'CAPINFO_API_KEY'}),fetch:async()=>new Response('capinfo-secret',{status:404})});
  await assert.rejects(adapter.read({}),error=>error.code==='usage/not-available'&&!error.message.includes('secret'));
  adapter.dispose();cache.dispose();
});
test('DeepSeek uses owner lifecycle, exact wallet arithmetic and identity-aware shared cache', async () => {
  const cache=new HostUsageCache();let token='first',calls=0;const client={version:'0.2.2-rc.1',locale:'zh-CN',timezoneOffsetSeconds:28800};
  const account={getPlatformSession:async()=>token?{origin:'https://platform.deepseek.com',token,userId:'id'}:null,
    getBalance:async actual=>{calls++;assert.deepEqual(actual,client);return {status:'ready',value:[{currency:'CNY',balance:'0.10'}],bonusWallets:[{currency:'CNY',balance:'0.20'}]};}};
  const adapter=new DeepSeekUsageAdapter({account,cache,now:()=>123});
  assert.deepEqual(await adapter.read({client}),{totals:[{currency:'CNY',amount:'0.30'}],recharge:[{currency:'CNY',amount:'0.10'}],bonus:[{currency:'CNY',amount:'0.20'}],updatedAt:123});
  await adapter.read({client});assert.equal(calls,1);token='next';await adapter.read({client});assert.equal(calls,2);
  token=null;assert.deepEqual(await adapter.read({client}),{signedOut:true});cache.dispose();
});
test('RPC validates provider/kind/payload, sanitizes unknown failures and registers authenticated intercept only', async () => {
  assert.deepEqual(inject,['connection','credentials']);let route,disposed=false;const cleanups=[];
  const ctx={credentials:credentials(),get:()=>undefined,effect:fn=>cleanups.push(fn()),connection:{fetch:{register(value){route=value;return ()=>{disposed=true;};}}}};
  apply(ctx);assert.equal(route.path,'/api/plugins/usage/read');
  for(const payload of [null,[],{}, {kind:'capinfo',provider:'evil'}, {kind:'codex',provider:'openai-codex'}, {kind:'capinfo',provider:'capinfo',force:'true'}, {kind:'capinfo',provider:'capinfo',apiKey:'secret'}]){
    assert.equal((await (await route.fetch(new Request('http://localhost/api/plugins/usage/read',{method:'POST',body:JSON.stringify(payload)}))).json()).error.code,'usage/invalid-request');
  }
  assert.throws(()=>validateUsageRequest({kind:'deepseek',provider:'deepseek-account',client:{version:'bad\n',locale:'en',timezoneOffsetSeconds:0}}));
  const host=createUsageHost(ctx,{route:()=>{throw new Error('credential-secret');}});
  const failure=await host.dispatch('usage/read',{kind:'capinfo',provider:'capinfo'});assert.equal(failure.ok,false);assert.doesNotMatch(JSON.stringify(failure),/credential-secret/);host.dispose();
  for(const dispose of cleanups)dispose();assert.equal(disposed,true);
});
