export type FinalIdeaInput = {
  ideaId: string;
  title: string;
  content: string;
  category: string;
  status: string;
};

export type FinalAnalysisLevel = '높음' | '보통' | '낮음';

export type FinalIdeaAnalysisResult = {
  analyses: {
    ideaId: string;
    title: string;
    summary: string;
    strengths: string[];
    risks: string[];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNonEmptyStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.map(cleanString).filter(Boolean);
  return items.length > 0 ? items : null;
}

function normalizeAnalysisLevel(value: unknown): FinalAnalysisLevel | null {
  if (value === '높음' || value === '보통' || value === '낮음') {
    return value;
  }

  const text = cleanString(value).toLowerCase();
  if (text.includes('높') || text.includes('상') || text.includes('high')) {
    return '높음';
  }

  if (text.includes('낮') || text.includes('하') || text.includes('low')) {
    return '낮음';
  }

  if (text.includes('보통') || text.includes('중') || text.includes('medium')) {
    return '보통';
  }

  return null;
}

export function normalizeFinalIdeaAnalysis(
  value: unknown,
  ideas: FinalIdeaInput[],
  notice: string,
): FinalIdeaAnalysisResult | null {
  if (!isRecord(value) || ideas.length === 0 || !Array.isArray(value.analyses) || !isRecord(value.overall)) {
    return null;
  }

  const sourceAnalyses = value.analyses.filter(isRecord);
  if (sourceAnalyses.length !== ideas.length) {
    return null;
  }

  const analysesByIdeaId = new Map<string, Record<string, unknown>>();
  for (const source of sourceAnalyses) {
    const ideaId = cleanString(source.ideaId);
    if (!ideaId || analysesByIdeaId.has(ideaId)) {
      return null;
    }
    analysesByIdeaId.set(ideaId, source);
  }

  const analyses: FinalIdeaAnalysisResult['analyses'] = [];
  for (const idea of ideas) {
    const source = analysesByIdeaId.get(idea.ideaId);
    if (!source) {
      return null;
    }

    const summary = cleanString(source.summary);
    const strengths = normalizeNonEmptyStringArray(source.strengths);
    const risks = normalizeNonEmptyStringArray(source.risks);
    const improvements = normalizeNonEmptyStringArray(source.improvements);
    const feasibility = normalizeAnalysisLevel(source.feasibility);
    const projectFit = normalizeAnalysisLevel(source.projectFit);

    if (!summary || !strengths || !risks || !improvements || !feasibility || !projectFit) {
      return null;
    }

    analyses.push({
      ideaId: idea.ideaId,
      title: idea.title || cleanString(source.title) || '제목 없음',
      summary,
      strengths,
      risks,
      improvements,
      feasibility,
      projectFit,
    });
  }

  const overall = value.overall;
  const comparison = cleanString(overall.comparison);
  const recommendationReason = cleanString(overall.recommendationReason);
  const combinationSuggestion = cleanString(overall.combinationSuggestion);
  const recommendedIdeaIds = normalizeNonEmptyStringArray(overall.recommendedIdeaIds);
  const validIdeaIds = new Set(ideas.map((idea) => idea.ideaId));

  if (
    !comparison ||
    !recommendationReason ||
    !combinationSuggestion ||
    !recommendedIdeaIds ||
    recommendedIdeaIds.some((ideaId) => !validIdeaIds.has(ideaId))
  ) {
    return null;
  }

  return {
    analyses,
    overall: {
      comparison,
      recommendedIdeaIds: [...new Set(recommendedIdeaIds)],
      recommendationReason,
      combinationSuggestion,
    },
    notice,
  };
}
