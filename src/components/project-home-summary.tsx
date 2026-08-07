import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDeadlineLabel, getDDayLabel } from '@/lib/deadline';
import { getProjectProgressLabel, type ProjectWorkflowState } from '@/lib/project-workspace';

type ProjectHomeSummaryProps = {
  deadline?: string | null;
  ideaCount: number;
  selectedIdeaTitle?: string;
  workflowState: ProjectWorkflowState;
};

export function ProjectHomeSummary({
  deadline,
  ideaCount,
  selectedIdeaTitle,
  workflowState,
}: ProjectHomeSummaryProps) {
  const theme = useTheme();
  const progressLabel = getProjectProgressLabel(workflowState);

  return (
    <ThemedView type="backgroundElement" style={[styles.container, { borderColor: theme.border }, Shadows.card]}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <ThemedText type="cardTitle">현재 과제 진행 상태</ThemedText>
          <ThemedText type="subtitle" style={{ color: theme.primary }}>{progressLabel}</ThemedText>
        </View>
        <View style={[styles.deadlineChip, { backgroundColor: theme.warningSoft }]}>
          <ThemedText type="captionStrong" style={{ color: theme.warning }}>{getDDayLabel(deadline ?? null)}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">{formatDeadlineLabel(deadline ?? null)}</ThemedText>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <View style={[styles.metric, { borderColor: theme.border, backgroundColor: theme.background }]}>
          <ThemedText type="caption" themeColor="textSecondary">등록된 아이디어</ThemedText>
          <ThemedText type="sectionTitle">{ideaCount}개</ThemedText>
        </View>
        <View style={[styles.metric, styles.selectedMetric, { borderColor: theme.border, backgroundColor: theme.background }]}>
          <ThemedText type="caption" themeColor="textSecondary">현재 최종 선정 아이디어</ThemedText>
          <ThemedText type="cardTitle" numberOfLines={2}>{selectedIdeaTitle || '아직 선정되지 않음'}</ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three, borderWidth: 1, borderRadius: Radius.large, padding: Spacing.three },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.three },
  headingCopy: { flex: 1, minWidth: 220, gap: Spacing.one },
  deadlineChip: { alignSelf: 'flex-start', gap: Spacing.half, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  metric: { minWidth: 150, flex: 1, gap: Spacing.one, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  selectedMetric: { flexGrow: 2 },
});
