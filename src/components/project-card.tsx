import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import type { ProjectIdeaStats } from '@/hooks/use-project-idea-stats';
import { formatDeadlineLabel, getDDayLabel } from '@/lib/deadline';
import type { Project } from '@/types/project';

// 🎨 디자인 가이드 컬러
const PALETTE = {
  primary: '#F59E0B',        // 메인 옐로우/오렌지
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

export function getProjectProgress(stats: ProjectIdeaStats) {
  if (stats.total === 0) return 0;
  return Math.round((stats.selected / stats.total) * 100);
}

type ProjectCardProps = {
  project: Project;
  stats: ProjectIdeaStats;
  featured?: boolean;
};

export function ProjectCard({ project, stats, featured = false }: ProjectCardProps) {
  const progress = getProjectProgress(stats);
  const isCompleted = progress === 100;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${project.title} 과제, ${getDDayLabel(project.deadline)}, 진행률 ${progress}%`}
      accessibilityHint="과제 상세 화면으로 이동합니다"
      onPress={() => router.push(`/projects/${project.id}` as Href)}
      style={({ pressed }) => [
        styles.card,
        featured ? styles.featuredCard : styles.standardCard,
        Shadows.card,
        pressed && styles.pressed,
      ]}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          {featured ? (
            <View style={styles.featuredBadge}>
              <ThemedText style={styles.featuredBadgeText}>⚡ 지금 이어서 할 과제</ThemedText>
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
        <AppIcon name="chevronRight" color={PALETTE.primary} size={18} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.large,
    gap: 12,
    padding: Spacing.four,
  },
  standardCard: {
    backgroundColor: PALETTE.card,
    borderColor: PALETTE.cardBorder,
  },
  featuredCard: {
    backgroundColor: PALETTE.primaryLight,
    borderColor: PALETTE.primaryBorder,
    padding: Spacing.four + 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
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
    color: '#D97706',
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
    color: PALETTE.primary,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.995 }],
  },
});
