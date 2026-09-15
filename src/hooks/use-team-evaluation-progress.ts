import { useCallback, useMemo, useState } from 'react';

import { useNotificationToasts } from '@/components/notification/notification-toast-provider';
import { useAuth } from '@/hooks/use-auth';
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
  completeEvaluation: () => void;
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
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const completedCount = participants.filter((participant) => completedIds.has(participant.id)).length;
  const currentParticipant = participants.find((participant) => participant.id === user?.id) ?? participants[0];

  const completeEvaluation = useCallback(() => {
    if (!projectId || !currentParticipant || completedIds.has(currentParticipant.id)) {
      return;
    }

    const nextCompletedIds = new Set(completedIds);
    nextCompletedIds.add(currentParticipant.id);
    const nextCompletedCount = participants.filter((participant) => nextCompletedIds.has(participant.id)).length;
    setCompletedIds(nextCompletedIds);
    showNotificationToast({
      id: `evaluation:local:${projectId}:${currentParticipant.id}:${nextCompletedCount}`,
      projectid: projectId,
      title: '팀원 평가 완료',
      message: `${currentParticipant.name} 님이 평가를 완료했습니다. (현재 ${nextCompletedCount}/${participants.length}명 완료)`,
      kind: 'evaluation',
      createdat: new Date().toISOString(),
      isread: false,
    });
  }, [completedIds, currentParticipant, participants, projectId, showNotificationToast]);

  return {
    completedCount,
    totalCount: participants.length,
    isLoading: false,
    isCurrentUserCompleted: Boolean(currentParticipant && completedIds.has(currentParticipant.id)),
    completeEvaluation,
  };
}
