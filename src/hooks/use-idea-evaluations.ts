import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { supabase } from '@/lib/supabase';
import type { EvaluationChoice, StoredIdeaEvaluation } from '@/types/idea-evaluation';

const evaluationSelect = 'id, projectid, ideaid, userid, choice, createdat, locked';

function storageKey(projectId: string, userId: string) {
  return `watt:ideaevaluations:${projectId}:${userId}`;
}

function fromDatabase(value: Record<string, unknown>): StoredIdeaEvaluation | null {
  if (
    typeof value.id !== 'string' ||
    typeof value.projectid !== 'string' ||
    typeof value.ideaid !== 'string' ||
    typeof value.userid !== 'string' ||
    (value.choice !== 'pass' && value.choice !== 'pick') ||
    typeof value.createdat !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    projectId: value.projectid,
    ideaId: value.ideaid,
    userId: value.userid,
    choice: value.choice,
    createdAt: value.createdat,
    locked: true,
  };
}

async function loadLocal(projectId: string, userId: string) {
  try {
    const stored = await AsyncStorage.getItem(storageKey(projectId, userId));
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is StoredIdeaEvaluation => Boolean(item) && typeof item === 'object')
      : [];
  } catch {
    return [];
  }
}

export function useIdeaEvaluations(projectId: string) {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<StoredIdeaEvaluation[]>([]);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(true);
  const [evaluationError, setEvaluationError] = useState('');
  const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);

  const loadEvaluations = useCallback(async () => {
    if (!projectId || !user) {
      setEvaluations([]);
      setIsLoadingEvaluations(false);
      return;
    }

    setIsLoadingEvaluations(true);
    setEvaluationError('');
    const { data, error } = await supabase
      .from('ideaevaluations')
      .select(evaluationSelect)
      .eq('projectid', projectId);

    if (error) {
      const local = await loadLocal(projectId, user.id);
      setEvaluations(local);
      setEvaluationError('평가 저장소에 연결하지 못해 이 기기의 임시 평가를 사용합니다.');
    } else {
      setEvaluations((data ?? [])
        .map((item) => fromDatabase(item as Record<string, unknown>))
        .filter((item): item is StoredIdeaEvaluation => Boolean(item)));
    }
    setIsLoadingEvaluations(false);
  }, [projectId, user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => void loadEvaluations(), 0);
    return () => globalThis.clearTimeout(timeout);
  }, [loadEvaluations]);

  useRealtimeRefresh({
    channelName: `idea-evaluations:${projectId || 'none'}`,
    enabled: Boolean(user && projectId),
    onRefresh: loadEvaluations,
    tables: [{ table: 'ideaevaluations', filter: `projectid=eq.${projectId}` }],
  });

  const saveEvaluation = useCallback(async (ideaId: string, choice: EvaluationChoice) => {
    if (!projectId || !user || isSavingEvaluation) {
      return { error: '로그인 정보를 확인한 뒤 다시 시도해 주세요.' };
    }

    if (evaluations.some((evaluation) => evaluation.ideaId === ideaId && evaluation.userId === user.id)) {
      return { error: '이미 확정된 평가는 수정할 수 없습니다.' };
    }

    setIsSavingEvaluation(true);
    setEvaluationError('');
    const createdAt = new Date().toISOString();
    const fallback: StoredIdeaEvaluation = {
      id: `local:${user.id}:${ideaId}`,
      projectId,
      ideaId,
      userId: user.id,
      choice,
      createdAt,
      locked: true,
    };

    const { data, error } = await supabase
      .from('ideaevaluations')
      .insert({ projectid: projectId, ideaid: ideaId, userid: user.id, choice, locked: true })
      .select(evaluationSelect)
      .single();

    if (!error && data) {
      const saved = fromDatabase(data as Record<string, unknown>) ?? fallback;
      setEvaluations((current) => [...current, saved]);
      setIsSavingEvaluation(false);
      return { evaluation: saved };
    }

    const local = [...evaluations, fallback];
    await AsyncStorage.setItem(storageKey(projectId, user.id), JSON.stringify(local));
    setEvaluations(local);
    setEvaluationError('평가가 이 기기에만 임시 저장되었습니다. 마이그레이션 적용 후 자동으로 팀 결과에 반영됩니다.');
    setIsSavingEvaluation(false);
    return { evaluation: fallback };
  }, [evaluations, isSavingEvaluation, projectId, user]);

  return {
    currentUserId: user?.id ?? '',
    evaluations,
    evaluationError,
    isLoadingEvaluations,
    isSavingEvaluation,
    loadEvaluations,
    saveEvaluation,
  };
}
