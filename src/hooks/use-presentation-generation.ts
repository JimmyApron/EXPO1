import { useCallback } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type {
  CandidateIdea,
  PresentationData,
  ProjectConditions,
  SampleMvpPlan,
} from '@/types/presentation';

type GeneratePresentationInput = {
  projectId: string;
  projectConditions: ProjectConditions;
  selectedIdea: CandidateIdea;
  mvpPlan: SampleMvpPlan;
};

const generationErrorMessage = '발표 자료를 생성하지 못했습니다. 다시 시도해주세요.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isPresentationData(value: unknown): value is PresentationData {
  if (!isRecord(value) || !Array.isArray(value.slides) || !Array.isArray(value.expectedQna)) {
    return false;
  }

  return (
    typeof value.presentationTitle === 'string' &&
    value.slides.length > 0 &&
    value.slides.every(
      (slide) =>
        isRecord(slide) &&
        typeof slide.slideNumber === 'number' &&
        typeof slide.title === 'string' &&
        isStringArray(slide.bulletPoints) &&
        typeof slide.speakerScript === 'string',
    ) &&
    value.expectedQna.length > 0 &&
    value.expectedQna.every(
      (item) => isRecord(item) && typeof item.question === 'string' && typeof item.answer === 'string',
    ) &&
    typeof value.businessPlanDraft === 'string' &&
    typeof value.finalReport === 'string'
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
      return generationErrorMessage;
    }
  }

  return generationErrorMessage;
}

export function usePresentationGeneration() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? '';

  const generatePresentation = useCallback(
    async (input: GeneratePresentationInput) => {
      if (!accessToken) {
        throw new Error('로그인이 필요합니다.');
      }

      const { data, error } = await supabase.functions.invoke('generate-presentation', {
        body: input,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) {
        throw new Error(await getInvokeErrorMessage(error));
      }
      if (!isPresentationData(data)) {
        throw new Error(generationErrorMessage);
      }

      return data;
    },
    [accessToken],
  );

  return {
    canGenerate: Boolean(accessToken),
    generatePresentation,
  };
}
