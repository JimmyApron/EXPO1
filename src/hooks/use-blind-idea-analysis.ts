import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { Idea } from '@/types/idea';
import type { BlindIdeaAiAnalysis, BlindIdeaAnalysisCache, IdeaAnalysis } from '@/types/idea-evaluation';

type DraftAnalysisResponse = {
  strengths: string[];
  improvements: string[];
  readiness: '높음' | '보통' | '낮음';
};

const blindAnalysisPromptVersion = 2;

function isDraftAnalysisResponse(value: unknown): value is DraftAnalysisResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as Partial<DraftAnalysisResponse>;
  return (
    Array.isArray(response.strengths) &&
    response.strengths.every((item) => typeof item === 'string') &&
    Array.isArray(response.improvements) &&
    response.improvements.every((item) => typeof item === 'string') &&
    (response.readiness === '높음' || response.readiness === '보통' || response.readiness === '낮음')
  );
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
        return body.message.trim();
      }
    } catch {
      // Fall through to the stable client message below.
    }
  }

  return '서버에서 AI 분석 요청을 처리하지 못했습니다.';
}

function analysisKey(ideas: Idea[]) {
  return JSON.stringify({
    promptVersion: blindAnalysisPromptVersion,
    ideas: ideas.map((idea) => ({
      id: idea.id,
      title: idea.title,
      content: idea.content,
      summary: idea.summary,
      problem: idea.problem,
      targetUsers: idea.targetusers,
      solution: idea.solution,
      keywords: idea.keywords,
      coreFeatures: idea.corefeatures,
    })),
  });
}

function isBlindIdeaAiAnalysis(value: unknown): value is BlindIdeaAiAnalysis {
  if (!isRecord(value) || typeof value.ideaId !== 'string' || !Array.isArray(value.advantages)) return false;
  return value.advantages.length === 2
    && value.advantages.every((item) => typeof item === 'string')
    && typeof value.risk === 'string'
    && (value.difficulty === '쉬움' || value.difficulty === '보통' || value.difficulty === '어려움');
}

function getCachedAnalyses(cache: BlindIdeaAnalysisCache | null | undefined, inputKey: string) {
  if (!cache || cache.inputKey !== inputKey || !Array.isArray(cache.analyses)) return null;
  return cache.analyses.every(isBlindIdeaAiAnalysis) ? cache.analyses : null;
}

function difficulty(readiness: DraftAnalysisResponse['readiness']): IdeaAnalysis['difficulty'] {
  if (readiness === '높음') return '쉬움';
  if (readiness === '낮음') return '어려움';
  return '보통';
}

function toBlindAnalysis(ideaId: string, response: DraftAnalysisResponse): BlindIdeaAiAnalysis {
  const strengths = response.strengths.map((item) => item.trim()).filter(Boolean);
  const improvements = response.improvements.map((item) => item.trim()).filter(Boolean);

  return {
    ideaId,
    advantages: [
      strengths[0] ?? '문제 해결 효과를 확인하기 쉬움',
      strengths[1] ?? '사용자에게 줄 가치가 분명함',
    ],
    risk: improvements[0] ?? '실제 사용자 수요 검증이 필요함',
    difficulty: difficulty(response.readiness),
  };
}

/** Runs independent AI analyses only; the model is never asked to rank or compare candidates. */
export function useBlindIdeaAnalysis(
  projectId: string,
  ideas: Idea[],
  savedAnalysis: BlindIdeaAnalysisCache | null | undefined,
  saveAnalysis: (analysis: BlindIdeaAnalysisCache) => Promise<{ error?: string }>,
  enabled = true,
) {
  const { session, user } = useAuth();
  const inputKey = useMemo(() => analysisKey(ideas), [ideas]);
  const cachedAnalyses = useMemo(() => getCachedAnalyses(savedAnalysis, inputKey), [inputKey, savedAnalysis]);
  const [completedKey, setCompletedKey] = useState('');
  const [analyses, setAnalyses] = useState<BlindIdeaAiAnalysis[]>([]);
  const [isAnalyzingIdeas, setIsAnalyzingIdeas] = useState(false);
  const [blindAnalysisError, setBlindAnalysisError] = useState('');
  const activeAnalyses = completedKey === inputKey ? analyses : cachedAnalyses ?? [];
  const isAnalysisReady = ideas.length === 0 || completedKey === inputKey || Boolean(cachedAnalyses);

  const retryAnalysis = useCallback(() => {
    setAnalyses([]);
    setBlindAnalysisError('');
    setCompletedKey('');
  }, []);

  useEffect(() => {
    if (!enabled || !projectId || ideas.length === 0 || cachedAnalyses || completedKey === inputKey) return;

    let active = true;
    const timeout = globalThis.setTimeout(() => {
      const run = async () => {
        setIsAnalyzingIdeas(true);
        setBlindAnalysisError('');

        if (!user || !session?.access_token) {
          if (active) {
            setAnalyses([]);
            setBlindAnalysisError('AI 분석에 연결하지 못해 기본 분석 정보로 평가를 시작합니다.');
            setCompletedKey(inputKey);
            setIsAnalyzingIdeas(false);
          }
          return;
        }

        try {
          const responses = await Promise.all(ideas.map(async (idea) => {
            const { data, error } = await supabase.functions.invoke('analyze-idea-draft', {
              body: {
                projectId,
                idea: {
                  analysisMode: 'problem_solution',
                  title: idea.title,
                  content: idea.content,
                  category: idea.category,
                  status: idea.status,
                  summary: idea.summary,
                  problem: idea.problem,
                  targetUsers: idea.targetusers,
                  solution: idea.solution,
                  keywords: idea.keywords,
                  coreFeatures: idea.corefeatures,
                },
              },
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (error) {
              throw new Error(await getInvokeErrorMessage(error));
            }
            if (!isDraftAnalysisResponse(data)) {
              throw new Error('AI 분석 응답 형식을 확인하지 못했습니다.');
            }
            return toBlindAnalysis(idea.id, data);
          }));

          if (active) {
            setAnalyses(responses);
            setCompletedKey(inputKey);
            void saveAnalysis({ inputKey, analyses: responses, analyzedAt: new Date().toISOString() }).then((saved) => {
              if (saved.error) console.error('Blind AI analysis could not be persisted.', saved.error);
            });
          }
        } catch (error) {
          if (active) {
            setAnalyses([]);
            const reason = error instanceof Error && error.message.trim()
              ? error.message.trim()
              : '알 수 없는 오류가 발생했습니다.';
            setBlindAnalysisError(`AI 분석을 불러오지 못했습니다. ${reason}`);
          }
        } finally {
          if (active) {
            setCompletedKey(inputKey);
            setIsAnalyzingIdeas(false);
          }
        }
      };
      void run();
    }, 0);

    return () => {
      active = false;
      globalThis.clearTimeout(timeout);
    };
  }, [cachedAnalyses, completedKey, enabled, ideas, inputKey, projectId, saveAnalysis, session?.access_token, user]);

  return { analyses: activeAnalyses, blindAnalysisError, isAnalyzingIdeas, isAnalysisReady, retryAnalysis };
}
