import { useCallback, useState } from 'react';

import { MVP_EDGE_FUNCTION_NAME, sampleMvpPlan, selectedIdea } from '@/constants/mvp';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { MvpPlan } from '@/types/mvp-plan';

function isMvpPlan(value: unknown): value is MvpPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Partial<MvpPlan>;
  return (
    plan.ideaId === selectedIdea.id &&
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

export function useMvpPlan() {
  const { session } = useAuth();
  const [plan, setPlan] = useState<MvpPlan>(sampleMvpPlan);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const accessToken = session?.access_token;

  const generatePlan = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError('');

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(MVP_EDGE_FUNCTION_NAME, {
        body: { selectedIdeaId: selectedIdea.id, idea: selectedIdea },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (invokeError) throw invokeError;
      if (!isMvpPlan(data)) throw new Error('invalid-response');
      setPlan(data);
    } catch {
      setError('AI 계획을 불러오지 못했습니다. 현재는 샘플 계획을 계속 표시합니다.');
    } finally {
      setIsGenerating(false);
    }
  }, [accessToken, isGenerating]);

  return { plan, isGenerating, error, generatePlan };
}
