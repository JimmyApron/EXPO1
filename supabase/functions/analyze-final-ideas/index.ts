import {
  anthropicApiVersion,
  deepSeekMessagesUrl,
  resolveDeepSeekModel,
  withDeepSeekToolInstruction,
} from '../_shared/deepseek.ts';
import {
  normalizeFinalIdeaAnalysis,
  type FinalIdeaInput,
} from '../_shared/final-idea-analysis.ts';

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const maxIdeas = 10;
const analysisToolName = 'record_final_idea_analysis';
const defaultNotice = 'AI 분석 결과는 최종 결정을 돕기 위한 참고 자료입니다.';
const parseErrorMessage = '분석 결과를 불러오지 못했습니다. 다시 시도해주세요.';

const systemInstruction = `IMPORTANT: Use ideaId values only in the structured analyses.ideaId and overall.recommendedIdeaIds fields. Never expose, quote, abbreviate, or reference an ideaId in any user-visible narrative field (summary, strengths, risks, improvements, comparison, recommendationReason, or combinationSuggestion). Refer to ideas by their title only.

당신은 대학생의 과제 및 팀 프로젝트 아이디어를 분석하는 보조 AI입니다.
입력된 각 아이디어를 독립적으로 분석한 뒤, 전체 아이디어를 서로 비교하세요.

각 아이디어에 대해 다음 내용을 작성하세요.

1. 핵심 내용 요약
2. 주요 장점
3. 예상 위험과 실패 가능성
4. 구체적인 개선 제안
5. 현재 개발 기간과 난이도를 고려한 실현 가능성
6. 과제 또는 프로젝트 목적과의 적합성

그다음 전체 아이디어를 비교하여 다음 내용을 작성하세요.

1. 아이디어 사이의 주요 차이점
2. 최종 후보로 추천할 아이디어
3. 해당 아이디어를 추천한 이유
4. 여러 아이디어를 결합할 수 있는 방법

아이디어가 하나뿐이면 억지로 비교하지 말고 구체화, 위험 분석, 개선안을 중심으로 작성하세요.

입력에 없는 사실이나 기능을 임의로 만들어내지 마세요.
최종 결정은 사용자가 하므로 단정적으로 명령하지 말고
‘추천합니다’, ‘고려할 수 있습니다’와 같은 보조적인 표현을 사용하세요.
모든 결과는 자연스럽고 이해하기 쉬운 한국어로 작성하세요.
분석은 간결하게 작성하고, 각 항목은 너무 길지 않게 제한하세요.
analyses에는 입력된 모든 아이디어를 정확히 한 번씩 포함하고, ideaId는 입력값을 그대로 사용하세요.
summary, strengths, risks, improvements와 overall의 모든 항목을 비워 두지 마세요.`;

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    analyses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ideaId: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string', description: '아이디어 핵심 내용 요약' },
          strengths: {
            type: 'array',
            items: { type: 'string' },
          },
          risks: {
            type: 'array',
            items: { type: 'string' },
          },
          improvements: {
            type: 'array',
            items: { type: 'string' },
          },
          feasibility: { type: 'string', enum: ['높음', '보통', '낮음'] },
          projectFit: { type: 'string', enum: ['높음', '보통', '낮음'] },
        },
        required: ['ideaId', 'title', 'summary', 'strengths', 'risks', 'improvements', 'feasibility', 'projectFit'],
      },
    },
    overall: {
      type: 'object',
      additionalProperties: false,
      properties: {
        comparison: { type: 'string' },
        recommendedIdeaIds: {
          type: 'array',
          items: { type: 'string' },
        },
        recommendationReason: { type: 'string' },
        combinationSuggestion: { type: 'string' },
      },
      required: ['comparison', 'recommendedIdeaIds', 'recommendationReason', 'combinationSuggestion'],
    },
    notice: {
      type: 'string',
      enum: [defaultNotice],
    },
  },
  required: ['analyses', 'overall', 'notice'],
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

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeIdeas(value: unknown): FinalIdeaInput[] | { error: string; status: number } {
  if (!Array.isArray(value)) {
    return { error: 'ideas must be an array.', status: 400 };
  }

  const ideas = value
    .filter(isRecord)
    .map((idea) => ({
      ideaId: cleanString(idea.ideaId),
      title: cleanString(idea.title),
      content: cleanString(idea.content),
      category: cleanString(idea.category),
      status: cleanString(idea.status),
    }))
    .filter((idea) => idea.ideaId && (idea.title || idea.content));

  if (ideas.length === 0) {
    return { error: 'No final ideas to analyze.', status: 400 };
  }

  if (ideas.length > maxIdeas) {
    return { error: `At most ${maxIdeas} ideas can be analyzed at once.`, status: 400 };
  }

  return ideas;
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

  for (let index = responseBody.content.length - 1; index >= 0; index -= 1) {
    const block = responseBody.content[index];
    if (isRecord(block) && block.type === 'tool_use' && block.name === analysisToolName && isRecord(block.input)) {
      return block.input;
    }
  }

  return null;
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

  if (!isRecord(requestBody) || !cleanString(requestBody.projectId)) {
    return jsonResponse({ error: 'invalid_project', message: '과제 정보를 확인해주세요.' }, 400);
  }

  const ideas = normalizeIdeas(requestBody.ideas);
  if (!Array.isArray(ideas)) {
    return jsonResponse({ error: 'invalid_ideas', message: ideas.error }, ideas.status);
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

  const promptData = {
    projectId: cleanString(requestBody.projectId),
    projectConditions: isRecord(requestBody.projectConditions) ? requestBody.projectConditions : {},
    ideas,
    expectedAnalysisCount: ideas.length,
    requiredIdeaIds: ideas.map((idea) => idea.ideaId),
    outputNotice: defaultNotice,
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = JSON.stringify({
      ...promptData,
      retryInstruction:
        attempt === 0
          ? undefined
          : '이전 응답이 비어 있거나 필수 항목을 누락했습니다. 모든 아이디어와 모든 필드를 실제 분석 내용으로 채우세요.',
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
          max_tokens: 4096,
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
              description: 'Record a complete, non-empty final idea analysis result for the app.',
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
      console.error('DeepSeek request failed before response.', { attempt: attempt + 1 });
      if (attempt === 0) {
        continue;
      }
      return jsonResponse({ error: 'network_error', message: 'AI 분석 요청에 실패했습니다. 다시 시도해주세요.' }, 502);
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

      if (deepSeekResponse.status === 400) {
        return jsonResponse(
          { error: 'deepseek_bad_request', message: 'DeepSeek API 요청 형식을 확인해주세요.' },
          502,
        );
      }

      return jsonResponse({ error: 'deepseek_error', message: 'AI 분석 요청에 실패했습니다. 다시 시도해주세요.' }, 502);
    }

    let deepSeekBody: unknown;
    try {
      deepSeekBody = await deepSeekResponse.json();
    } catch {
      console.error('DeepSeek response was not JSON.', { attempt: attempt + 1 });
      continue;
    }

    const analysisInput = getDeepSeekToolInput(deepSeekBody);
    const analysis = normalizeFinalIdeaAnalysis(analysisInput, ideas, defaultNotice);
    if (analysis) {
      return jsonResponse(analysis);
    }

    console.error('DeepSeek tool input was incomplete.', { attempt: attempt + 1 });
  }

  return jsonResponse({ error: 'invalid_analysis_shape', message: parseErrorMessage }, 502);
});
