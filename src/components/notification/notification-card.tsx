import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { NotificationKindLabels, type AppNotification, type NotificationKind } from '@/types/notification';

const kindColors: Record<NotificationKind, { background: string; text: string }> = {
  deadline: { background: '#fee2e2', text: '#b91c1c' },
  'idea-review': { background: '#fef3c7', text: '#92400e' },
  'final-selection': { background: '#dbeafe', text: '#1d4ed8' },
};

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '최근';
  }

  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (diffMinutes < 1) {
    return '방금 전';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}일 전`;
  }

  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

type NotificationCardProps = {
  notification: AppNotification;
  onRead: () => void;
  onDelete: () => void;
  onOpenProject: () => void;
};

export function NotificationCard({
  notification,
  onRead,
  onDelete,
  onOpenProject,
}: NotificationCardProps) {
  const kindColor = kindColors[notification.kind];

  return (
    <ThemedView
      type={notification.isRead ? 'backgroundElement' : undefined}
      style={[styles.card, !notification.isRead && styles.unreadCard]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          onRead();
          onOpenProject();
        }}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        <View style={styles.metaRow}>
          <View style={[styles.kindBadge, { backgroundColor: kindColor.background }]}>
            <ThemedText type="smallBold" style={{ color: kindColor.text }}>
              {NotificationKindLabels[notification.kind]}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {formatRelativeTime(notification.createdAt)}
          </ThemedText>
        </View>

        <View style={styles.titleRow}>
          {!notification.isRead ? <View accessibilityLabel="읽지 않음" style={styles.unreadDot} /> : null}
          <ThemedText type="smallBold" style={styles.title}>
            {notification.title}
          </ThemedText>
        </View>
        <ThemedText themeColor="textSecondary">{notification.message}</ThemedText>
      </Pressable>

      <View style={styles.actions}>
        {!notification.isRead ? (
          <Pressable onPress={onRead} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.readText}>
              읽음
            </ThemedText>
          </Pressable>
        ) : null}
        <Pressable onPress={onDelete} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.deleteText}>
            삭제
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: Spacing.three,
  },
  unreadCard: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  main: {
    gap: Spacing.two,
    padding: Spacing.three,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  kindBadge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
  title: {
    flex: 1,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.one,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    padding: Spacing.two,
  },
  actionButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  readText: {
    color: '#2563eb',
  },
  deleteText: {
    color: '#dc2626',
  },
  pressed: {
    opacity: 0.68,
  },
});
