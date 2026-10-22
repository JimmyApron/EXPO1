import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { presentationPalette, presentationThemes, type PresentationTheme } from '@/lib/presentation-themes';

export function PresentationThemePicker({ value, onChange, disabled = false }: {
  value: PresentationTheme; onChange: (value: PresentationTheme) => void; disabled?: boolean;
}) {
  const theme = useTheme();
  return <View style={styles.group}>
    {([false, true] as const).map(premium => <View key={String(premium)} style={styles.group}>
      <ThemedText type="smallBold">{premium ? '프리미엄 테마' : '기본 테마'}</ThemedText>
      <View style={styles.options}>{presentationThemes.filter(item => item.premium === premium).map(item => {
        const colors = presentationPalette[item.id];
        const selected = value === item.id;
        return <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }}
          accessibilityLabel={`${item.label}${premium ? ' 구독 전용' : ''} 미리보기`}
          disabled={disabled} onPress={() => onChange(item.id)}
          style={[styles.option, { borderColor: selected ? theme.primary : theme.border }]}>
          <View style={[styles.preview, { backgroundColor: colors.background }]}>
            <View style={[styles.accent, { backgroundColor: colors.accent }]} />
            <View style={[styles.previewTitle, { backgroundColor: colors.foreground }]} />
            <View style={[styles.previewLine, { backgroundColor: colors.muted }]} />
            <View style={[styles.previewLine, styles.shortLine, { backgroundColor: colors.muted }]} />
            <View style={[styles.previewFoot, { backgroundColor: colors.surface }]} />
          </View>
          <ThemedText type="smallBold">{item.label}</ThemedText>
          {premium ? <ThemedText type="caption" themeColor="textSecondary">구독 전용</ThemedText> : null}
        </Pressable>;
      })}</View>
    </View>)}
    <ThemedText type="caption" themeColor="textSecondary">모든 테마를 미리 볼 수 있습니다. 프리미엄 적용에는 활성 구독 또는 무료체험이 필요합니다.</ThemedText>
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: { width: 150, padding: Spacing.two, gap: Spacing.one, borderWidth: 1, borderRadius: Radius.medium },
  preview: { height: 75, borderRadius: Radius.medium, overflow: 'hidden', padding: 10, gap: 5 },
  accent: { width: 24, height: 3 }, previewTitle: { width: '65%', height: 8, borderRadius: 2 },
  previewLine: { width: '82%', height: 4, borderRadius: 2, opacity: 0.7 },
  shortLine: { width: '58%' }, previewFoot: { marginTop: 'auto', width: '100%', height: 8, borderRadius: 2 },
});
