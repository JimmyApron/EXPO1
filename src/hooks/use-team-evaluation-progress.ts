import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNotificationToasts } from '@/components/notification/notification-toast-provider';
import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { completedEvaluatorIds } from '@/lib/team-evaluation-progress';
import { supabase } from '@/lib/supabase';
import type { RoomMember } from '@/types/room';

type TeamEvaluationProgress = {
  completedCount: number;
  totalCount: number;
  isLoading: boolean;
  isCurrentUserCompleted: boolean;
};

type EvaluationRow = {
  userid: string;
  ideaid: string;
};

export function useTeamEvaluationProgress(
  projectId: string | undefined,
  members: RoomMember[] | undefined,
  ideaIds: string[],
  evaluationRound: number,
  fallbackTeamSize = 4,
): TeamEvaluationProgress {
  const { user } = useAuth();
  const { showNotificationToast } = useNotificationToasts();
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const previousCompletedCount = useRef<number | null>(null);
  const requiredIdeaIds = useMemo(() => [...new Set(ideaIds)].sort(), [ideaIds]);
  const participantIds = useMemo(
    () => new Set((members ?? []).map((member) => member.userid)),
    [members],
  );
  const totalCount = members && members.length > 0 ? members.length : Math.max(1, fallbackTeamSize);
  const completedCount = participantIds.size > 0
    ? [...participantIds].filter((participantId) => completedIds.has(participantId)).length
    : Math.min(totalCount, completedIds.size);

  const loadProgress = useCallback(async () => {
    if (!projectId || !user || requiredIdeaIds.length === 0) {
      setCompletedIds(new Set());
      previousCompletedCount.current = null;
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('ideaevaluations')
      .select('userid, ideaid')
      .eq('projectid', projectId)
      .eq('evaluationround', evaluationRound);

    if (!error) {
      const nextCompletedIds = completedEvaluatorIds((data ?? []) as EvaluationRow[], requiredIdeaIds);
      const nextCompletedCount = participantIds.size > 0
        ? [...participantIds].filter((participantId) => nextCompletedIds.has(participantId)).length
        : Math.min(totalCount, nextCompletedIds.size);
      if (previousCompletedCount.current !== null && nextCompletedCount > previousCompletedCount.current) {
        showNotificationToast({
          id: `evaluation:${projectId}:${evaluationRound}:${nextCompletedCount}`,
          projectid: projectId,
          title: '팀 평가 참여 현황',
          message: `현재 ${nextCompletedCount}/${totalCount}명 평가 완료`,
          kind: 'evaluation',
          createdat: new Date().toISOString(),
          isread: false,
        });
      }
      previousCompletedCount.current = nextCompletedCount;
      setCompletedIds(nextCompletedIds);
    }
    setIsLoading(false);
  }, [evaluationRound, participantIds, projectId, requiredIdeaIds, showNotificationToast, totalCount, user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => void loadProgress(), 0);
    return () => globalThis.clearTimeout(timeout);
  }, [loadProgress]);

  useRealtimeRefresh({
    channelName: `evaluation-progress:${projectId ?? 'none'}:${evaluationRound}`,
    enabled: Boolean(projectId && user),
    onRefresh: loadProgress,
    tables: [{ table: 'ideaevaluations', filter: `projectid=eq.${projectId}` }],
  });

  return {
    completedCount,
    totalCount,
    isLoading,
    isCurrentUserCompleted: Boolean(user && completedIds.has(user.id)),
  };
}
