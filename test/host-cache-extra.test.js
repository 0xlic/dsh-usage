import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {HostUsageCache} from '../host-cache.js';
import {CodexUsageAdapter} from '../host-codex.js';

test('failed forced refresh clears formerly fresh success after cooldown', async () => {
  let now=0, calls=0, fail=false;
  const cache=new HostUsageCache({now:()=>now,ttlMs:1000,cooldownMs:10});
  const read={identity:'a',load:async()=>{calls++;if(fail)throw new Error('fail');return calls;}};
  assert.equal(await cache.read('a',read),1);fail=true;
  await assert.rejects(cache.read('a',{...read,force:true}));
  now=11;fail=false;assert.equal(await cache.read('a',read),3);cache.dispose();
});
test('hung owner service is bounded, enters cooldown, and does not poison future loads', async () => {
  let now=0;const cache=new HostUsageCache({now:()=>now,timeoutMs:5,cooldownMs:10});
  await Promise.all([assert.rejects(cache.read('a',{identity:'a',load:()=>new Promise(()=>{})}),/cancelled/),delay(15)]);
  await assert.rejects(cache.read('a',{identity:'a',load:async()=>2}));now=11;
  assert.equal(await cache.read('a',{identity:'a',load:async()=>2}),2);cache.dispose();
});
test('installed public pi-ai Codex auth lifecycle reads the current owner grant without ambient credentials', async () => {
  const id=`account-${'c'.repeat(32)}`;
  const credential={type:'oauth',access:'local-test-access',refresh:'local-test-refresh',expires:Date.now()+3600000,accountId:'local-test-account'};
  const creds={listRecords:async()=>[{key:`codex-subscribe/${id}`,kind:'grant'}],
    readRecord:async()=>({kind:'grant',payload:{version:2,label:'test',credential}})};
  const cache=new HostUsageCache();let calls=0;
  const adapter=new CodexUsageAdapter({credentials:creds,cache,fetch:async(_url,options)=>{
    calls++;assert.equal(options.headers.authorization,'Bearer local-test-access');
    return Response.json({rate_limit:{primary_window:{used_percent:1,limit_window_seconds:18000}}});
  }});
  try {
    const result=await adapter.read({provider:`codex-sub-${'c'.repeat(32)}`});
    assert.equal(result.rows[0].usage.rateLimits[0].windows[0].usedPercent,1);assert.equal(calls,1);
  } finally {adapter.dispose();cache.dispose();}
});

test('Codex lists independent accounts but queries only selected live provider', async () => {
  const ids=[`account-${'a'.repeat(32)}`,`account-${'b'.repeat(32)}`];
  const records=new Map(ids.map((id,i)=>[`codex-subscribe/${id}`,{kind:'grant',payload:{version:2,label:`account${i}`,credential:{type:'oauth',access:`access${i}`,refresh:`refresh${i}`,expires:9999999999999,accountId:`remote${i}`}}}]));
  const creds={listRecords:async()=>[...records.keys()].map(key=>({key,kind:'grant'})),readRecord:async key=>structuredClone(records.get(key))};
  let calls=0;const cache=new HostUsageCache();
  const adapter=new CodexUsageAdapter({credentials:creds,cache,authFactory:async store=>({getAuth:async()=>({auth:{apiKey:(await store.read('openai-codex')).access}})}),
    fetch:async(_url,options)=>{calls++;assert.equal(options.headers.authorization,'Bearer access0');return Response.json({rate_limit:{primary_window:{used_percent:10,limit_window_seconds:18000}}});}});
  const result=await adapter.read({provider:`codex-sub-${'a'.repeat(32)}`});
  assert.equal(result.accounts.length,2);assert.equal(result.rows.length,1);assert.equal(calls,1);
  adapter.dispose();cache.dispose();
});
