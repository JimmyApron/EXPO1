declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type CandidateIdea = {
  id: string;
  title: string;
  summary: string;
  problem: string;
  targetUsers: string[];
  solution: string;
  keywords: string[];
  coreFeatures: string[];
};

type ImageInput = {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  data: string;
};

type ExtractSource = { type: 'text'; text: string } | { type: 'image'; images: ImageInput[] };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const maxRequestCharacters = 29_000_000;
const maxTextLength = 30_000;
const maxImages = 3;
const maxImageBytes = 8 * 1024 * 1024;
const maxCandidates = 8;
const anthropicVersion = '2023-06-01';
const toolName = 'record_candidate_ideas';

const systemInstruction = `당신은 한국어 회의록과 채팅에서 실행 가능한 프로젝트 아이디어를 추출하는 분석 도우미입니다.
입력에 명시된 문제, 사용자 요구, 해결책, 기능만 근거로 사용하세요. 입력에 없는 수치, 시장 사실, 일정 또는 요구를 만들지 마세요.
중복되거나 표현만 다른 아이디어는 하나로 통합하세요. 기본 출력 언어는 한국어입니다.
이미지가 제공되면 먼저 화면에 보이는 한국어 대화를 읽고 extractedText에 대화 순서대로 정리하세요.
텍스트가 제공되면 의미를 바꾸지 말고 읽기 쉽게 정리한 원문을 extractedText에 반환하세요.
추출할 만한 아이디어가 없으면 candidateIdeas를 빈 배열로 반환하세요.
각 후보의 id는 idea-001부터 순서대로 만들고 모든 필드를 채우세요. 없는 값은 빈 문자열 또는 빈 배열을 사용하세요.`;

const candidateSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    summary: { type: 'string' },
    problem: { type: 'string' },
    targetUsers: { type: 'array', items: { type: 'string' } },
    solution: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } },
    coreFeatures: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'title', 'summary', 'problem', 'targetUsers', 'solution', 'keywords', 'coreFeatures'],
};

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    extractedText: { type: 'string' },
    candidateIdeas: { type: 'array', items: candidateSchema },
  },
  required: ['extractedText', 'candidateIdeas'],
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength = 4_000) {
  return typeof value === 'string' ? value.trim().replace(/\r\n/g, '\n').slice(0, maxLength) : '';
}

function cleanStringArray(value: unknown, maxItems = 12) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  return value
    .map((item) => cleanString(item, 160))
    .filter((item) => {
      const key = item.toLocaleLowerCase();
      if (!item || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
}

function normalizeCandidates(value: unknown): CandidateIdea[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const candidates: CandidateIdea[] = [];
  value.slice(0, maxCandidates * 2).forEach((item) => {
    if (!isRecord(item)) {
      return;
    }

    const title = cleanString(item.title, 160);
    if (!title) {
      return;
    }

    const summary = cleanString(item.summary);
    const duplicateKey = `${title}\n${summary}`.toLocaleLowerCase();
    if (seen.has(duplicateKey)) {
      return;
    }
    seen.add(duplicateKey);

    candidates.push({
      id: `idea-${String(candidates.length + 1).padStart(3, '0')}`,
      title,
      summary,
      problem: cleanString(item.problem),
      targetUsers: cleanStringArray(item.targetUsers),
      solution: cleanString(item.solution),
      keywords: cleanStringArray(item.keywords),
      coreFeatures: cleanStringArray(item.coreFeatures),
    });
  });

  return candidates.slice(0, maxCandidates);
}

function estimatedBase64Bytes(data: string) {
  return Math.ceil((data.length * 3) / 4);
}

function normalizeSource(value: unknown): ExtractSource | { error: string; status: number } {
  if (!isRecord(value)) {
    return { error: 'source가 필요합니다.', status: 400 };
  }

  if (value.type === 'text') {
    const text = cleanString(value.text, maxTextLength + 1);
    if (!text) {
      return { error: '회의록 또는 채팅 내용을 입력해 주세요.', status: 400 };
    }
    if (text.length > maxTextLength) {
      return { error: `텍스트는 ${maxTextLength.toLocaleString()}자 이하로 입력해 주세요.`, status: 413 };
    }
    return { type: 'text', text };
  }

  if (value.type !== 'image' || !Array.isArray(value.images)) {
    return { error: '지원하지 않는 입력 형식입니다.', status: 400 };
  }
  if (value.images.length === 0 || value.images.length > maxImages) {
    return { error: `이미지는 1장 이상 ${maxImages}장 이하로 전송해 주세요.`, status: 400 };
  }

  const images: ImageInput[] = [];
  for (const image of value.images) {
    if (!isRecord(image)) {
      return { error: '이미지 데이터 형식이 올바르지 않습니다.', status: 400 };
    }
    const mediaType = cleanString(image.mediaType);
    const data = cleanString(image.data, 12_000_000);
    if (mediaType !== 'image/jpeg' && mediaType !== 'image/png' && mediaType !== 'image/webp') {
      return { error: 'PNG, JPEG, WebP 이미지만 지원합니다.', status: 415 };
    }
    if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      return { error: '이미지 인코딩이 올바르지 않습니다.', status: 400 };
    }
    if (estimatedBase64Bytes(data) > maxImageBytes) {
      return { error: '이미지 한 장의 크기는 8MB 이하여야 합니다.', status: 413 };
    }
    images.push({ mediaType, data });
  }

  return { type: 'image', images };
}

function normalizeProjectConditions(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const durationWeeks = typeof value.durationWeeks === 'number' && value.durationWeeks > 0 ? value.durationWeeks : undefined;
  const teamSize = typeof value.teamSize === 'number' && value.teamSize > 0 ? value.teamSize : undefined;
  const skillLevel = cleanString(value.skillLevel, 80) || undefined;
  const budget = typeof value.budget === 'number' && value.budget >= 0 ? value.budget : undefined;
  const evaluationCriteria = cleanStringArray(value.evaluationCriteria, 10);

  return { durationWeeks, teamSize, skillLevel, budget, evaluationCriteria };
}

async function getAuthenticatedUserId(authorization: string, supabaseUrl: string, apiKey: string) {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey: apiKey },
    });
    if (!response.ok) {
      return '';
    }
    const body: unknown = await response.json();
    return isRecord(body) ? cleanString(body.id, 64) : '';
  } catch {
    return '';
  }
}

