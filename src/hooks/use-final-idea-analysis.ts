import { useCallback, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { ProjectConditions } from '@/types/candidate-idea';
import type { FinalIdeaAnalysisInput, FinalIdeaAnalysisResult, FinalAnalysisLevel } from '@/types/final-analysis';
import { getIdeaCategoryLabel, normalizeIdeaCategory, normalizeIdeaStatus, type Idea } from '@/types/idea';

const maxAnalysisIdeas = 10;
const analysisLoadError = '분석 결과를 불러오지 못했습니다. 다시 시도해주세요.';
const emptyFinalIdeaMessage = '최종 후보 아이디어를 먼저 선택해주세요.';

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

export function useFinalIdeaAnalysis(projectId: string, selectedIdeas: Idea[], projectConditions?: ProjectConditions) {
  const { session, user } = useAuth();
  const [analysis, setAnalysis] = useState<FinalIdeaAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analysisRequestRef = useRef(false);
  const accessToken = session?.access_token ?? '';
  const userId = user?.id ?? '';

  const eligibleIdeas = useMemo(() => selectedIdeas.filter(hasText), [selectedIdeas]);
  const requestIdeas = useMemo(() => eligibleIdeas.slice(0, maxAnalysisIdeas).map(toAnalysisInput), [eligibleIdeas]);
  const skippedBlankCount = selectedIdeas.length - eligibleIdeas.length;
  const isLimited = eligibleIdeas.length > maxAnalysisIdeas;

  const analyzeIdeas = useCallback(async (inputFingerprint?: string) => {
    if (analysisRequestRef.current) {
      return null;
    }

    if (!userId || !accessToken) {
      setAnalysisError('로그인이 필요합니다.');
      return null;
    }

    if (requestIdeas.length === 0) {
      setAnalysisError(emptyFinalIdeaMessage);
      return null;
    }

    analysisRequestRef.current = true;
    setIsAnalyzing(true);
    setAnalysisError('');

    try {
      const { data, error } = await supabase.functions.invoke('analyze-final-ideas', {
        body: {
          projectId,
          ideas: requestIdeas,
          projectConditions,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) {
        setAnalysisError(await getInvokeErrorMessage(error));
        return null;
      }

      if (!isAnalysisResult(data)) {
        setAnalysisError(analysisLoadError);
        return null;
      }

      const savedAnalysis: FinalIdeaAnalysisResult = {
        ...data,
        inputFingerprint,
        analyzedAt: new Date().toISOString(),
      };
      setAnalysis(savedAnalysis);
      return savedAnalysis;
    } catch {
      setAnalysisError(analysisLoadError);
      return null;
    } finally {
      analysisRequestRef.current = false;
      setIsAnalyzing(false);
    }
  }, [accessToken, projectConditions, projectId, requestIdeas, userId]);

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
