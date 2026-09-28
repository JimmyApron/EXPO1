import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MvpEffort } from '@/types/mvp-plan';

export function MvpEffortTags({ effort }: { effort?: MvpEffort }) {
  const theme = useTheme();
  if (!effort) return <ThemedText type="small" themeColor="textSecondary">난이도 정보 없음 · 새로 생성하면 확인할 수 있어요.</ThemedText>;
  return (
    <View style={styles.container}>
      <View style={styles.tags}>
        {[effort.difficulty, `예상 ${effort.estimatedWeeks}주`, ...effort.requiredSkills].map((label, index) => (
          <View key={`${label}:${index}`} style={[styles.tag, { backgroundColor: theme.primarySoft }]}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>{label}</ThemedText>
          </View>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">초급 팀 참고: {effort.beginnerComment}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  tag: { borderRadius: Radius.small, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
});
