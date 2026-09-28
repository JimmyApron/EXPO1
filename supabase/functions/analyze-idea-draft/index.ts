import {
  anthropicApiVersion,
  deepSeekMessagesUrl,
  resolveDeepSeekModel,
  withDeepSeekToolInstruction,
} from '../_shared/deepseek.ts';

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type IdeaDraftInput = {
  analysisMode: 'draft_clarity' | 'problem_solution';
  title: string;
  content: string;
  category: string;
  status: string;
  summary: string;
  problem: string;
  targetUsers: string[];
  solution: string;
  keywords: string[];
  coreFeatures: string[];
};

type IdeaDraftAnalysisLevel = '높음' | '보통' | '낮음';

type IdeaDraftAnalysisResult = {
  summary: string;
  titleFeedback: string;
  contentFeedback: string;
  strengths: string[];
  improvements: string[];
  nextQuestions: string[];
  readiness: IdeaDraftAnalysisLevel;
  notice: string;
};

type BlindIdeaAnalysisResult = Pick<IdeaDraftAnalysisResult, 'strengths' | 'improvements' | 'readiness'>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const analysisToolName = 'record_idea_draft_analysis';
const parseErrorMessage = '진단 결과를 불러오지 못했습니다. 다시 시도해주세요.';

const problemSolutionInstruction = `당신은 대학생 팀 프로젝트 아이디어의 문제-해결 적합성을 검토합니다.
이 결과는 익명 평가 카드의 'AI 장점'과 'AI 리스크'에 바로 표시됩니다.

- problem, solution, targetUsers, coreFeatures만 우선 근거로 삼고 content와 summary는 빠진 맥락을 확인할 때만 보조로 사용하세요.
- 먼저 해결 방식이 문제를 직접 줄이는 이유, 사용자가 얻는 변화, 작동을 위해 꼭 참이어야 하는 가정만 판단하세요.
- strengths는 서로 겹치지 않는 핵심 장점 정확히 2개만 작성하세요. 기능을 다시 설명하지 말고 문제와 해결 방식이 맞물려 생기는 효과를 쓰세요.
- improvements는 가장 치명적인 실패 가능성 정확히 1개만 작성하세요. 대응책, 검증 방법, 부연 설명을 이어 붙이지 마세요.
- strengths와 improvements의 각 항목은 한 가지 주장만 담아 공백 포함 40자 이내의 음슴체로 쓰고 마침표는 붙이지 마세요.
- 권장 종결 예시는 '줄일 수 있음', '확인하기 쉬움', '채택 유인이 약함', '운영 부담이 큼'입니다.
- 입력에 근거 없는 경쟁 서비스 비교, 법적 판단, 수치, 사용자 반응, 성과를 만들지 마세요.
- 아이디어끼리 비교·추천·순위를 매기거나 맞춤법, 문장 길이, 제목 같은 글쓰기 품질을 평가하지 마세요.
- 근거가 부족하면 막연한 칭찬 대신 확인되지 않은 핵심 가정을 리스크로 쓰세요.

입력에 없는 사실을 만들지 말고 카드에 표시할 세 문구 외의 진단이나 조언은 작성하지 마세요.`;

const draftClarityInstruction = `당신은 대학생의 과제 및 팀 프로젝트 아이디어 초안을 진단합니다.
등록 전에 제목, 내용, 범위와 다음 질문을 명확하게 다듬도록 도와주세요.
가능하면 문제의 타당성과 해결 방식의 적합성을 우선하세요.

입력에 없는 사실, 성과, 사용자 반응이나 기능을 임의로 만들어내지 마세요.
모든 결과는 반복 없이 간결하고 실행 가능한 자연스러운 한국어로 작성하세요.`;

const draftResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: '아이디어 핵심 요약' },
    titleFeedback: { type: 'string', description: '제목에 대한 진단과 개선 방향' },
    contentFeedback: { type: 'string', description: '내용에 대한 진단과 개선 방향' },
    strengths: {
      type: 'array',
      description: 'problem_solution이면 서로 다른 장점 정확히 2개, 각 40자 이내 음슴체',
      items: { type: 'string' },
    },
    improvements: {
      type: 'array',
      description: 'problem_solution이면 가장 큰 리스크 정확히 1개, 40자 이내 음슴체',
      items: { type: 'string' },
    },
    nextQuestions: {
      type: 'array',
      items: { type: 'string' },
    },
    readiness: { type: 'string', enum: ['높음', '보통', '낮음'] },
    notice: {
      type: 'string',
      enum: ['AI 진단 결과는 아이디어 등록 전 보완을 돕기 위한 참고 자료입니다.'],
    },
  },
  required: [
    'summary',
    'titleFeedback',
    'contentFeedback',
    'strengths',
    'improvements',
    'nextQuestions',
    'readiness',
    'notice',
  ],
};

const blindResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    strengths: {
      type: 'array',
      description: '서로 다른 핵심 장점 정확히 2개, 각 40자 이내 음슴체',
      items: { type: 'string' },
    },
    improvements: {
      type: 'array',
      description: '가장 큰 리스크 정확히 1개, 40자 이내 음슴체',
      items: { type: 'string' },
    },
    readiness: { type: 'string', enum: ['높음', '보통', '낮음'] },
  },
  required: ['strengths', 'improvements', 'readiness'],
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength = 4000) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function cleanStringArray(value: unknown, maxItems = 20, maxItemLength = 300) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => cleanString(item, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeIdea(value: unknown): IdeaDraftInput | { error: string; status: number } {
  if (!isRecord(value)) {
    return { error: 'idea must be an object.', status: 400 };
  }

  const idea = {
    analysisMode: value.analysisMode === 'problem_solution' ? 'problem_solution' as const : 'draft_clarity' as const,
    title: cleanString(value.title, 160),
    content: cleanString(value.content, 3000),
    category: cleanString(value.category, 80),
    status: cleanString(value.status, 80),
    summary: cleanString(value.summary, 1000),
    problem: cleanString(value.problem, 2000),
    targetUsers: cleanStringArray(value.targetUsers),
    solution: cleanString(value.solution, 2000),
    keywords: cleanStringArray(value.keywords),
    coreFeatures: cleanStringArray(value.coreFeatures),
  };

  if (!idea.title || !idea.content) {
    return { error: 'Title and content are required.', status: 400 };
  }

  return idea;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAnalysisLevel(value: unknown): value is IdeaDraftAnalysisLevel {
  return value === '높음' || value === '보통' || value === '낮음';
}

function isAnalysisResult(value: unknown): value is IdeaDraftAnalysisResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.summary === 'string' &&
    typeof value.titleFeedback === 'string' &&
    typeof value.contentFeedback === 'string' &&
    isStringArray(value.strengths) &&
    isStringArray(value.improvements) &&
    isStringArray(value.nextQuestions) &&
    isAnalysisLevel(value.readiness) &&
    value.notice === 'AI 진단 결과는 아이디어 등록 전 보완을 돕기 위한 참고 자료입니다.'
  );
}

function isBlindAnalysisResult(value: unknown): value is BlindIdeaAnalysisResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isStringArray(value.strengths) &&
    value.strengths.length === 2 &&
    isStringArray(value.improvements) &&
    value.improvements.length === 1 &&
    isAnalysisLevel(value.readiness)
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
      headers: {
        Authorization: authorization,
        apikey: supabaseAnonKey,
      },
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
    (block) => isRecord(block) && block.type === 'tool_use' && block.name === analysisToolName,
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
    return jsonResponse({ error: 'invalid_body', message: '요청 본문을 확인해주세요.' }, 400);
  }

  if (!isRecord(requestBody) || !cleanString(requestBody.projectId, 120)) {
    return jsonResponse({ error: 'invalid_project', message: '과제 정보를 확인해주세요.' }, 400);
  }

  const idea = normalizeIdea(requestBody.idea);
  if (!isRecord(idea) || 'error' in idea) {
    return jsonResponse({ error: 'invalid_idea', message: idea.error }, idea.status);
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
    projectId: cleanString(requestBody.projectId, 120),
    idea,
    outputNotice: 'AI 진단 결과는 아이디어 등록 전 보완을 돕기 위한 참고 자료입니다.',
  });
  const isBlindAnalysis = idea.analysisMode === 'problem_solution';
  const systemInstruction = isBlindAnalysis ? problemSolutionInstruction : draftClarityInstruction;
  const responseSchema = isBlindAnalysis ? blindResponseSchema : draftResponseSchema;

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
        max_tokens: 2048,
        thinking: { type: 'disabled' },
        system: withDeepSeekToolInstruction(systemInstruction, analysisToolName),
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        tools: [
          {
            name: analysisToolName,
            description: 'Record the idea draft analysis result for the app.',
            input_schema: responseSchema,
          },
        ],
        tool_choice: {
          type: 'tool',
          name: analysisToolName,
        },
      }),
    });
  } catch {
    console.error('DeepSeek request failed before response.');
    return jsonResponse({ error: 'network_error', message: 'AI 진단 요청에 실패했습니다. 다시 시도해주세요.' }, 502);
  }

  if (!deepSeekResponse.ok) {
    let errorBody = '';
    try {
      errorBody = await deepSeekResponse.text();
    } catch {
      errorBody = '';
    }

    console.error('DeepSeek API returned an error status.', {
      status: deepSeekResponse.status,
      body: errorBody.slice(0, 500),
    });

    if (deepSeekResponse.status === 401) {
      return jsonResponse(
        { error: 'deepseek_unauthorized', message: 'DeepSeek API 키가 유효하지 않습니다. Supabase DEEPSEEK_API_KEY를 확인해주세요.' },
        500,
      );
    }

    if (deepSeekResponse.status === 429) {
      return jsonResponse(
        { error: 'deepseek_rate_limited', message: 'DeepSeek API 사용량 또는 결제 한도를 확인해주세요.' },
        502,
      );
    }

    return jsonResponse({ error: 'deepseek_error', message: 'AI 진단 요청에 실패했습니다. 다시 시도해주세요.' }, 502);
  }

  let deepSeekBody: unknown;
  try {
    deepSeekBody = await deepSeekResponse.json();
  } catch {
    console.error('DeepSeek response was not JSON.');
    return jsonResponse({ error: 'invalid_deepseek_response', message: parseErrorMessage }, 502);
  }

  const analysis = getDeepSeekToolInput(deepSeekBody);
  const isValidAnalysis = isBlindAnalysis ? isBlindAnalysisResult(analysis) : isAnalysisResult(analysis);
  if (!isRecord(analysis) || !isValidAnalysis) {
    console.error('DeepSeek tool input did not match draft analysis schema.');
    return jsonResponse({ error: 'invalid_analysis_shape', message: parseErrorMessage }, 502);
  }

  return jsonResponse(analysis);
});
