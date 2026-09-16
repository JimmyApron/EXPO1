import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNotificationToasts } from '@/components/notification/notification-toast-provider';
import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { supabase } from '@/lib/supabase';
import type { RoomMember } from '@/types/room';

type EvaluationParticipant = {
  id: string;
  name: string;
};

type TeamEvaluationProgress = {
  completedCount: number;
  totalCount: number;
  isLoading: boolean;
  isCurrentUserCompleted: boolean;
  completeEvaluation: () => Promise<void>;
};

type EvaluationRow = {
  userid: string;
  completedat: string;
};

function getParticipantName(member: RoomMember) {
  return member.nickname || member.email || '팀원';
}

export function useTeamEvaluationProgress(
  projectId: string | undefined,
  members: RoomMember[] | undefined,
  fallbackTeamSize = 4,
): TeamEvaluationProgress {
  const { user } = useAuth();
  const { showNotificationToast } = useNotificationToasts();
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const previousCompletedCount = useRef<number | null>(null);
  const participants = useMemo<EvaluationParticipant[]>(() => {
    if (members && members.length > 0) {
      return members.map((member) => ({ id: member.userid, name: getParticipantName(member) }));
    }

    const totalCount = Math.max(1, fallbackTeamSize);
    return Array.from({ length: totalCount }, (_, index) => ({
      id: index === 0 && user?.id ? user.id : `mock-member-${index + 1}`,
      name: index === 0 ? '나' : `팀원 ${index + 1}`,
    }));
  }, [fallbackTeamSize, members, user]);
  const completedCount = participants.filter((participant) => completedIds.has(participant.id)).length;
  const currentParticipant = participants.find((participant) => participant.id === user?.id);

  const loadProgress = useCallback(async () => {
    if (!projectId || !user) {
      setCompletedIds(new Set());
      previousCompletedCount.current = null;
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('project_evaluation_participants')
      .select('userid, completedat')
      .eq('projectid', projectId);

    if (!error) {
      const nextCompletedIds = new Set((data ?? []).map((row) => (row as EvaluationRow).userid));
      const nextCompletedCount = participants.filter((participant) => nextCompletedIds.has(participant.id)).length;
      if (previousCompletedCount.current !== null && nextCompletedCount > previousCompletedCount.current) {
        showNotificationToast({
          id: `evaluation:${projectId}:${nextCompletedCount}`,
          projectid: projectId,
          title: '팀 평가 참여 현황',
          message: `현재 ${nextCompletedCount}/${participants.length}명 평가 완료`,
          kind: 'evaluation',
          createdat: new Date().toISOString(),
          isread: false,
        });
      }
      previousCompletedCount.current = nextCompletedCount;
      setCompletedIds(nextCompletedIds);
    }
    setIsLoading(false);
  }, [participants, projectId, showNotificationToast, user]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  useRealtimeRefresh({
    channelName: `evaluation-progress:${projectId ?? 'none'}`,
    enabled: Boolean(projectId && user),
    onRefresh: loadProgress,
    tables: [{ table: 'project_evaluation_participants', filter: `projectid=eq.${projectId}` }],
  });

  const completeEvaluation = useCallback(async () => {
    if (!projectId || !user || !currentParticipant || completedIds.has(currentParticipant.id)) {
      return;
    }

    const { error } = await supabase.from('project_evaluation_participants').upsert({
      projectid: projectId,
      userid: user.id,
      completedat: new Date().toISOString(),
      updatedat: new Date().toISOString(),
    }, { onConflict: 'projectid,userid' });
    if (error) return;

    await loadProgress();
  }, [completedIds, currentParticipant, loadProgress, projectId, user]);

  return {
    completedCount,
    totalCount: participants.length,
    isLoading,
    isCurrentUserCompleted: Boolean(user && completedIds.has(user.id)),
    completeEvaluation,
  };
}
