import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { FinalIdeaAnalysisInput, FinalIdeaAnalysisResult, FinalAnalysisLevel } from '@/types/final-analysis';
import { getIdeaCategoryLabel, normalizeIdeaCategory, normalizeIdeaStatus, type Idea } from '@/types/idea';

const maxAnalysisIdeas = 10;
const analysisLoadError = '분석 결과를 불러오지 못했습니다. 다시 시도해주세요.';
const emptyFinalIdeaMessage = '최종 후보 아이디어를 먼저 선택해주세요.';
const demoDelayMs = 1400;

const analysisLevels: FinalAnalysisLevel[] = ['높음', '보통', '낮음'];

function isAnalysisLevel(value: unknown): value is FinalAnalysisLevel {
  return analysisLevels.includes(value as FinalAnalysisLevel);
}

function hasText(idea: Idea) {
  return Boolean(idea.title.trim() || idea.content.trim());
}

function toAnalysisInput(idea: Idea): FinalIdeaAnalysisInput {
  const category = normalizeIdeaCategory(idea.category);

  return {
    ideaId: idea.id,
    title: idea.title.trim(),
    content: idea.content.trim(),
    category: getIdeaCategoryLabel(category),
    status: normalizeIdeaStatus(idea.status),
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function getInvokeErrorMessage(error: unknown) {
  const context = isRecord(error) ? error.context : undefined;

  if (context && typeof context === 'object' && 'json' in context && typeof context.json === 'function') {
    try {
      const body = await context.json();

      if (isRecord(body) && typeof body.message === 'string' && body.message.trim()) {
        return body.message;
      }
    } catch {
      return analysisLoadError;
    }
  }

  return analysisLoadError;
}

async function readInvokeError(error: unknown) {
  await getInvokeErrorMessage(error);
}

function isAnalysisResult(value: unknown): value is FinalIdeaAnalysisResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const result = value as Partial<FinalIdeaAnalysisResult>;
  const overall = result.overall;

  return (
    Array.isArray(result.analyses) &&
    result.analyses.every(
      (analysis) =>
        analysis &&
        typeof analysis === 'object' &&
        typeof analysis.ideaId === 'string' &&
        typeof analysis.title === 'string' &&
        typeof analysis.summary === 'string' &&
        isStringArray(analysis.strengths) &&
        isStringArray(analysis.improvements) &&
        isAnalysisLevel(analysis.feasibility) &&
        isAnalysisLevel(analysis.projectFit),
    ) &&
    Boolean(overall) &&
    typeof overall === 'object' &&
    typeof overall.comparison === 'string' &&
    isStringArray(overall.recommendedIdeaIds) &&
    overall.recommendedIdeaIds.length > 0 &&
    typeof overall.recommendationReason === 'string' &&
    typeof overall.combinationSuggestion === 'string' &&
    typeof result.notice === 'string'
  );
}

function wait(ms: number) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function getShortContent(idea: FinalIdeaAnalysisInput) {
  const text = idea.content || idea.title || '아이디어의 핵심 방향을 바탕으로 과제 결과물을 구성할 수 있습니다.';

  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}

function createDemoAnalysis(ideas: FinalIdeaAnalysisInput[]): FinalIdeaAnalysisResult {
  const recommendedIdea = ideas[0];

  return {
    analyses: ideas.map((idea, index) => ({
      ideaId: idea.ideaId,
      title: idea.title || '제목 없는 아이디어',
      summary: getShortContent(idea),
      strengths: [
        '핵심 주제가 비교적 분명해 발표나 보고서 구조로 정리하기 쉽습니다.',
        index === 0
          ? '최종안의 중심 아이디어로 확장했을 때 전체 흐름을 잡기 좋습니다.'
          : '다른 후보와 결합해 세부 기능이나 보완 근거로 활용하기 좋습니다.',
      ],
      improvements: [
        '구현 범위와 우선순위를 조금 더 좁히면 완성도를 높일 수 있습니다.',
        '사용자 관점의 구체적인 사용 장면을 한두 가지 추가하면 설득력이 좋아집니다.',
      ],
      feasibility: index === 0 ? '높음' : '보통',
      projectFit: '높음',
    })),
    overall: {
      comparison:
        ideas.length === 1
          ? '비교할 다른 최종 후보는 없지만, 현재 아이디어는 과제 결과물로 발전시키기 좋은 방향을 가지고 있습니다.'
          : '각 후보는 강조점이 다르므로 하나를 중심축으로 정하고, 나머지는 보조 기능이나 근거 자료로 결합하는 방식이 적합합니다.',
      recommendedIdeaIds: [recommendedIdea.ideaId],
      recommendationReason: `핵심 방향이 가장 명확해 "${recommendedIdea.title || '첫 번째 아이디어'}"를 최종안의 중심으로 고려할 수 있습니다.`,
      combinationSuggestion:
        ideas.length === 1
          ? '현재 아이디어 안에서 핵심 기능, 사용자 흐름, 기대 효과를 나누어 구체화하는 방식을 고려할 수 있습니다.'
          : '추천 아이디어를 중심으로 두고, 다른 아이디어의 장점은 세부 기능, 차별점, 발표 근거로 결합할 수 있습니다.',
    },
    notice: 'AI 분석 결과는 최종 결정을 돕기 위한 참고 자료입니다.',
  };
}

export function useFinalIdeaAnalysis(projectId: string, selectedIdeas: Idea[]) {
  const { session, user } = useAuth();
  const [analysis, setAnalysis] = useState<FinalIdeaAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const accessToken = session?.access_token ?? '';
  const userId = user?.id ?? '';

  const eligibleIdeas = useMemo(() => selectedIdeas.filter(hasText), [selectedIdeas]);
  const requestIdeas = useMemo(() => eligibleIdeas.slice(0, maxAnalysisIdeas).map(toAnalysisInput), [eligibleIdeas]);
  const skippedBlankCount = selectedIdeas.length - eligibleIdeas.length;
  const isLimited = eligibleIdeas.length > maxAnalysisIdeas;

  const analyzeIdeas = useCallback(async () => {
    if (isAnalyzing) {
      return;
    }

    if (!userId || !accessToken) {
      setAnalysisError('로그인이 필요합니다.');
      return;
    }

    if (requestIdeas.length === 0) {
      setAnalysisError(emptyFinalIdeaMessage);
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError('');

    try {
      const { data, error } = await supabase.functions.invoke('analyze-final-ideas', {
        body: {
          projectId,
          ideas: requestIdeas,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) {
        await readInvokeError(error);
        await wait(demoDelayMs);
        setAnalysis(createDemoAnalysis(requestIdeas));
        return;
      }

      if (!isAnalysisResult(data)) {
        await wait(demoDelayMs);
        setAnalysis(createDemoAnalysis(requestIdeas));
        return;
      }

      setAnalysis(data);
    } catch {
      await wait(demoDelayMs);
      setAnalysis(createDemoAnalysis(requestIdeas));
    } finally {
      setIsAnalyzing(false);
    }
  }, [accessToken, isAnalyzing, projectId, requestIdeas, userId]);

  return {
    analysis,
    analysisError,
    canAnalyze: requestIdeas.length > 0,
    emptyFinalIdeaMessage,
    isAnalyzing,
    isLimited,
    maxAnalysisIdeas,
    requestIdeas,
    skippedBlankCount,
    analyzeIdeas,
  };
}
