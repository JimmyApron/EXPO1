export const NotificationKinds = [
  'deadline',
  'ideareview',
  'finalselection',
  'stalledidea',
  'feedback',
  'likesurge',
  'evaluation',
  'team_evaluation',
  'team_reminder',
  'team_feedback',
  'team_changes',
  'team_room',
] as const;

export type NotificationKind = (typeof NotificationKinds)[number];

export type NotificationSettings = {
  deadline: boolean;
  ideareview: boolean;
  finalselection: boolean;
  stalledidea: boolean;
  feedback: boolean;
  likesurge: boolean;
  deadlinedays: number;
  stalledideadays: number;
  likesurgethreshold: number;
};

export const NotificationKindLabels: Record<NotificationKind, string> = {
  deadline: '마감 임박',
  ideareview: '아이디어 확인 필요',
  finalselection: '최종 선택 필요',
  stalledidea: '진행 정체',
  feedback: '피드백 도착',
  likesurge: '공감 증가',
  evaluation: '평가 참여',
  team_evaluation: '팀 평가',
  team_reminder: '익명 콕 찌르기',
  team_feedback: '팀 피드백',
  team_changes: '팀 과제 변경',
  team_room: '방 소식',
};

export type AppNotification = {
  id: string;
  projectid: string;
  title: string;
  message: string;
  kind: NotificationKind;
  createdat: string;
  isread: boolean;
  scope?: 'personal' | 'team';
  target?: string;
  sourcekey?: string;
  roomid?: string | null;
};
