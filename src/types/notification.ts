export const NotificationKinds = [
  'deadline',
  'ideareview',
  'finalselection',
  'stalledidea',
  'feedback',
  'likesurge',
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
  likesurge: '반응 증가',
};

export type AppNotification = {
  id: string;
  projectid: string;
  title: string;
  message: string;
  kind: NotificationKind;
  createdat: string;
  isread: boolean;
};
