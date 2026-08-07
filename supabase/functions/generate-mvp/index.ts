declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type MvpPlan = {
  ideaId: string;
  ideaTitle: string;
  summary: string;
  mustHaveFeatures: { name: string; description: string }[];
  laterFeatures: { name: string; description: string }[];
  screens: { name: string; purpose: string; wireframe: string[] }[];
  schedule: { period: string; goal: string; tasks: string[] }[];
  teamRoles: { role: string; responsibilities: string[] }[];
  apis: { name: string; purpose: string; method: string }[];
  presentationOrder: string[];
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const defaultClaudeModel = 'claude-haiku-4-5-20251001';
const anthropicVersion = '2023-06-01';
const mvpToolName = 'record_mvp_plan';

const systemInstruction = `당신은 대학생 팀 프로젝트의 B 역할인 AI MVP 생성기입니다.

전체 제품 흐름은 다음과 같습니다.
아이디어 수집·정리 → AI 비교·코칭 → 최종 아이디어 선정 → MVP 기획 → 발표자료

당신은 앞 단계에서 선정된 아이디어와 프로젝트 조건을 받아, 다음 발표 자료 생성 단계가 바로 활용할 수 있는 현실적인 MVP 계획을 작성합니다.

팀의 기본 작업 영역은 다음과 같습니다.
1. 아이디어 추출·마인드맵: 회의록·채팅·이미지에서 아이디어 추출, 수정·저장·선택, 마인드맵, 최종 통합
2. AI Project Coach: 기간·인원·기술 수준·예산·평가 기준, 구현 가능성 비교, 위험·개선 방향, 추천과 최종 선정
3. AI MVP 생성기: 필수·추후 기능, 화면·와이어프레임, 일정, 역할, API, 발표 순서
4. AI 발표 자료 생성: 슬라이드·대본·예상 Q&A·사업계획서·최종 보고서·문서 내보내기

다음 원칙을 반드시 지키세요.
- mustHaveFeatures에는 제한된 기간 안에 전체 흐름을 시연하는 데 꼭 필요한 기능만 넣으세요.
- laterFeatures에는 고도화, 익명 터치·스와이프 평가, 품질 개선처럼 핵심 검증 이후로 미룰 수 있는 기능을 넣으세요.
- screens는 사용자가 실제로 거치는 순서로 구성하고, wireframe에는 화면의 위에서 아래 순서대로 주요 UI 블록을 적으세요.
- schedule은 입력된 기간 안에서 구현, 기능 연결, 통합 테스트, 오류 수정, 발표 준비까지 끝나도록 작성하세요.
- teamRoles는 입력된 팀 규모를 고려하되, 위 네 작업 영역의 담당과 최종 통합 책임이 빠지지 않게 배분하세요.
- apis에는 실제 구현에 필요한 연동만 적으세요. 특정 공급자가 입력에 없으면 임의의 유료 서비스명을 단정하지 말고 일반적인 API 종류로 표현하세요.
- presentationOrder는 문제 정의에서 시작해 선정 근거, MVP 범위, 화면 흐름, 일정·역할, 기대 효과로 자연스럽게 이어지게 하세요.
- 입력에 없는 성과, 조사 결과, 시장 수치 또는 완료된 기능을 만들어내지 마세요.
- 모든 결과는 간결하고 실행 가능한 한국어로 작성하세요.`;

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ideaId: { type: 'string' },
    ideaTitle: { type: 'string' },
    summary: { type: 'string' },
    mustHaveFeatures: {
      type: 'array',
      description: 'MVP에 꼭 필요한 기능 3~8개',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['name', 'description'],
      },
    },
    laterFeatures: {
      type: 'array',
      description: '핵심 검증 이후로 미룰 기능 1~8개',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['name', 'description'],
      },
    },
    screens: {
      type: 'array',
      description: '사용자 흐름 순서로 정리한 화면 4~10개',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          purpose: { type: 'string' },
          wireframe: {
            type: 'array',
            description: '화면 위에서 아래 순서의 주요 UI 블록 3~7개',
            items: { type: 'string' },
          },
        },
        required: ['name', 'purpose', 'wireframe'],
      },
    },
    schedule: {
      type: 'array',
      description: '입력된 개발 기간 안에서 나눈 일정 1~16개',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          period: { type: 'string' },
          goal: { type: 'string' },
          tasks: {
            type: 'array',
            description: '해당 기간에 완료할 작업 2~6개',
            items: { type: 'string' },
          },
        },
        required: ['period', 'goal', 'tasks'],
      },
    },
    teamRoles: {
      type: 'array',
      description: '팀 규모에 맞춘 역할 2~8개',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string' },
          responsibilities: {
            type: 'array',
            description: '담당 역할의 책임 2~6개',
            items: { type: 'string' },
          },
        },
        required: ['role', 'responsibilities'],
      },
    },
    apis: {
      type: 'array',
      description: '실제 구현에 필요한 API 1~10개',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          purpose: { type: 'string' },
          method: { type: 'string', enum: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] },
        },
        required: ['name', 'purpose', 'method'],
      },
    },
    presentationOrder: {
      type: 'array',
      description: '발표 흐름에 맞춘 순서 6~10개',
      items: { type: 'string' },
    },
  },
  required: [
    'ideaId',
    'ideaTitle',
    'summary',
    'mustHaveFeatures',
    'laterFeatures',
    'screens',
    'schedule',
    'teamRoles',
    'apis',
    'presentationOrder',
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanStringArray(value: unknown, maxItems: number, maxItemLength = 300) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => cleanString(item, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeIdea(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const idea = {
    id: cleanString(value.id, 120),
    title: cleanString(value.title, 200),
    description: cleanString(value.description, 3000),
    targetUsers: cleanString(value.targetUsers, 1000),
  };

  return idea.id && idea.title ? idea : null;
}

function normalizeConditions(value: unknown) {
  const conditions = isRecord(value) ? value : {};
  return {
    durationWeeks: Math.max(1, Math.min(52, Math.round(Number(conditions.durationWeeks) || 6))),
    teamSize: Math.max(1, Math.min(20, Math.round(Number(conditions.teamSize) || 4))),
    skillLevel: cleanString(conditions.skillLevel, 100) || '초급~중급',
    budget: Math.max(0, Math.min(1_000_000_000, Number(conditions.budget) || 0)),
    evaluationCriteria: cleanStringArray(conditions.evaluationCriteria, 20),
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function hasItemCount(value: unknown[], minimum: number, maximum: number) {
  return value.length >= minimum && value.length <= maximum;
}

function isNamedDescription(value: unknown) {
  return isRecord(value) && typeof value.name === 'string' && typeof value.description === 'string';
}

function isMvpPlan(value: unknown, ideaId: string): value is MvpPlan {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.ideaId === ideaId &&
    typeof value.ideaTitle === 'string' &&
    typeof value.summary === 'string' &&
    Array.isArray(value.mustHaveFeatures) &&
    hasItemCount(value.mustHaveFeatures, 3, 8) &&
    value.mustHaveFeatures.every(isNamedDescription) &&
    Array.isArray(value.laterFeatures) &&
    hasItemCount(value.laterFeatures, 1, 8) &&
    value.laterFeatures.every(isNamedDescription) &&
    Array.isArray(value.screens) &&
    hasItemCount(value.screens, 4, 10) &&
    value.screens.every(
      (screen) =>
        isRecord(screen) &&
        typeof screen.name === 'string' &&
        typeof screen.purpose === 'string' &&
        isStringArray(screen.wireframe) &&
        hasItemCount(screen.wireframe, 3, 7),
    ) &&
    Array.isArray(value.schedule) &&
    hasItemCount(value.schedule, 1, 16) &&
    value.schedule.every(
      (item) =>
        isRecord(item) &&
        typeof item.period === 'string' &&
        typeof item.goal === 'string' &&
        isStringArray(item.tasks) &&
        hasItemCount(item.tasks, 2, 6),
    ) &&
    Array.isArray(value.teamRoles) &&
    hasItemCount(value.teamRoles, 2, 8) &&
    value.teamRoles.every(
      (item) =>
        isRecord(item) &&
        typeof item.role === 'string' &&
        isStringArray(item.responsibilities) &&
        hasItemCount(item.responsibilities, 2, 6),
    ) &&
    Array.isArray(value.apis) &&
    hasItemCount(value.apis, 1, 10) &&
    value.apis.every(
      (item) =>
        isRecord(item) &&
        typeof item.name === 'string' &&
        typeof item.purpose === 'string' &&
        typeof item.method === 'string',
    ) &&
    isStringArray(value.presentationOrder) &&
    hasItemCount(value.presentationOrder, 6, 10)
  );
}

async function validateUser(authorization: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return false;
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey: supabaseAnonKey },
    });
    return response.ok;
  } catch {
    return false;
  }
}

