import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import type { ProjectIdeaCounts } from '@/hooks/use-project-idea-counts';
import type { ProjectFlowSummary } from '@/hooks/use-project-flow-summaries';
import type { ProjectStageRecord } from '@/hooks/use-project-stage-progress';
import { formatDeadlineLabel, getDDayLabel } from '@/lib/deadline';
import { getProjectStageSummary } from '@/lib/project-progress';
import { normalizeProjectTemplate } from '@/lib/project-stages';
import type { Project } from '@/types/project';

// 🎨 디자인 가이드 컬러
const PALETTE = {
  primary: '#F59E0B',        // 메인 옐로우/오렌지
  primaryInk: '#92400E',
  primaryLight: '#FFFBEB',   // 피처드 카드 배경 (연노랑)
  primaryBorder: '#FDE68A',  // 피처드 카드 테두리
  card: '#FFFFFF',           // 기본 카드 흰색
  cardBorder: '#F3E8D6',     // 기본 카드 테두리
  text: '#1E293B',           // 짙은 네이비
  textSecondary: '#64748B',  // 보조 텍스트
  chipBg: '#FEF3C7',         // D-Day 칩 배경
  chipText: '#D97706',       // D-Day 칩 텍스트
  progressTrack: '#F1EAD9',  // 프로그레스 바 배경
  success: '#10B981',        // 100% 완료 색상
};

type ProjectCardProps = {
  project: Project;
  stats: ProjectIdeaCounts;
  flow?: ProjectFlowSummary;
  flowStatus?: 'loading' | 'error' | 'ready';
  featured?: boolean;
  stageRecords?: ProjectStageRecord[];
  stageStatus?: 'loading' | 'error' | 'ready' | 'unavailable';
  ideaCountsStatus?: 'loading' | 'error' | 'ready';
  favorite?: boolean;
  favoriteBusy?: boolean;
  onToggleFavorite?: () => void;
};

export function ProjectCard({ project, stats, flow, flowStatus = 'ready', featured = false, stageRecords = [], stageStatus = 'ready', ideaCountsStatus = 'ready', favorite = false, favoriteBusy = false, onToggleFavorite }: ProjectCardProps) {
  const summary = getProjectStageSummary(project, stats.total, stats.selected, flow, stageRecords);
  const progress = summary.percent;
  const isCompleted = progress === 100;
  const workflowStep = summary.currentStage.id;
  const status = normalizeProjectTemplate(project.template) === 'service_app'
    ? flowStatus === 'error' || ideaCountsStatus === 'error' ? 'error' : flowStatus === 'loading' || ideaCountsStatus === 'loading' ? 'loading' : 'ready'
    : stageStatus;
  const stageLabel = status === 'loading' ? '확인 중' : status === 'error' || status === 'unavailable' ? '확인할 수 없음' : isCompleted ? '모든 단계 완료' : `${summary.currentStage.label} 중`;
  return (
    <View style={[styles.card, featured ? styles.featuredCard : styles.standardCard, Shadows.card]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${project.title} 과제, ${getDDayLabel(project.deadline)}, ${summary.completedStageCount}/${summary.totalStageCount} 단계 완료, ${stageLabel}`}
        accessibilityHint="과제 상세 화면으로 이동합니다"
        onPress={() => router.push(`/projects/${project.id}?projectView=home${status === 'ready' ? `&flowStep=${workflowStep}` : ''}` as Href)}
        style={({ pressed }) => [styles.cardContent, featured && styles.featuredContent, pressed && styles.pressed]}>
      <View style={[styles.topRow, onToggleFavorite && styles.topRowWithFavorite]}>
        <View style={styles.titleBlock}>
          {featured ? (
            <View style={styles.featuredBadge}>
              <ThemedText style={styles.featuredBadgeText}>최근 업데이트한 과제</ThemedText>
            </View>
          ) : null}
          <ThemedText
            type={featured ? 'sectionTitle' : 'cardTitle'}
            style={[styles.titleText, featured && styles.featuredTitleText]}
            numberOfLines={2}>
            {project.title}
          </ThemedText>
        </View>
        <View style={styles.dayChip}>
          <ThemedText style={styles.dayChipText}>
            {getDDayLabel(project.deadline)}
          </ThemedText>
        </View>
      </View>

      <ThemedText style={styles.deadlineText}>
        {formatDeadlineLabel(project.deadline)}
      </ThemedText>

      {featured && project.description ? (
        <ThemedText style={styles.descriptionText} numberOfLines={2}>
          {project.description}
        </ThemedText>
      ) : null}

      <ThemedText style={styles.stageText}>현재 단계 · {stageLabel}</ThemedText>
      <ThemedText style={styles.stageText}>{summary.completedStageCount}/{summary.totalStageCount} 단계 완료</ThemedText>

      {/* 진행률 바 */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeading}>
          <ThemedText style={styles.progressLabel}>진행률</ThemedText>
          <ThemedText style={[styles.progressValue, isCompleted && { color: PALETTE.success }]}>
            {progress}%
          </ThemedText>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress}%`,
                backgroundColor: isCompleted ? PALETTE.success : PALETTE.primary,
              },
            ]}
          />
        </View>
      </View>

      {/* 하단 액션 링크 */}
      <View style={styles.footer}>
        <ThemedText style={styles.footerText}>이어서 하기</ThemedText>
        <AppIcon name="chevronRight" color={PALETTE.primaryInk} size={18} />
      </View>
      </Pressable>
      {onToggleFavorite ? <Pressable accessibilityRole="button" accessibilityLabel={favorite ? '과제 즐겨찾기 해제' : '과제 즐겨찾기'} accessibilityState={{ selected: favorite, disabled: favoriteBusy }} disabled={favoriteBusy}
        onPress={onToggleFavorite} style={[styles.favoriteButton, featured && styles.featuredFavoriteButton]}>
        <AppIcon name="favorite" color={favorite ? PALETTE.primary : PALETTE.textSecondary} size={22} />
      </Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.large,
  },
  cardContent: {
    gap: 12,
    padding: Spacing.four,
    borderRadius: Radius.large,
  },
  featuredContent: {
    padding: Spacing.four + 2,
  },
  standardCard: {
    backgroundColor: PALETTE.card,
    borderColor: PALETTE.cardBorder,
  },
  featuredCard: {
    backgroundColor: PALETTE.primaryLight,
    borderColor: PALETTE.primaryBorder,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  topRowWithFavorite: {
    paddingRight: 44 + Spacing.two,
  },
  favoriteButton: {
    position: 'absolute',
    top: Spacing.four,
    right: Spacing.four,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredFavoriteButton: {
    top: Spacing.four + 2,
    right: Spacing.four + 2,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  featuredBadge: {
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  featuredBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: PALETTE.primaryInk,
  },
  titleText: {
    color: PALETTE.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  featuredTitleText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  dayChip: {
    backgroundColor: PALETTE.chipBg,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: PALETTE.chipText,
  },
  deadlineText: {
    fontSize: 13,
    color: PALETTE.textSecondary,
    marginTop: -4,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: PALETTE.textSecondary,
  },
  stageText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: PALETTE.text,
  },
  progressSection: {
    gap: 6,
    marginTop: 2,
  },
  progressHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: PALETTE.textSecondary,
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '700',
    color: PALETTE.text,
  },
  progressTrack: {
    height: 7,
    borderRadius: Radius.pill,
    backgroundColor: PALETTE.progressTrack,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    marginTop: 2,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.primaryInk,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.995 }],
  },
});
