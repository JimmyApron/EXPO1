import { useCallback, useEffect, useState } from 'react';

import { createSampleMvpPlan, MVP_EDGE_FUNCTION_NAME } from '@/constants/mvp';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { ProjectConditions } from '@/types/candidate-idea';
import type { MvpIdea, MvpPlan } from '@/types/mvp-plan';

function isMvpPlan(value: unknown, ideaId: string): value is MvpPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Partial<MvpPlan>;
  return (
    plan.ideaId === ideaId &&
    typeof plan.ideaTitle === 'string' &&
    typeof plan.summary === 'string' &&
    Array.isArray(plan.mustHaveFeatures) &&
    Array.isArray(plan.laterFeatures) &&
    Array.isArray(plan.screens) &&
    Array.isArray(plan.schedule) &&
    Array.isArray(plan.teamRoles) &&
    Array.isArray(plan.apis) &&
    Array.isArray(plan.presentationOrder)
  );
}

export function useMvpPlan(
  idea: MvpIdea,
  conditions?: ProjectConditions,
  savedPlan?: MvpPlan | null,
  onSave?: (plan: MvpPlan) => Promise<unknown>,
) {
  const { session } = useAuth();
  const [plan, setPlan] = useState<MvpPlan>(savedPlan ?? createSampleMvpPlan(idea));
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const accessToken = session?.access_token;

  useEffect(() => {
    const timeout = globalThis.setTimeout(
      () => setPlan(savedPlan?.ideaId === idea.id ? savedPlan : createSampleMvpPlan(idea)),
      0,
    );
    return () => globalThis.clearTimeout(timeout);
  }, [idea, savedPlan]);

  const generatePlan = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError('');

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(MVP_EDGE_FUNCTION_NAME, {
        body: { selectedIdeaId: idea.id, idea, projectConditions: conditions },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (invokeError) throw invokeError;
      if (!isMvpPlan(data, idea.id)) throw new Error('invalid-response');
      setPlan(data);
      await onSave?.(data);
    } catch {
      setError('AI 계획을 불러오지 못했습니다. 현재는 저장 가능한 예시 계획을 표시합니다.');
    } finally {
      setIsGenerating(false);
    }
  }, [accessToken, conditions, idea, isGenerating, onSave]);

  return { plan, isGenerating, error, generatePlan };
}
