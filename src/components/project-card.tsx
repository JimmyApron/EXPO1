import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { ProjectIdeaStats } from '@/hooks/use-project-idea-stats';
import { useTheme } from '@/hooks/use-theme';
import { formatDeadlineLabel, getDDayLabel } from '@/lib/deadline';
import type { Project } from '@/types/project';

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
  const theme = useTheme();
  const progress = getProjectProgress(stats);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${project.title} 과제, ${getDDayLabel(project.deadline)}, 진행률 ${progress}%`}
      accessibilityHint="과제 상세 화면으로 이동합니다"
      onPress={() => router.push(`/projects/${project.id}` as Href)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: featured ? theme.primarySoft : theme.surface, borderColor: featured ? theme.primary : theme.border },
        featured && styles.featured,
        pressed && styles.pressed,
      ]}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          {featured ? <ThemedText type="caption" style={{ color: theme.primary }}>지금 이어서 할 과제</ThemedText> : null}
          <ThemedText type={featured ? 'sectionTitle' : 'cardTitle'} numberOfLines={2}>{project.title}</ThemedText>
        </View>
        <View style={[styles.dayChip, { backgroundColor: theme.warningSoft }]}>
          <ThemedText type="captionStrong" style={{ color: theme.warning }}>{getDDayLabel(project.deadline)}</ThemedText>
        </View>
      </View>

      <ThemedText type="caption" themeColor="textSecondary">{formatDeadlineLabel(project.deadline)}</ThemedText>
      {featured && project.description ? (
        <ThemedText type="body" themeColor="textSecondary" numberOfLines={2}>{project.description}</ThemedText>
      ) : null}

      <View style={styles.progressHeading}>
        <ThemedText type="caption" themeColor="textSecondary">진행률</ThemedText>
        <ThemedText type="captionStrong">{progress}%</ThemedText>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${progress}%` }]} />
      </View>

      <View style={styles.footer}>
        <ThemedText type="button" style={{ color: theme.primary }}>이어서 하기</ThemedText>
        <AppIcon name="chevronRight" color={theme.primary} size={20} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.large, gap: 10, padding: Spacing.three },
  featured: { padding: Spacing.four },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.two },
  titleBlock: { flex: 1, gap: Spacing.one },
  dayChip: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  progressHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.one },
  progressTrack: { height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.pill },
  footer: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.one, marginTop: Spacing.one },
  pressed: { opacity: 0.78, transform: [{ scale: 0.992 }] },
});
