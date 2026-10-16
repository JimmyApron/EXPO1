import assert from 'node:assert/strict';
import test from 'node:test';
let handler;
const originalDeno = globalThis.Deno;
globalThis.Deno = { env: { get: key => ({ SUPABASE_URL: 'https://test.example', SUPABASE_ANON_KEY: 'test-anon', DEEPSEEK_API_KEY: 'test-provider' })[key] }, serve: value => { handler = value; } };
await import('../supabase/functions/workspace-assistant/index.ts');
const projectId = '20000000-0000-0000-0000-000000000001';
const request = (task = 'topics', context = {}, auth = true) => new Request('http://localhost/workspace-assistant', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer test-only-token' } : {}) }, body: JSON.stringify({ projectId, task, context }) });

test('workspace AI enforces auth and project access before contacting a provider', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return Response.json([]); };
    assert.equal((await handler(request('topics', {}, false))).status, 401); assert.equal(calls, 0);
    assert.equal((await handler(request())).status, 403); assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});
test('URL-only research cannot be summarized or compared as if its original was read', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  try {
    globalThis.fetch = async url => {
      if (String(url).includes('/auth/')) return Response.json({ id: 'user' });
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
  const result = { text: '구체화 제안', suggestions: [{ title: '주제 후보', text: '후보 설명', original: '', reason: '구체화', kind: '주제' }], outline: [], slides: [], qna: '' };
  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('/auth/')) return Response.json({ id: 'user' });
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
test.after(() => { globalThis.Deno = originalDeno; });
