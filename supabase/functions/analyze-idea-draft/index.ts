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
  title: string;
  content: string;
  category: string;
  status: string;
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const analysisToolName = 'record_idea_draft_analysis';
const parseErrorMessage = '진단 결과를 불러오지 못했습니다. 다시 시도해주세요.';

const systemInstruction = `당신은 대학생의 과제 및 팀 프로젝트 아이디어 초안을 진단하는 보조 AI입니다.
사용자가 아이디어를 등록하기 전에 제목과 내용을 보고 더 명확하게 다듬을 수 있도록 도와주세요.

다음 기준으로 진단하세요.

1. 제목이 아이디어의 핵심을 구체적으로 드러내는지
2. 내용에 목적, 대상, 해결하려는 문제, 실행 방법이 충분히 담겼는지
3. 과제나 팀 프로젝트에서 바로 논의할 수 있을 만큼 범위가 적절한지
4. 다음 단계로 확인해야 할 질문이 무엇인지

입력에 없는 사실이나 기능을 임의로 만들어내지 마세요.
사용자가 등록을 계속할 수 있도록 간결하고 실행 가능한 한국어 피드백을 작성하세요.
비판은 부드럽게 표현하되, 보완점은 구체적으로 제시하세요.`;

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: '아이디어 핵심 요약' },
    titleFeedback: { type: 'string', description: '제목에 대한 진단과 개선 방향' },
    contentFeedback: { type: 'string', description: '내용에 대한 진단과 개선 방향' },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    improvements: {
      type: 'array',
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

function normalizeIdea(value: unknown): IdeaDraftInput | { error: string; status: number } {
  if (!isRecord(value)) {
    return { error: 'idea must be an object.', status: 400 };
  }

  const idea = {
    title: cleanString(value.title, 160),
    content: cleanString(value.content, 3000),
    category: cleanString(value.category, 80),
    status: cleanString(value.status, 80),
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
  if (!isAnalysisResult(analysis)) {
    console.error('DeepSeek tool input did not match draft analysis schema.');
    return jsonResponse({ error: 'invalid_analysis_shape', message: parseErrorMessage }, 502);
  }

  return jsonResponse(analysis);
});