async function canAccessProject(
  projectId: string,
  userId: string,
  authorization: string,
  supabaseUrl: string,
  apiKey: string,
) {
  const headers = { Authorization: authorization, apikey: apiKey };
  try {
    const projectResponse = await fetch(
      `${supabaseUrl}/rest/v1/projects?select=userid,roomid&id=eq.${projectId}&limit=1`,
      { headers },
    );
    if (!projectResponse.ok) {
      return false;
    }

    const projects: unknown = await projectResponse.json();
    if (!Array.isArray(projects) || !isRecord(projects[0])) {
      return false;
    }

    const projectOwnerId = cleanString(projects[0].userid, 64);
    const roomId = cleanString(projects[0].roomid, 64);
    if (projectOwnerId === userId) {
      return true;
    }
    if (!roomId) {
      return false;
    }

    const memberResponse = await fetch(
      `${supabaseUrl}/rest/v1/roommembers?select=id&roomid=eq.${roomId}&userid=eq.${userId}&limit=1`,
      { headers },
    );
    if (!memberResponse.ok) {
      return false;
    }
    const members: unknown = await memberResponse.json();
    return Array.isArray(members) && members.length > 0;
  } catch {
    return false;
  }
}

function getToolInput(responseBody: unknown) {
  if (!isRecord(responseBody) || !Array.isArray(responseBody.content)) {
    return null;
  }
  const toolUse = responseBody.content.find(
    (block) => isRecord(block) && block.type === 'tool_use' && block.name === toolName,
  );
  return isRecord(toolUse) && isRecord(toolUse.input) ? toolUse.input : null;
}

