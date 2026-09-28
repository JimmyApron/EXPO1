import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { formatDeadlineLabel, getDDayLabel } from '@/lib/deadline';
import { getProjectProgressLabel, type ProjectWorkflowState } from '@/lib/project-workspace';

// 🎨 디자인 시스템 컬러 팔레트
const PALETTE = {
  primary: '#F59E0B',        // 메인 옐로우/오렌지
  primaryLight: '#FFFBEB',   // 연노랑 하이라이트
  cardBg: '#FFFFFF',         // 메인 카드 흰색
  cardBorder: '#F3E8D6',     // 크림색 테두리
  metricBg: '#FAF7F2',       // 내부 메트릭 박스 크림색
  metricBorder: '#EFE6D8',   // 내부 박스 테두리
  text: '#1E293B',           // 짙은 네이비 본문
  textSecondary: '#64748B',  // 부제목 그레이
  chipBg: '#FEF3C7',         // D-Day 칩 배경
  chipText: '#D97706',       // D-Day 칩 텍스트
};

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
  const progressLabel = getProjectProgressLabel(workflowState);

  return (
    <View
      style={[
        styles.container,
        Shadows.card,
      ]}>
      {/* 상단 헤더 영역 */}
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <ThemedText style={styles.subTitle}>현재 과제 진행 상태</ThemedText>
          <ThemedText style={styles.mainTitle}>{progressLabel}</ThemedText>
        </View>
        <View style={styles.deadlineChip}>
          <ThemedText style={styles.dayText}>
            {getDDayLabel(deadline ?? null)}
          </ThemedText>
          <ThemedText style={styles.deadlineDateText}>
            {formatDeadlineLabel(deadline ?? null)}
          </ThemedText>
        </View>
      </View>

      {/* 통계 / 핵심 요약 지표 영역 */}
      <View style={styles.metricGrid}>
        {/* 등록된 아이디어 개수 카드 */}
        <View style={[styles.metric, styles.countMetric]}>
          <ThemedText style={styles.metricLabel}>등록된 아이디어</ThemedText>
          <ThemedText style={styles.metricCountValue}>{ideaCount}개</ThemedText>
        </View>

        {/* 현재 최종 선정 아이디어 카드 */}
        <View style={[styles.metric, styles.selectedMetric]}>
          <ThemedText style={styles.metricLabel}>현재 최종 선정 아이디어</ThemedText>
          <ThemedText
            style={[
              styles.selectedTitleText,
              !selectedIdeaTitle && styles.emptyTitleText,
            ]}
            numberOfLines={2}>
            {selectedIdeaTitle || '아직 선정되지 않음'}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: PALETTE.cardBg,
    borderColor: PALETTE.cardBorder,
    borderWidth: 1,
    borderRadius: Radius.large,
    gap: Spacing.three,
    padding: Spacing.four,
  },
  headingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  headingCopy: {
    flex: 1,
    minWidth: 200,
    gap: 2,
  },
  subTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: PALETTE.textSecondary,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: PALETTE.primary,
    letterSpacing: -0.5,
  },
  deadlineChip: {
    alignSelf: 'flex-start',
    backgroundColor: PALETTE.chipBg,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 2,
    alignItems: 'flex-end',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '800',
    color: PALETTE.chipText,
  },
  deadlineDateText: {
    fontSize: 12,
    color: PALETTE.chipText,
    opacity: 0.85,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: 2,
  },
  metric: {
    backgroundColor: PALETTE.metricBg,
    borderColor: PALETTE.metricBorder,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: 4,
    justifyContent: 'center',
  },
  countMetric: {
    minWidth: 120,
    flex: 1,
  },
  selectedMetric: {
    flex: 2,
    minWidth: 200,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: PALETTE.textSecondary,
  },
  metricCountValue: {
    fontSize: 18,
    fontWeight: '800',
    color: PALETTE.text,
  },
  selectedTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: PALETTE.text,
    lineHeight: 20,
  },
  emptyTitleText: {
    color: PALETTE.textSecondary,
    fontWeight: '500',
  },
});
