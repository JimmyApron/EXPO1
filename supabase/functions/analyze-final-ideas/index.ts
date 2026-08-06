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
const defaultClaudeModel = 'claude-sonnet-5';
const anthropicVersion = '2023-06-01';
const analysisToolName = 'record_final_idea_analysis';
const defaultNotice = 'AI 분석 결과는 최종 결정을 돕기 위한 참고 자료입니다.';
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
  additionalProperties: false,
  properties: {
    analyses: {
      type: 'array',
      minItems: 1,
      maxItems: maxIdeas,
      items: {
        type: 'object',
        additionalProperties: false,
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
      additionalProperties: false,
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAnalysisLevel(value: unknown): value is FinalAnalysisLevel {
  return value === '높음' || value === '보통' || value === '낮음';
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) {
    const items = value.map(cleanString).filter(Boolean);
    return items.length > 0 ? items : fallback;
  }

  const item = cleanString(value);
  return item ? [item] : fallback;
}

function normalizeAnalysisLevel(value: unknown): FinalAnalysisLevel {
  if (isAnalysisLevel(value)) {
    return value;
  }

  const text = cleanString(value).toLowerCase();
  if (text.includes('높') || text.includes('상') || text.includes('high')) {
    return '높음';
  }

  if (text.includes('낮') || text.includes('하') || text.includes('low')) {
    return '낮음';
  }

  return '보통';
}

function findAnalysisForIdea(analyses: Record<string, unknown>[], idea: FinalIdeaInput, index: number) {
  return (
    analyses.find((analysis) => cleanString(analysis.ideaId) === idea.ideaId) ??
    analyses.find((analysis) => cleanString(analysis.title) === idea.title) ??
    analyses[index] ??
    null
  );
}

function normalizeAnalysisResult(value: unknown, ideas: FinalIdeaInput[]): FinalIdeaAnalysisResult | null {
  if (!isRecord(value) || ideas.length === 0) {
    return null;
  }

  const sourceAnalyses = Array.isArray(value.analyses) ? value.analyses.filter(isRecord) : [];
  const normalizedAnalyses = ideas.map((idea, index) => {
    const source = findAnalysisForIdea(sourceAnalyses, idea, index);
    const title = cleanString(source?.title) || idea.title || '제목 없음';

    return {
      ideaId: idea.ideaId,
      title,
      summary:
        cleanString(source?.summary) ||
        `${title}의 핵심 방향은 확인되지만, 설명을 조금 더 구체화하면 비교가 쉬워집니다.`,
      strengths: normalizeStringArray(source?.strengths, ['아이디어의 기본 방향과 목적을 확인할 수 있습니다.']),
      improvements: normalizeStringArray(source?.improvements, ['구현 범위와 핵심 기능을 더 구체화해 주세요.']),
      feasibility: normalizeAnalysisLevel(source?.feasibility),
      projectFit: normalizeAnalysisLevel(source?.projectFit),
    };
  });

  const overall = isRecord(value.overall) ? value.overall : {};
  const ideaIds = new Set(ideas.map((idea) => idea.ideaId));
  const recommendedIdeaIds = normalizeStringArray(overall.recommendedIdeaIds, [])
    .filter((ideaId) => ideaIds.has(ideaId));

  return {
    analyses: normalizedAnalyses,
    overall: {
      comparison:
        cleanString(overall.comparison) ||
        '입력된 아이디어들은 목적과 구현 범위가 다르므로, 개발 기간과 핵심 요구사항을 기준으로 비교할 수 있습니다.',
      recommendedIdeaIds: recommendedIdeaIds.length > 0 ? recommendedIdeaIds : [ideas[0].ideaId],
      recommendationReason:
        cleanString(overall.recommendationReason) ||
        '현재 정보 기준으로는 첫 번째 아이디어가 비교 기준을 잡기 가장 쉽습니다. 세부 요구사항을 보완하면 추천 정확도를 높일 수 있습니다.',
      combinationSuggestion:
        cleanString(overall.combinationSuggestion) ||
        '각 아이디어의 장점을 결합하려면 핵심 기능을 하나로 정하고 보조 기능을 단계적으로 추가하는 방식을 고려할 수 있습니다.',
    },
    notice: defaultNotice,
  };
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
    value.notice === defaultNotice
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

function getClaudeToolInput(responseBody: unknown) {
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

  if (!isRecord(requestBody) || !cleanString(requestBody.projectId)) {
    return jsonResponse({ error: 'invalid_project', message: '과제 정보를 확인해주세요.' }, 400);
  }

  const ideas = normalizeIdeas(requestBody.ideas);
  if (!Array.isArray(ideas)) {
    return jsonResponse({ error: 'invalid_ideas', message: ideas.error }, ideas.status);
  }

  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? Deno.env.get('CLAUDE_API_KEY');
  if (!anthropicApiKey) {
    return jsonResponse({ error: 'missing_anthropic_key', message: 'AI 분석 설정을 확인해주세요.' }, 500);
  }

  const claudeModel = defaultClaudeModel;
  const claudeUrl = 'https://api.anthropic.com/v1/messages';

  const prompt = JSON.stringify({
    projectId: cleanString(requestBody.projectId),
    ideas,
    outputNotice: defaultNotice,
  });

  let claudeResponse: Response;
  try {
    claudeResponse = await fetch(claudeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': anthropicVersion,
      },
      body: JSON.stringify({
        model: claudeModel,
        max_tokens: 4096,
        system: systemInstruction,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        tools: [
          {
            name: analysisToolName,
            description: 'Record the final idea analysis result for the app.',
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
    console.error('Claude request failed before response.');
    return jsonResponse({ error: 'network_error', message: 'AI 분석 요청에 실패했습니다. 다시 시도해주세요.' }, 502);
  }

  if (!claudeResponse.ok) {
    let errorBody = '';
    try {
      errorBody = await claudeResponse.text();
    } catch {
      errorBody = '';
    }

    console.error('Claude API returned an error status.', {
      status: claudeResponse.status,
      body: errorBody.slice(0, 500),
    });
    if (claudeResponse.status === 401) {
      return jsonResponse(
        { error: 'anthropic_unauthorized', message: 'Claude API 키가 유효하지 않습니다. Supabase ANTHROPIC_API_KEY를 확인해주세요.' },
        500,
      );
    }

    if (claudeResponse.status === 429) {
      return jsonResponse(
        { error: 'anthropic_rate_limited', message: 'Claude API 사용량 또는 결제 한도를 확인해주세요.' },
        502,
      );
    }

    if (claudeResponse.status === 400) {
      return jsonResponse(
        { error: 'anthropic_bad_request', message: 'Claude API 요청 형식을 확인해주세요.' },
        502,
      );
    }

    return jsonResponse({ error: 'anthropic_error', message: 'AI 분석 요청에 실패했습니다. 다시 시도해주세요.' }, 502);
  }

  let claudeBody: unknown;
  try {
    claudeBody = await claudeResponse.json();
  } catch {
    console.error('Claude response was not JSON.');
    return jsonResponse({ error: 'invalid_anthropic_response', message: parseErrorMessage }, 502);
  }

  const analysisInput = getClaudeToolInput(claudeBody);
  const analysis = normalizeAnalysisResult(analysisInput, ideas);
  if (!isAnalysisResult(analysis)) {
    console.error('Claude tool input could not be normalized to the analysis schema.');
    return jsonResponse({ error: 'invalid_analysis_shape', message: parseErrorMessage }, 502);
  }

  return jsonResponse(analysis);
});
