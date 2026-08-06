declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Response | Promise<Response>): void };

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const claudeModel = 'claude-sonnet-5';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ message: 'POST 요청만 지원합니다.' }, 405);

  const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
  if (!claudeApiKey) return json({ message: 'CLAUDE_API_KEY Secret이 설정되지 않았습니다.' }, 500);

  try {
    const { selectedIdeaId, idea } = await request.json();
    if (selectedIdeaId !== 'idea-001' || idea?.id !== selectedIdeaId) return json({ message: '선정 아이디어가 올바르지 않습니다.' }, 400);

    const prompt = `다음 아이디어를 실제 3주 MVP 계획으로 만들어 주세요. 반드시 한국어 JSON만 반환하세요.\n${JSON.stringify(idea)}\n필드: ideaId, ideaTitle, summary, mustHaveFeatures[{name,description}], laterFeatures[{name,description}], screens[{name,purpose,wireframe:string[]}], schedule[{period,goal,tasks:string[]}], teamRoles[{role,responsibilities:string[]}], apis[{name,purpose,method}], presentationOrder:string[]`;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': claudeApiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: claudeModel, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
    });
    const payload = await response.json();
    if (!response.ok) return json({ message: 'Claude API 호출에 실패했습니다.' }, 502);
    const text = payload?.content?.find((block: { type?: string }) => block.type === 'text')?.text;
    if (typeof text !== 'string') return json({ message: 'Claude 응답 형식이 올바르지 않습니다.' }, 502);
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    return json(JSON.parse(cleaned));
  } catch {
    return json({ message: 'MVP 계획 생성 중 오류가 발생했습니다.' }, 500);
  }
});
