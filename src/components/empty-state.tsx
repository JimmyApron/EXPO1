import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type EmptyStateProps = {
  icon?: AppIconName;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon = 'idea', title, description, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
        <AppIcon name={icon} color={theme.primary} size={26} />
      </View>
      <ThemedText type="cardTitle" style={styles.centerText}>{title}</ThemedText>
      <ThemedText type="body" themeColor="textSecondary" style={styles.centerText}>{description}</ThemedText>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.action, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
          <ThemedText type="button" style={styles.actionText}>{actionLabel}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.five, paddingHorizontal: Spacing.three },
  icon: { width: 52, height: 52, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  centerText: { textAlign: 'center', maxWidth: 420 },
  action: { minHeight: ControlHeight.button, borderRadius: Radius.medium, justifyContent: 'center', paddingHorizontal: Spacing.three, marginTop: Spacing.one },
  actionText: { color: '#FFFFFF' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
