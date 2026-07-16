export const NotificationKinds = ['deadline', 'idea-review', 'final-selection'] as const;

export type NotificationKind = (typeof NotificationKinds)[number];

export const NotificationKindLabels: Record<NotificationKind, string> = {
  deadline: '마감 임박',
  'idea-review': '아이디어 확인 필요',
  'final-selection': '최종 선택 필요',
};

export type AppNotification = {
  id: string;
  projectId: string;
  title: string;
  message: string;
  kind: NotificationKind;
  createdAt: string;
  isRead: boolean;
};
