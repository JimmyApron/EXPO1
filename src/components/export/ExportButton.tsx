import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ExportButton({ label, disabled, busy, onPress }: { label: string; disabled: boolean; busy: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, { borderColor: theme.border, backgroundColor: theme.backgroundElement, opacity: disabled || pressed ? 0.6 : 1 }]}>
      {busy ? <ActivityIndicator color={theme.primary} /> : null}
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({ button: { minHeight: ControlHeight.touch, padding: Spacing.three, borderRadius: Radius.medium, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two } });
