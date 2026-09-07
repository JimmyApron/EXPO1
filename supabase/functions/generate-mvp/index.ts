import {
  anthropicApiVersion,
  deepSeekMessagesUrl,
  resolveDeepSeekModel,
  withDeepSeekToolInstruction,
} from '../_shared/deepseek.ts';
import { normalizeMvpPlan } from '../_shared/mvp-plan.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const mvpToolName = 'record_mvp_plan';

const systemInstruction = `당신은 대학생 팀 프로젝트를 위한 AI MVP 기획자입니다.
입력으로 받은 단 하나의 선정 아이디어와 프로젝트 조건만 기준으로 현실적인 MVP 계획을 작성하세요.

다음 원칙을 반드시 지키세요.
- idea의 problem, solution, targetUsers, coreFeatures를 우선 사용하고 description은 보조 맥락으로만 사용하세요.
- mustHaveFeatures에는 제한된 기간 안에 아이디어의 핵심 가설을 검증하는 데 꼭 필요한 기능만 넣으세요.
- mustHaveFeatures와 apis의 각 항목에는 effort를 반드시 포함하세요. difficulty는 초급/중급/고급 중 하나, requiredSkills는 CRUD·인증·OCR·외부 API·데이터 모델링·배포 등 실제 필요한 역량, estimatedWeeks는 양수인 주 단위 예상 작업량(예: 0.5, 1, 2), beginnerComment는 비전공자/초급 팀의 선행 학습·위험·범위 축소 대안을 구체적으로 적으세요.
- 예상 작업량은 초급 개발자 1명이 주 10시간 참여하며 학습·구현·연동·테스트하는 기준입니다. 기능과 API의 중복 작업은 합산하지 않도록 설명하고, 입력 팀 규모·기간으로 어렵다면 그 이유와 대안을 코멘트에 명시하세요. 추정치를 보장된 일정처럼 표현하지 마세요.
- laterFeatures에는 핵심 검증 이후로 미룰 수 있는 고도화 기능만 넣으세요. 적절한 기능이 없으면 빈 배열도 허용됩니다.
- screens는 사용자가 실제로 거치는 순서로 구성하고, wireframe에는 화면의 위에서 아래 순서대로 주요 UI 블록을 적으세요.
- schedule은 입력된 기간 안에서 구현, 기능 연결, 통합 테스트, 오류 수정, 발표 준비까지 끝나도록 작성하세요.
- teamRoles는 입력된 팀 규모 안에서 역할을 배분하세요. 한 사람이 여러 책임을 맡을 수 있습니다.
- apis에는 이 아이디어 구현에 실제로 필요한 연동만 적으세요. 외부 API가 필요하지 않으면 빈 배열로 작성하세요.
- presentationOrder는 문제 정의, 대상 사용자, 해결 방식, MVP 범위, 화면 흐름, 일정·역할, 기대 효과 순으로 자연스럽게 구성하세요.
- 입력된 아이디어와 무관한 마인드맵, 아이디어 평가, 발표자료 생성 기능을 임의로 포함하지 마세요.
- 입력에 없는 성과, 조사 결과, 시장 수치 또는 완료된 기능을 만들어내지 마세요.
- 모든 결과는 간결하고 실행 가능한 한국어로 작성하세요.`;

const effortSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    difficulty: { type: 'string', enum: ['초급', '중급', '고급'] },
    requiredSkills: { type: 'array', items: { type: 'string' } },
    estimatedWeeks: { type: 'number', exclusiveMinimum: 0, maximum: 104 },
    beginnerComment: { type: 'string' },
  },
  required: ['difficulty', 'requiredSkills', 'estimatedWeeks', 'beginnerComment'],
};

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
          effort: effortSchema,
        },
        required: ['name', 'description', 'effort'],
      },
    },
    laterFeatures: {
      type: 'array',
      description: '핵심 검증 이후로 미룰 기능 0~8개. 없으면 빈 배열',
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
      description: '실제 구현에 필요한 API 0~10개. 없으면 빈 배열',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          purpose: { type: 'string' },
          method: { type: 'string', enum: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] },
          effort: effortSchema,
        },
        required: ['name', 'purpose', 'method', 'effort'],
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
    problem: cleanString(value.problem, 2000),
    solution: cleanString(value.solution, 2000),
    coreFeatures: cleanStringArray(value.coreFeatures, 20),
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

