export function truncateAssignmentTitle(title?: string | null): string {
  const value = Array.from(title?.trim() || '이름 없는 과제');
  return value.length <= 24 ? value.join('') : `${value.slice(0, 23).join('')}…`;
}

export const KAKAO_COPY_SUCCESS = '카카오톡을 열어 단톡방에 붙여넣어 주세요.';

export function createKakaoReminderMessage(params: {
  assignmentTitle?: string | null;
  completedCount: number;
  totalCount: number;
  dueDate?: string | null;
}): string {
  return `┌────────────────────┐
│  ✦ 과제 참여 알림 ✦  │
└────────────────────┘

ฅ( ̳• ·̫ • ̳ฅ) ♡

「 ${truncateAssignmentTitle(params.assignmentTitle)} 」
현재 평가 진행률은
✨ ${params.completedCount} / ${params.totalCount}명 완료 ✨

아직 참여 전인 조원분들,
잠깐만 들러서 평가 부탁드려요! ᐢ.  ̫ .ᐢ

🗓 마감: ${params.dueDate?.trim() || '미정'}`;
}
