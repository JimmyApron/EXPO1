import assert from 'node:assert/strict';
import test from 'node:test';
let handler;
const originalDeno = globalThis.Deno;
globalThis.Deno = { env: { get: key => ({ SUPABASE_URL: 'https://test.example', SUPABASE_ANON_KEY: 'test-anon', SUPABASE_SERVICE_ROLE_KEY: 'test-service', DEEPSEEK_API_KEY: 'test-provider' })[key] }, serve: value => { handler = value; } };
await import('../supabase/functions/workspace-assistant/index.ts');
const projectId = '20000000-0000-0000-0000-000000000001';
const request = (task = 'topics', context = {}, auth = true) => new Request('http://localhost/workspace-assistant', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer test-only-token' } : {}) }, body: JSON.stringify({ projectId, task, context }) });

test('workspace AI enforces auth and project access before contacting a provider', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async url => { calls++; if (String(url).includes('/auth/')) return Response.json({id:'user'}); return String(url).includes('watt_reserve_usage') ? Response.json({ usage_id: 'usage-id' }) : Response.json([]); };
    assert.equal((await handler(request('topics', {}, false))).status, 401); assert.equal(calls, 0);
    assert.equal((await handler(request())).status, 403); assert.equal(calls, 5);
  } finally { globalThis.fetch = originalFetch; }
});
test('URL-only research cannot be summarized or compared as if its original was read', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  try {
    globalThis.fetch = async url => {
      if (String(url).includes('/auth/')) return Response.json({ id: 'user' });
      if (String(url).includes('watt_reserve_usage')) return Response.json({ usage_id: 'usage-id' });
      if (String(url).includes('watt_settle_usage')) return Response.json({ state: 'refunded' });
      if (String(url).includes('/rest/')) return Response.json([{ id: projectId, template: 'report_research' }]);
      providerCalls++; throw new Error('should not call provider');
    };
    const response = await handler(request('resource', { resource: { url: 'https://example.com', content: '' } }));
    assert.equal(response.status, 400); assert.ok((await response.json()).message.includes('원문을 읽지 못했습니다'));
    assert.equal((await handler(request('compare', { resources: [{ content: '본문' }, { url: 'https://example.com' }] }))).status, 400);
    assert.equal(providerCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});
test('AI returns reviewable structured proposals and rejects malformed output', async () => {
  const originalFetch = globalThis.fetch;
  let malformed = false;
  const result = { text: '구체화 제안', resultText: '', suggestions: [{ title: '주제 후보', text: '후보 설명', original: '', reason: '구체화', kind: '주제' }], outline: [], slides: [], qna: '' };
  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('/auth/')) return Response.json({ id: 'user' });
      if (String(url).includes('watt_reserve_usage')) return Response.json({ usage_id: 'usage-id' });
      if (String(url).includes('watt_settle_usage')) return Response.json({ state: 'succeeded' });
      if (String(url).includes('/rest/')) return Response.json([{ id: projectId, template: 'writing_creative' }]);
      const payload = JSON.parse(options.body);
      assert.equal(payload.tool_choice.name, 'record_workspace_assistance');
      assert.ok(payload.system.includes('원문을 읽지 못했다고'));
      return Response.json({ content: [{ type: 'tool_use', name: 'record_workspace_assistance', input: malformed ? { text: '불완전' } : result }] });
    };
    const response = await handler(request()); assert.equal(response.status, 200); assert.deepEqual(await response.json(), result);
    malformed = true; assert.equal((await handler(request())).status, 502);
  } finally { globalThis.fetch = originalFetch; }
});
test('direct editing requests use resultText and retry metadata once within one usage reservation', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0, reservations = 0, settlements = 0;
  const responses = [
    { text: '조사 목적을 구체화하는 방향으로 다듬었습니다.', resultText: '', suggestions: [], outline: [], slides: [], qna: '' },
    { text: '본 조사는 일회용품 사용 실태와 주요 사용 원인을 살펴보고, 사용 과정에서 발생하는 환경 문제를 분석하는 것을 목적으로 한다.', resultText: '', suggestions: [], outline: [], slides: [], qna: '' },
  ];
  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('/auth/')) return Response.json({ id: 'user' });
      if (String(url).includes('watt_reserve_usage')) { reservations++; return Response.json({ usage_id: 'usage-id' }); }
      if (String(url).includes('watt_settle_usage')) { settlements++; return Response.json({ state: 'succeeded' }); }
      if (String(url).includes('/rest/')) return Response.json([{ id: projectId, title: '보고서', template: 'report_research', settings: {} }]);
      const payload = JSON.parse(options.body); providerCalls++;
      assert.ok(payload.system.includes('resultText에 적용 가능한 최종 문장·문단만'));
      if (providerCalls === 2) assert.ok(payload.system.includes('응답은 결과물이 아니라 작업 설명'));
      assert.equal(JSON.parse(payload.messages[0].content).context.selection, '본 조사는 사용 실태를 파악한다.');
      return Response.json({ content: [{ type: 'tool_use', name: 'record_workspace_assistance', input: responses.shift() }] });
    };
    const response = await handler(request('expand', { selection: '본 조사는 사용 실태를 파악한다.', body: '앞 문단\n본 조사는 사용 실태를 파악한다.\n뒤 문단', settings: { writingKind: 'essay' } }));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.resultText, '본 조사는 일회용품 사용 실태와 주요 사용 원인을 살펴보고, 사용 과정에서 발생하는 환경 문제를 분석하는 것을 목적으로 한다.');
    assert.equal(result.text, result.resultText);
    assert.equal(providerCalls, 2);
    assert.equal(reservations, 1);
    assert.equal(settlements, 1);
  } finally { globalThis.fetch = originalFetch; }
});
test.after(() => { globalThis.Deno = originalDeno; });