function getDeepSeekToolInput(responseBody: unknown) {
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

  const deepSeekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!deepSeekApiKey) {
    return jsonResponse({ error: 'missing_deepseek_key', message: 'DeepSeek API 설정을 확인해주세요.' }, 500);
  }

  const deepSeekModel = resolveDeepSeekModel(Deno.env.get('DEEPSEEK_MODEL'));
  if (!deepSeekModel) {
    return jsonResponse(
      { error: 'invalid_deepseek_model', message: 'DeepSeek V4 Flash 또는 DeepSeek V4 Pro 모델만 사용할 수 있습니다.' },
      500,
    );
  }
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
  let deepSeekResponse: Response;

  try {
    deepSeekResponse = await fetch(deepSeekMessagesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': deepSeekApiKey,
        'anthropic-version': anthropicApiVersion,
      },
      body: JSON.stringify({
        model: deepSeekModel,
        max_tokens: 5000,
        thinking: { type: 'disabled' },
        system: withDeepSeekToolInstruction(systemInstruction, mvpToolName),
        messages: [{ role: 'user', content: prompt }],
        tools: [
          {
            name: mvpToolName,
            description: '앱에서 사용할 실행 가능한 MVP 계획을 기록합니다.',
            input_schema: responseSchema,
          },
        ],
        tool_choice: {
          type: 'tool',
          name: mvpToolName,
        },
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

  if (!deepSeekResponse.ok) {
    let errorBody = '';
    try {
      errorBody = await deepSeekResponse.text();
    } catch {
      // Ignore response parsing failures while logging the status.
    }
    console.error('DeepSeek API returned an error status.', {
      status: deepSeekResponse.status,
      body: errorBody.slice(0, 500),
    });

    if (deepSeekResponse.status === 401) {
      return jsonResponse({ error: 'deepseek_unauthorized', message: 'DeepSeek API 키를 확인해주세요.' }, 500);
    }
    if (deepSeekResponse.status === 403) {
      return jsonResponse({ error: 'deepseek_forbidden', message: '현재 DeepSeek 모델을 사용할 수 없습니다.' }, 502);
    }
    if (deepSeekResponse.status === 404) {
      return jsonResponse({ error: 'deepseek_model_not_found', message: '설정된 DeepSeek 모델을 찾을 수 없습니다.' }, 502);
    }
    if (deepSeekResponse.status === 429) {
      return jsonResponse({ error: 'deepseek_rate_limited', message: 'AI 사용량이 많습니다. 잠시 후 다시 시도해주세요.' }, 503);
    }
    if (deepSeekResponse.status === 400) {
      return jsonResponse({ error: 'deepseek_bad_request', message: 'AI 요청 형식을 처리하지 못했습니다.' }, 502);
    }
    return jsonResponse({ error: 'deepseek_error', message: 'AI MVP 계획 생성에 실패했습니다.' }, 502);
  }

  let deepSeekBody: unknown;
  try {
    deepSeekBody = await deepSeekResponse.json();
  } catch {
    return jsonResponse({ error: 'invalid_ai_response', message: 'AI 응답을 해석하지 못했습니다.' }, 502);
  }

  const mvpPlan = normalizeMvpPlan(getDeepSeekToolInput(deepSeekBody), idea);
  if (!mvpPlan || [...mvpPlan.mustHaveFeatures, ...mvpPlan.apis].some((item) => !item.effort)) {
    console.error('DeepSeek MVP tool input did not contain usable core sections.');
    return jsonResponse({ error: 'invalid_ai_response', message: 'AI MVP 계획 형식이 올바르지 않습니다.' }, 502);
  }

  return jsonResponse(mvpPlan);
});
