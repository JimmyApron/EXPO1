import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type {
  IdeaDraftAnalysisInput,
  IdeaDraftAnalysisLevel,
  IdeaDraftAnalysisResult,
} from '@/types/idea-draft-analysis';
import { getIdeaCategoryLabel, normalizeIdeaCategory, normalizeIdeaStatus, type IdeaInput } from '@/types/idea';

const analysisLoadError = '진단 결과를 불러오지 못했습니다. 다시 시도해주세요.';
const emptyDraftMessage = '제목과 내용을 입력하면 AI가 등록 전 진단을 해줄 수 있습니다.';
const analysisLevels: IdeaDraftAnalysisLevel[] = ['높음', '보통', '낮음'];

function isAnalysisLevel(value: unknown): value is IdeaDraftAnalysisLevel {
  return analysisLevels.includes(value as IdeaDraftAnalysisLevel);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
    typeof value.notice === 'string'
  );
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

function toAnalysisInput(input: IdeaInput): IdeaDraftAnalysisInput {
  const category = normalizeIdeaCategory(input.category);

  return {
    title: input.title.trim(),
    content: input.content.trim(),
    category: getIdeaCategoryLabel(category),
    status: normalizeIdeaStatus(input.status),
  };
}

export function useIdeaDraftAnalysis(projectId?: string) {
  const { session, user } = useAuth();
  const [analysis, setAnalysis] = useState<IdeaDraftAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const accessToken = session?.access_token ?? '';
  const userId = user?.id ?? '';

  const canRequest = useMemo(() => Boolean(projectId && userId && accessToken), [accessToken, projectId, userId]);

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setAnalysisError('');
  }, []);

  const analyzeDraft = useCallback(
    async (input: IdeaInput) => {
      if (isAnalyzing) {
        return;
      }

      if (!canRequest || !projectId || !accessToken) {
        setAnalysisError('로그인이 필요합니다.');
        return;
      }

      if (!input.title.trim() || !input.content.trim()) {
        setAnalysisError(emptyDraftMessage);
        return;
      }

      setIsAnalyzing(true);
      setAnalysisError('');

      try {
        const { data, error } = await supabase.functions.invoke('analyze-idea-draft', {
          body: {
            projectId,
            idea: toAnalysisInput(input),
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (error) {
          setAnalysis(null);
          setAnalysisError(await getInvokeErrorMessage(error));
          return;
        }

        if (!isAnalysisResult(data)) {
          setAnalysis(null);
          setAnalysisError(analysisLoadError);
          return;
        }

        setAnalysis(data);
      } catch {
        setAnalysis(null);
        setAnalysisError(analysisLoadError);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [accessToken, canRequest, isAnalyzing, projectId],
  );

  return {
    analysis,
    analysisError,
    analyzeDraft,
    canRequest,
    clearAnalysis,
    emptyDraftMessage,
    isAnalyzing,
  };
}
