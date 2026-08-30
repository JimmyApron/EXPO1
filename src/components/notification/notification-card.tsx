import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { NotificationKindLabels, type AppNotification, type NotificationKind } from '@/types/notification';

const kindColors: Record<NotificationKind, { background: string; text: string }> = {
  deadline: { background: '#fee2e2', text: '#b91c1c' },
  ideareview: { background: '#fef3c7', text: '#92400e' },
  finalselection: { background: '#FEF3C7', text: '#D97706' },
  stalledidea: { background: '#f1f5f9', text: '#475569' },
  feedback: { background: '#E7F8EF', text: '#168B51' },
  likesurge: { background: '#fce7f3', text: '#be185d' },
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
  const theme = useTheme();
  const kindColor = kindColors[notification.kind];

  return (
    <ThemedView
      type={notification.isread ? 'backgroundElement' : undefined}
      style={[
        styles.card,
        { borderColor: theme.border },
        !notification.isread && { borderColor: theme.primary, backgroundColor: theme.primarySoft },
        Shadows.card,
      ]}>
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
            {formatRelativeTime(notification.createdat)}
          </ThemedText>
        </View>

        <View style={styles.titleRow}>
          {!notification.isread ? <View accessibilityLabel="읽지 않음" style={[styles.unreadDot, { backgroundColor: theme.primary }]} /> : null}
          <ThemedText type="smallBold" style={styles.title}>
            {notification.title}
          </ThemedText>
        </View>
        <ThemedText themeColor="textSecondary">{notification.message}</ThemedText>
      </Pressable>

      <View style={[styles.actions, { borderTopColor: theme.divider }]}>
        {!notification.isread ? (
          <Pressable onPress={onRead} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={[styles.readText, { color: theme.primary }]}>
              읽음
            </ThemedText>
          </Pressable>
        ) : null}
        <Pressable onPress={onDelete} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={[styles.deleteText, { color: theme.danger }]}>
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
    borderRadius: Radius.large,
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
    borderRadius: Radius.pill,
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
    padding: Spacing.two,
  },
  actionButton: {
    minHeight: ControlHeight.touch,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  readText: {
    fontWeight: '700',
  },
  deleteText: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.68,
  },
});
