import { Alert, Platform, Pressable, StyleSheet, View, type TextInputProps } from 'react-native';
import type { ReactNode } from 'react';
import { ScaledTextInput as TextInput } from '@/components/scaled-text-input';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
export const workspaceStyles = StyleSheet.create({
  panel: { gap: 16, padding: 18, borderWidth: 1, borderRadius: 14 },
  group: { gap: 12 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  item: { gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EFE6D8' },
  editor: { minHeight: 260, textAlignVertical: 'top', fontSize: 16, lineHeight: 26 },
});
export function WorkspaceButton({ children, onPress, disabled = false, selected = false, danger = false }: { children: string; onPress: () => void; disabled?: boolean; selected?: boolean; danger?: boolean }) {
  const t = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={children} accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: selected ? t.primary : t.border, backgroundColor: selected ? t.primarySoft : t.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 })}>
    <ThemedText type="smallBold" style={{ color: danger ? t.danger : t.text }}>{children}</ThemedText>
  </Pressable>;
}
export function WorkspaceField({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return <View style={{ gap: 6 }}><ThemedText type="smallBold">{label}</ThemedText>
    <TextInput accessibilityLabel={label} placeholderTextColor={t.textSecondary} multiline {...props}
      style={[{ minHeight: props.multiline === false ? 44 : 72, borderWidth: 1, borderColor: t.border, borderRadius: 10, padding: 12, color: t.text, backgroundColor: t.background, textAlignVertical: 'top' }, props.style]} />
  </View>;
}
export function WorkspacePanel({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme();
  return <View style={[workspaceStyles.panel, { backgroundColor: t.surface, borderColor: t.border }]}><ThemedText type="sectionTitle">{title}</ThemedText>{children}</View>;
}
export function confirmWorkspaceAction(message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') { if (globalThis.confirm(message)) onConfirm(); }
  else Alert.alert('내용 변경 확인', message, [{ text: '취소', style: 'cancel' }, { text: '확인', onPress: onConfirm }]);
}
