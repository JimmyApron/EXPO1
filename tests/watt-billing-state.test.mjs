import assert from 'node:assert/strict';
import test from 'node:test';

let handler;
globalThis.Deno = {
  env: { get: key => ({ SUPABASE_URL: 'https://test.example', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' })[key] },
  serve: callback => { handler = callback; },
};
await import('../supabase/functions/watt-billing/index.ts');

test('billing state reports exact Korea-day personal and team usage from server counts', async () => {
  const original = globalThis.fetch;
  const user = '10000000-0000-0000-0000-000000000001';
  const room = '20000000-0000-0000-0000-000000000001';
  const now = new Date().toISOString();
  const entitlement = (id, roomId) => ({ id, room_id: roomId, state: 'active', trial: false, ends_at: new Date(Date.now() + 86400000).toISOString() });
  const requests = [];
  try {
    globalThis.fetch = async (url, options = {}) => {
      const path = String(url);
      if (path.includes('/auth/v1/user')) return Response.json({ id: user });
      if (path.includes('/rpc/watt_balance')) {
        const roomId = JSON.parse(options.body).p_room_id;
        return Response.json({ server_now: now, total: roomId ? 70 : 10,
          entitlements: [entitlement(roomId ? 'team-id' : 'personal-id', roomId)] });
      }
      if (path.includes('/roommembers')) return Response.json([{ id: 'member-id' }]);
      if (path.includes('/watt_trials')) return Response.json([]);
      if (path.includes('/watt_usage')) {
        assert.equal(options.method, 'HEAD');
        const query = new URL(path).searchParams;
        requests.push(query);
        const count = query.get('room_id') === `eq.${room}` ? (query.has('user_id') ? 4 : 26) : 7;
        return new Response(null, { headers: { 'content-range': `*/${count}` } });
      }
      throw new Error(`Unexpected request: ${path}`);
    };
    const response = await handler(new Request('https://test.example/functions/v1/watt-billing', {
      method: 'POST', headers: { authorization: 'Bearer token' }, body: JSON.stringify({ action: 'state', roomId: room }),
    }));
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.deepEqual([data.personal.textUsage.todayUsed, data.personal.textUsage.dailyLimit], [7, 40]);
    assert.deepEqual([data.team.textUsage.todayUsed, data.team.textUsage.dailyLimit], [26, 120]);
    assert.deepEqual([data.team.textUsage.memberUsed, data.team.textUsage.memberLimit], [4, 40]);
    assert.equal(requests.length, 3);
    assert.ok(requests.every(query => query.get('usage_kind') === 'eq.subscription_free'
      && query.get('state') === 'in.(reserved,succeeded)' && query.has('created_at')));
    assert.equal(new Date(data.team.textUsage.resetsAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul', hour12: false }), '00:00:00');
  } finally { globalThis.fetch = original; }
});

test('billing state reports the trial total separately from its daily limit', async () => {
  const original = globalThis.fetch;
  const user = '10000000-0000-0000-0000-000000000001';
  try {
    globalThis.fetch = async (url, options = {}) => {
      const path = String(url);
      if (path.includes('/auth/v1/user')) return Response.json({ id: user });
      if (path.includes('/rpc/watt_balance')) return Response.json({ server_now: new Date().toISOString(), total: 20,
        entitlements: [{ id: 'trial-id', room_id: null, state: 'active', trial: true,
          ends_at: new Date(Date.now() + 86400000).toISOString() }] });
      if (path.includes('/watt_trials')) return Response.json([{ id: 'trial-id' }]);
      if (path.includes('/watt_usage')) {
        const query = new URL(path).searchParams;
        assert.equal(query.get('usage_kind'), 'eq.trial_free');
        return new Response(null, { headers: { 'content-range': `*/${query.has('entitlement_id') ? 17 : 6}` } });
      }
      throw new Error(`Unexpected request: ${path}`);
    };
    const response = await handler(new Request('https://test.example/functions/v1/watt-billing', {
      method: 'POST', headers: { authorization: 'Bearer token' }, body: JSON.stringify({ action: 'state' }),
    }));
    const { data } = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual([data.personal.textUsage.todayUsed, data.personal.textUsage.dailyLimit,
      data.personal.textUsage.trialUsed, data.personal.textUsage.trialLimit], [6, 10, 17, 25]);
  } finally { globalThis.fetch = original; }
});

test('billing state blocks another room before exposing team usage', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async url => {
      const path = String(url);
      if (path.includes('/auth/v1/user')) return Response.json({ id: '10000000-0000-0000-0000-000000000001' });
      if (path.includes('/rpc/watt_balance')) return Response.json({ total: 12, entitlements: [] });
      if (path.includes('/roommembers')) return Response.json([]);
      throw new Error(`Team usage was requested without membership: ${path}`);
    };
    const response = await handler(new Request('https://test.example/functions/v1/watt-billing', {
      method: 'POST', headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ action: 'state', roomId: '20000000-0000-0000-0000-000000000001' }),
    }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, 'room_access_denied');
  } finally { globalThis.fetch = original; }
});
