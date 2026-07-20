export const NotificationKinds = ['deadline', 'ideareview', 'finalselection'] as const;

export type NotificationKind = (typeof NotificationKinds)[number];

export const NotificationKindLabels: Record<NotificationKind, string> = {
  deadline: '마감 임박',
  ideareview: '아이디어 확인 필요',
  finalselection: '최종 선택 필요',
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
