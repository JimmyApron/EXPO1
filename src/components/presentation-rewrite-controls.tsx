import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function PresentationRewriteControls({ disabled, loading, message, onRewrite }: {
  disabled: boolean;
  loading: boolean;
  message: string;
  onRewrite: (instruction: string) => void;
}) {
  const theme = useTheme();
  const [prompt, setPrompt] = useState('');
  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">이 부분만 재작성</ThemedText>
      <View style={styles.row}>
        {['더 짧게', '전문적으로', '분량 확대'].map((label) => (
          <Pressable key={label} accessibilityRole="button" disabled={disabled} onPress={() => onRewrite(label)}
            style={[styles.button, { borderColor: theme.border }, disabled && styles.disabled]}>
            <ThemedText type="smallBold">{label}</ThemedText>
          </Pressable>
        ))}
      </View>
      <TextInput value={prompt} onChangeText={setPrompt} editable={!disabled} multiline maxLength={1000}
        accessibilityLabel="부분 재작성 요청" placeholder="예: 핵심 문제를 두 문장으로 설명해 줘" placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
      <Pressable accessibilityRole="button" disabled={disabled || !prompt.trim()} onPress={() => onRewrite(prompt.trim())}
        style={[styles.button, { borderColor: theme.primary }, (disabled || !prompt.trim()) && styles.disabled]}>
        <ThemedText type="smallBold" style={{ color: theme.primary }}>요청대로 재작성·저장</ThemedText>
      </Pressable>
      {loading ? <View style={styles.row}><ActivityIndicator color={theme.primary} /><ThemedText type="small">재작성 및 저장 중…</ThemedText></View> : null}
      {message ? <ThemedText accessibilityLiveRegion="polite" type="small">{message}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  button: { alignSelf: 'flex-start', minHeight: ControlHeight.touch, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  input: { minHeight: 64, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.two, textAlignVertical: 'top' },
  disabled: { opacity: 0.5 },
});
