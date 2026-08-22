import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { Idea } from '@/types/idea';
import type { BlindIdeaAiAnalysis, IdeaAnalysis } from '@/types/idea-evaluation';

type DraftAnalysisResponse = {
  strengths: string[];
  improvements: string[];
  readiness: '높음' | '보통' | '낮음';
};

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

function analysisKey(ideas: Idea[]) {
  return ideas
    .map((idea) => [idea.id, idea.title, idea.content, idea.problem, idea.solution, idea.updatedat].join(':'))
    .join('|');
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
      strengths[0] ?? '문제 해결 가능성을 확인할 수 있습니다.',
      strengths[1] ?? '사용자에게 전달할 가치가 분명합니다.',
    ],
    risk: improvements[0] ?? '사용자 검증이 더 필요합니다.',
    difficulty: difficulty(response.readiness),
  };
}

/** Runs independent AI analyses only; the model is never asked to rank or compare candidates. */
export function useBlindIdeaAnalysis(projectId: string, ideas: Idea[]) {
  const { session, user } = useAuth();
  const inputKey = useMemo(() => analysisKey(ideas), [ideas]);
  const [completedKey, setCompletedKey] = useState('');
  const [analyses, setAnalyses] = useState<BlindIdeaAiAnalysis[]>([]);
  const [isAnalyzingIdeas, setIsAnalyzingIdeas] = useState(false);
  const [blindAnalysisError, setBlindAnalysisError] = useState('');
  const isAnalysisReady = ideas.length === 0 || completedKey === inputKey;

  useEffect(() => {
    if (!projectId || ideas.length === 0 || completedKey === inputKey) return;

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
                  title: idea.title,
                  content: idea.content,
                  category: idea.category,
                  status: idea.status,
                },
              },
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (error || !isDraftAnalysisResponse(data)) throw error ?? new Error('Invalid AI analysis response.');
            return toBlindAnalysis(idea.id, data);
          }));

          if (active) setAnalyses(responses);
        } catch {
          if (active) {
            setAnalyses([]);
            setBlindAnalysisError('AI 분석을 완료하지 못해 기본 분석 정보로 평가를 시작합니다.');
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
  }, [completedKey, ideas, inputKey, projectId, session?.access_token, user]);

  return { analyses, blindAnalysisError, isAnalyzingIdeas, isAnalysisReady };
}
