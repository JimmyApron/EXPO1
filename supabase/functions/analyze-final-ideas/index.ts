declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type FinalIdeaInput = {
  ideaId: string;
  title: string;
  content: string;
  category: string;
  status: string;
};

type FinalAnalysisLevel = '높음' | '보통' | '낮음';

type FinalIdeaAnalysisResult = {
  analyses: {
    ideaId: string;
    title: string;
    summary: string;
    strengths: string[];
    improvements: string[];
    feasibility: FinalAnalysisLevel;
    projectFit: FinalAnalysisLevel;
  }[];
  overall: {
    comparison: string;
    recommendedIdeaIds: string[];
    recommendationReason: string;
    combinationSuggestion: string;
  };
  notice: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const maxIdeas = 10;
const defaultGeminiModel = 'gemini-3.1-flash-lite';
const parseErrorMessage = '분석 결과를 불러오지 못했습니다. 다시 시도해주세요.';

const systemInstruction = `당신은 대학생의 과제 및 팀 프로젝트 아이디어를 분석하는 보조 AI입니다.
입력된 각 아이디어를 독립적으로 분석한 뒤, 전체 아이디어를 서로 비교하세요.

각 아이디어에 대해 다음 내용을 작성하세요.

1. 핵심 내용 요약
2. 주요 장점
3. 구체적으로 보완해야 할 점
4. 현재 개발 기간과 난이도를 고려한 실현 가능성
5. 과제 또는 프로젝트 목적과의 적합성

그다음 전체 아이디어를 비교하여 다음 내용을 작성하세요.

1. 아이디어 사이의 주요 차이점
2. 최종 후보로 추천할 아이디어
3. 해당 아이디어를 추천한 이유
4. 여러 아이디어를 결합할 수 있는 방법

입력에 없는 사실이나 기능을 임의로 만들어내지 마세요.
최종 결정은 사용자가 하므로 단정적으로 명령하지 말고
‘추천합니다’, ‘고려할 수 있습니다’와 같은 보조적인 표현을 사용하세요.
모든 결과는 자연스럽고 이해하기 쉬운 한국어로 작성하세요.
분석은 간결하게 작성하고, 각 항목은 너무 길지 않게 제한하세요.`;

const responseSchema = {
  type: 'object',
  propertyOrdering: ['analyses', 'overall', 'notice'],
  properties: {
    analyses: {
      type: 'array',
      minItems: 1,
      maxItems: maxIdeas,
      items: {
        type: 'object',
        propertyOrdering: [
          'ideaId',
          'title',
          'summary',
          'strengths',
          'improvements',
          'feasibility',
          'projectFit',
        ],
        properties: {
          ideaId: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string', description: '아이디어 핵심 내용 요약' },
          strengths: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
          },
          improvements: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
          },
          feasibility: { type: 'string', enum: ['높음', '보통', '낮음'] },
          projectFit: { type: 'string', enum: ['높음', '보통', '낮음'] },
        },
        required: ['ideaId', 'title', 'summary', 'strengths', 'improvements', 'feasibility', 'projectFit'],
      },
    },
    overall: {
      type: 'object',
      propertyOrdering: ['comparison', 'recommendedIdeaIds', 'recommendationReason', 'combinationSuggestion'],
      properties: {
        comparison: { type: 'string' },
        recommendedIdeaIds: {
          type: 'array',
          minItems: 1,
          items: { type: 'string' },
        },
        recommendationReason: { type: 'string' },
        combinationSuggestion: { type: 'string' },
      },
      required: ['comparison', 'recommendedIdeaIds', 'recommendationReason', 'combinationSuggestion'],
    },
    notice: {
      type: 'string',
      enum: ['AI 분석 결과는 최종 결정을 돕기 위한 참고 자료입니다.'],
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAnalysisLevel(value: unknown): value is FinalAnalysisLevel {
  return value === '높음' || value === '보통' || value === '낮음';
}

function isAnalysisResult(value: unknown): value is FinalIdeaAnalysisResult {
  if (!isRecord(value) || !Array.isArray(value.analyses) || !isRecord(value.overall)) {
    return false;
  }

  const overall = value.overall;

  return (
    value.analyses.length > 0 &&
    value.analyses.every(
      (analysis) =>
        isRecord(analysis) &&
        typeof analysis.ideaId === 'string' &&
        typeof analysis.title === 'string' &&
        typeof analysis.summary === 'string' &&
        isStringArray(analysis.strengths) &&
        isStringArray(analysis.improvements) &&
        isAnalysisLevel(analysis.feasibility) &&
        isAnalysisLevel(analysis.projectFit),
    ) &&
    typeof overall.comparison === 'string' &&
    isStringArray(overall.recommendedIdeaIds) &&
    overall.recommendedIdeaIds.length > 0 &&
    typeof overall.recommendationReason === 'string' &&
    typeof overall.combinationSuggestion === 'string' &&
    value.notice === 'AI 분석 결과는 최종 결정을 돕기 위한 참고 자료입니다.'
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

function getGeminiText(responseBody: unknown) {
  if (!isRecord(responseBody) || !Array.isArray(responseBody.candidates)) {
    return '';
  }

  const candidate = responseBody.candidates[0];
  if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
    return '';
  }

  return candidate.content.parts
    .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();
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

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    return jsonResponse({ error: 'missing_gemini_key', message: 'AI 분석 설정을 확인해주세요.' }, 500);
  }

  const geminiModel = Deno.env.get('GEMINI_MODEL') || defaultGeminiModel;
  const modelPath = geminiModel.startsWith('models/') ? geminiModel : `models/${geminiModel}`;
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent`;

  const prompt = JSON.stringify({
    projectId: cleanString(requestBody.projectId),
    ideas,
    outputNotice: 'AI 분석 결과는 최종 결정을 돕기 위한 참고 자료입니다.',
  });

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
    });
  } catch {
    console.error('Gemini request failed before response.');
    return jsonResponse({ error: 'network_error', message: 'AI 분석 요청에 실패했습니다. 다시 시도해주세요.' }, 502);
  }

  if (!geminiResponse.ok) {
    console.error('Gemini API returned an error status.', { status: geminiResponse.status });
    return jsonResponse({ error: 'gemini_error', message: 'AI 분석 요청에 실패했습니다. 다시 시도해주세요.' }, 502);
  }

  let geminiBody: unknown;
  try {
    geminiBody = await geminiResponse.json();
  } catch {
    console.error('Gemini response was not JSON.');
    return jsonResponse({ error: 'invalid_gemini_response', message: parseErrorMessage }, 502);
  }

  const geminiText = getGeminiText(geminiBody);
  if (!geminiText) {
    console.error('Gemini response did not include text output.');
    return jsonResponse({ error: 'empty_gemini_response', message: parseErrorMessage }, 502);
  }

  try {
    const analysis = JSON.parse(geminiText);

    if (!isAnalysisResult(analysis)) {
      console.error('Gemini JSON did not match analysis schema.');
      return jsonResponse({ error: 'invalid_analysis_shape', message: parseErrorMessage }, 502);
    }

    return jsonResponse(analysis);
  } catch {
    console.error('Gemini text output was not valid JSON.');
    return jsonResponse({ error: 'invalid_analysis_json', message: parseErrorMessage }, 502);
  }
});
