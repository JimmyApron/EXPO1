import { useCallback, useEffect, useState } from 'react';
import { normalizeMvpPlan } from '../../supabase/functions/_shared/mvp-plan';

import { MVP_EDGE_FUNCTION_NAME } from '@/constants/mvp';
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

async function getMvpErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context;
    if (context && typeof context === 'object' && 'json' in context) {
      try {
        const body = await (context as Response).json() as { message?: unknown };
        if (typeof body.message === 'string' && body.message.trim()) return body.message.trim();
      } catch {
        // Fall through to the client-side error below.
      }
    }
  }
  if (error instanceof Error && error.message && error.message !== 'Edge Function returned a non-2xx status code') {
    return error.message;
  }
  return 'AI 계획을 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
}

export function useMvpPlan(
  idea: MvpIdea,
  conditions?: ProjectConditions,
  savedPlan?: MvpPlan | null,
  onSave?: (plan: MvpPlan) => Promise<unknown>,
) {
  const { session } = useAuth();
  const [plan, setPlan] = useState<MvpPlan | null>(
    isMvpPlan(savedPlan, idea.id) ? normalizeMvpPlan(savedPlan, idea) : null,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const accessToken = session?.access_token;

  useEffect(() => {
    const timeout = globalThis.setTimeout(
      () => setPlan(isMvpPlan(savedPlan, idea.id) ? normalizeMvpPlan(savedPlan, idea) : null),
      0,
    );
    return () => globalThis.clearTimeout(timeout);
  }, [idea, savedPlan]);

  const generatePlan = useCallback(async () => {
    if (isGenerating) return;
    if (!accessToken) {
      setError('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
      return;
    }
    setIsGenerating(true);
    setError('');

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(MVP_EDGE_FUNCTION_NAME, {
        body: { selectedIdeaId: idea.id, idea, projectConditions: conditions },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (invokeError) throw invokeError;
      if (!isMvpPlan(data, idea.id)) throw new Error('AI 계획 응답 형식이 올바르지 않습니다.');
      const normalized = normalizeMvpPlan(data, idea);
      if (!normalized) throw new Error('AI 계획 응답 형식이 올바르지 않습니다.');
      const saveResult = await onSave?.(normalized) as { error?: string } | undefined;
      if (saveResult?.error) throw new Error(saveResult.error);
      setPlan(normalized);
    } catch (caughtError) {
      setError(await getMvpErrorMessage(caughtError));
    } finally {
      setIsGenerating(false);
    }
  }, [accessToken, conditions, idea, isGenerating, onSave]);

  return { plan, isGenerating, error, generatePlan };
}
