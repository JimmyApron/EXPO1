export const notificationCategoryKeys = [
  'deadline', 'ideareview', 'finalselection', 'stalledidea', 'feedback', 'likesurge',
  'team_evaluation', 'team_reminder', 'team_feedback', 'team_changes', 'team_room',
] as const;

export type NotificationCategory = typeof notificationCategoryKeys[number];

export function notificationsAreEnabled(preferences: Record<NotificationCategory, boolean>) {
  return notificationCategoryKeys.some((key) => preferences[key]);
}

export function allNotificationTogglePatch(enabled: boolean, pushEnabled = enabled) {
  return {
    ...Object.fromEntries(notificationCategoryKeys.map((key) => [key, enabled])),
    push_enabled: pushEnabled,
  } as Record<NotificationCategory, boolean> & { push_enabled: boolean };
}