function getClaudeToolInput(responseBody: unknown) {
  if (!isRecord(responseBody) || !Array.isArray(responseBody.content)) {
    return null;
  }

  const toolUse = responseBody.content.find(
    (block) => isRecord(block) && block.type === 'tool_use' && block.name === mvpToolName,
  );

  return isRecord(toolUse) && isRecord(toolUse.input) ? toolUse.input : null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed', message: 'POST 요청만 지원합니다.' }, 405);
  }

  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ') || !(await validateUser(authorization))) {
    return jsonResponse({ error: 'unauthorized', message: '로그인이 필요합니다.' }, 401);
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_body', message: '요청 내용을 확인해주세요.' }, 400);
  }

  if (!isRecord(requestBody)) {
    return jsonResponse({ error: 'invalid_body', message: '요청 내용을 확인해주세요.' }, 400);
  }

  const selectedIdeaId = cleanString(requestBody.selectedIdeaId, 120);
  const idea = normalizeIdea(requestBody.idea);
  const projectConditions = normalizeConditions(requestBody.projectConditions);
  if (!selectedIdeaId || !idea || idea.id !== selectedIdeaId) {
    return jsonResponse({ error: 'invalid_idea', message: '선정 아이디어가 올바르지 않습니다.' }, 400);
  }

  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? Deno.env.get('CLAUDE_API_KEY');
  if (!anthropicApiKey) {
    return jsonResponse({ error: 'missing_anthropic_key', message: 'AI 생성 설정을 확인해주세요.' }, 500);
  }

  const claudeModel = Deno.env.get('ANTHROPIC_MODEL') ?? defaultClaudeModel;
  const prompt = JSON.stringify({
    selectedIdeaId,
    idea,
    projectConditions,
    requiredRules: {
      ideaIdMustEqual: selectedIdeaId,
      scheduleMustFitWeeks: projectConditions.durationWeeks,
      rolesShouldFitTeamSize: projectConditions.teamSize,
      outputLanguage: 'Korean',
    },
  });

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 50_000);
  let anthropicResponse: Response;

  try {
    anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': anthropicVersion,
      },
      body: JSON.stringify({
        model: claudeModel,
        max_tokens: 5000,
        system: systemInstruction,
        messages: [{ role: 'user', content: prompt }],
        tools: [
          {
            name: mvpToolName,
            description: '앱에서 사용할 실행 가능한 MVP 계획을 기록합니다.',
            strict: true,
            input_schema: responseSchema,
          },
        ],
        tool_choice: { type: 'tool', name: mvpToolName },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return jsonResponse(
      {
        error: timedOut ? 'ai_timeout' : 'network_error',
        message: timedOut
          ? 'AI 요청 시간이 초과되었습니다. 다시 시도해주세요.'
          : 'AI 서버에 연결하지 못했습니다.',
      },
      timedOut ? 504 : 502,
    );
  } finally {
    globalThis.clearTimeout(timeout);
  }

  if (!anthropicResponse.ok) {
    let errorBody = '';
    try {
      errorBody = await anthropicResponse.text();
    } catch {
      // Ignore response parsing failures while logging the status.
    }
    console.error('Anthropic API returned an error status.', {
      status: anthropicResponse.status,
      body: errorBody.slice(0, 500),
    });

    if (anthropicResponse.status === 401) {
      return jsonResponse({ error: 'anthropic_unauthorized', message: 'AI API 키를 확인해주세요.' }, 500);
    }
    if (anthropicResponse.status === 403) {
      return jsonResponse({ error: 'anthropic_forbidden', message: '현재 AI 모델을 사용할 수 없습니다.' }, 502);
    }
    if (anthropicResponse.status === 404) {
      return jsonResponse({ error: 'anthropic_model_not_found', message: '설정된 AI 모델을 찾을 수 없습니다.' }, 502);
    }
    if (anthropicResponse.status === 429) {
      return jsonResponse({ error: 'anthropic_rate_limited', message: 'AI 사용량이 많습니다. 잠시 후 다시 시도해주세요.' }, 503);
    }
    if (anthropicResponse.status === 400) {
      return jsonResponse({ error: 'anthropic_bad_request', message: 'AI 요청 형식을 처리하지 못했습니다.' }, 502);
    }
    return jsonResponse({ error: 'anthropic_error', message: 'AI MVP 계획 생성에 실패했습니다.' }, 502);
  }

  let anthropicBody: unknown;
  try {
    anthropicBody = await anthropicResponse.json();
  } catch {
    return jsonResponse({ error: 'invalid_ai_response', message: 'AI 응답을 해석하지 못했습니다.' }, 502);
  }

  const mvpPlan = getClaudeToolInput(anthropicBody);
  if (!isMvpPlan(mvpPlan, selectedIdeaId)) {
    return jsonResponse({ error: 'invalid_ai_response', message: 'AI MVP 계획 형식이 올바르지 않습니다.' }, 502);
  }

  return jsonResponse(mvpPlan);
});
