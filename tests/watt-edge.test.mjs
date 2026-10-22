import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.Deno = { env: { get: key => ({ SUPABASE_URL: 'https://test.example', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' })[key] } };
const { withWattUsage } = await import('../supabase/functions/_shared/watt-usage.ts');
const projectId='20000000-0000-0000-0000-000000000001';
const requestId='30000000-0000-0000-0000-000000000001';
const request=() => new Request('https://test.example/functions/v1/generate-mvp', {
  method:'POST', headers:{ authorization:'Bearer user-token','content-type':'application/json','x-watt-request-id':requestId },
  body:JSON.stringify({projectId,idea:{title:'idea'}}),
});

test('settlement retries HTTP failures and replays the saved result without another provider call', async () => {
  const original=globalThis.fetch;
  let state='new', settlementAttempts=0, providerCalls=0;
  try {
    globalThis.fetch=async (url,options) => {
      if (String(url).includes('/auth/v1/user')) return Response.json({id:'10000000-0000-0000-0000-000000000001'});
      if (String(url).includes('watt_reserve_usage')) {
        const body=JSON.parse(options.body);
        assert.equal(body.p_feature,'generate-mvp');
        assert.equal(body.p_units,2);
        return Response.json(state==='new'
          ? {usage_id:'40000000-0000-0000-0000-000000000001',state:'reserved',usage_kind:'subscription_free',units:0}
          : {usage_id:'40000000-0000-0000-0000-000000000001',state:'succeeded',response_status:200,response_body:'{"plan":true}'});
      }
      if (String(url).includes('watt_settle_usage')) {
        settlementAttempts++;
        if (settlementAttempts<3) return Response.json({error:'temporary'}, {status:500});
        state='done'; return Response.json({state:'succeeded'});
      }
      throw new Error('unexpected fetch');
    };
    const execute=async()=>{ providerCalls++; return Response.json({plan:true}); };
    const first=await withWattUsage(request(),'generate-mvp',execute);
    assert.equal(first.status,200);
    assert.deepEqual(await first.json(),{plan:true});
    const replay=await withWattUsage(request(),'generate-mvp',execute);
    assert.equal(replay.status,200);
    assert.deepEqual(await replay.json(),{plan:true});
    assert.equal(settlementAttempts,3);
    assert.equal(providerCalls,1);
  } finally { globalThis.fetch=original; }
});

test('failed settlement never re-enters the provider for the same reserved request', async () => {
  const original=globalThis.fetch;
  let providerCalls=0, reservations=0;
  try {
    globalThis.fetch=async url => {
      if (String(url).includes('/auth/v1/user')) return Response.json({id:'10000000-0000-0000-0000-000000000001'});
      if (String(url).includes('watt_reserve_usage')) {
        reservations++;
        return Response.json({usage_id:'40000000-0000-0000-0000-000000000002',state:'reserved',
          ...(reservations===1 ? {usage_kind:'subscription_free'} : {})});
      }
      if (String(url).includes('watt_settle_usage')) return Response.json({error:'unavailable'},{status:503});
      throw new Error('unexpected fetch');
    };
    const execute=async()=>{ providerCalls++; return Response.json({plan:true}); };
    assert.equal((await withWattUsage(request(),'generate-mvp',execute)).status,503);
    assert.equal((await withWattUsage(request(),'generate-mvp',execute)).status,409);
    assert.equal(providerCalls,1);
  } finally { globalThis.fetch=original; }
});