function buildMessageContent(source: ExtractSource, projectConditions: ReturnType<typeof normalizeProjectConditions>) {
  const conditionText = projectConditions
    ? `프로젝트 조건: ${JSON.stringify(projectConditions)}`
    : '별도의 프로젝트 조건은 없습니다.';

  if (source.type === 'text') {
    return [
      {
        type: 'text',
        text: `${conditionText}\n\n다음 원문에서 후보 아이디어를 추출하세요. 원문 시작:\n${source.text}\n원문 끝.`,
      },
    ];
  }

  const content: Record<string, unknown>[] = [];
  source.images.forEach((image, index) => {
    content.push({ type: 'text', text: `카카오톡 캡처 ${index + 1}:` });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: image.mediaType, data: image.data },
    });
  });
  content.push({
    type: 'text',
    text: `${conditionText}\n위 캡처의 한국어 대화를 순서대로 OCR하고, 그 대화에서 후보 아이디어를 추출하세요.`,
  });
  return content;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed', message: 'POST 요청만 지원합니다.' }, 405);
  }

  const authorization = request.headers.get('authorization') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const apiKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
  if (!authorization.startsWith('Bearer ') || !supabaseUrl || !apiKey) {
    return jsonResponse({ error: 'unauthorized', message: '로그인이 필요합니다.' }, 401);
  }

  const userId = await getAuthenticatedUserId(authorization, supabaseUrl, apiKey);
  if (!userId) {
    return jsonResponse({ error: 'unauthorized', message: '로그인이 만료되었습니다.' }, 401);
  }

  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    return jsonResponse({ error: 'invalid_body', message: '요청 본문을 읽지 못했습니다.' }, 400);
  }
  if (rawBody.length > maxRequestCharacters) {
    return jsonResponse({ error: 'request_too_large', message: '요청 이미지 또는 텍스트가 너무 큽니다.' }, 413);
  }

  let requestBody: unknown;
  try {
    requestBody = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'invalid_body', message: '요청 형식이 올바르지 않습니다.' }, 400);
  }
  if (!isRecord(requestBody)) {
    return jsonResponse({ error: 'invalid_body', message: '요청 형식이 올바르지 않습니다.' }, 400);
  }

  const projectId = cleanString(requestBody.projectId, 64);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    return jsonResponse({ error: 'invalid_project', message: '프로젝트 정보가 올바르지 않습니다.' }, 400);
  }
  if (!(await canAccessProject(projectId, userId, authorization, supabaseUrl, apiKey))) {
    return jsonResponse({ error: 'forbidden', message: '이 프로젝트에 접근할 권한이 없습니다.' }, 403);
  }

  const source = normalizeSource(requestBody.source);
  if ('error' in source) {
    return jsonResponse({ error: 'invalid_source', message: source.error }, source.status);
  }

  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? Deno.env.get('CLAUDE_API_KEY') ?? '';
  if (!anthropicApiKey) {
    return jsonResponse({ error: 'missing_anthropic_key', message: 'AI 분석 환경변수를 확인해 주세요.' }, 500);
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 45_000);
  let anthropicResponse: Response;
  try {
    anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': anthropicVersion,
      },
      body: JSON.stringify({
        model: Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001',
        max_tokens: 5_000,
        system: systemInstruction,
        messages: [
          {
            role: 'user',
            content: buildMessageContent(source, normalizeProjectConditions(requestBody.projectConditions)),
          },
        ],
        tools: [
          {
            name: toolName,
            description: 'Return the OCR text and normalized candidate ideas to the application.',
            strict: true,
            input_schema: responseSchema,
          },
        ],
        tool_choice: { type: 'tool', name: toolName },
      }),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    console.error(timedOut ? 'Anthropic request timed out.' : 'Anthropic request failed before response.');
    return jsonResponse(
      { error: timedOut ? 'ai_timeout' : 'network_error', message: timedOut ? 'AI 요청 시간이 초과되었습니다. 다시 시도해 주세요.' : 'AI 서버에 연결하지 못했습니다.' },
      502,
    );
  } finally {
    globalThis.clearTimeout(timeout);
  }

  if (!anthropicResponse.ok) {
    let errorBody = '';
    try {
      errorBody = await anthropicResponse.text();
    } catch {
      errorBody = '';
    }
    console.error('Anthropic API returned an error status.', {
      status: anthropicResponse.status,
      body: errorBody.slice(0, 500),
    });
    if (anthropicResponse.status === 401) {
      return jsonResponse({ error: 'anthropic_unauthorized', message: 'AI API 키를 확인해 주세요.' }, 500);
    }
    if (anthropicResponse.status === 403) {
      return jsonResponse({ error: 'anthropic_forbidden', message: '현재 API 키로 선택한 AI 모델을 사용할 수 없습니다.' }, 502);
    }
    if (anthropicResponse.status === 404) {
      return jsonResponse({ error: 'anthropic_model_not_found', message: '설정된 AI 모델을 찾을 수 없습니다.' }, 502);
    }
    if (anthropicResponse.status === 429) {
      return jsonResponse({ error: 'anthropic_rate_limited', message: 'AI 사용량이 많습니다. 잠시 후 다시 시도해 주세요.' }, 503);
    }
    if (anthropicResponse.status === 400) {
      return jsonResponse({ error: 'anthropic_invalid_request', message: 'AI 이미지 분석 요청 형식이 올바르지 않습니다.' }, 502);
    }
    return jsonResponse({ error: 'anthropic_error', message: 'AI 추출에 실패했습니다. 다시 시도해 주세요.' }, 502);
  }

  let anthropicBody: unknown;
  try {
    anthropicBody = await anthropicResponse.json();
  } catch {
    return jsonResponse({ error: 'invalid_ai_response', message: 'AI 응답을 해석하지 못했습니다.' }, 502);
  }

  const toolInput = getToolInput(anthropicBody);
  if (!toolInput || !Array.isArray(toolInput.candidateIdeas)) {
    return jsonResponse({ error: 'invalid_ai_response', message: 'AI 응답 형식이 올바르지 않습니다.' }, 502);
  }

  return jsonResponse({
    extractedText: cleanString(toolInput.extractedText, maxTextLength),
    candidateIdeas: normalizeCandidates(toolInput.candidateIdeas),
  });
});
