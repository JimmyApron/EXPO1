import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { BrandIcon } from '@/components/brand-icon';
import { EmptyState } from '@/components/empty-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { ProjectCard } from '@/components/project-card';
import { ProjectCreateModal } from '@/components/project-create-modal';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppNotifications } from '@/hooks/use-app-notifications';
import { useProjectIdeaStats } from '@/hooks/use-project-idea-stats';
import { useProjectIdeaCounts } from '@/hooks/use-project-idea-counts';
import { useProjectFlowSummaries } from '@/hooks/use-project-flow-summaries';
import { useProjectStageProgress } from '@/hooks/use-project-stage-progress';
import { useProjectFavorites } from '@/hooks/use-project-favorites';
import { sortProjectsWithFavorites } from '@/lib/project-favorites';
import { useProjects } from '@/hooks/use-projects';
import { useTheme } from '@/hooks/use-theme';
import type { ProjectInput } from '@/types/project';

export default function HomeScreen() {
  const theme = useTheme();
  const { projects, isloadingprojects, projecterror, createProject } = useProjects();
  const { unreadCount } = useAppNotifications();
  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const { totals, isLoadingStats } = useProjectIdeaStats();
  const { countsByProjectId, ideaCountsStatus, ideaCountsError } = useProjectIdeaCounts(projectIds);
  const { flowsByProjectId, flowStatus } = useProjectFlowSummaries(projectIds);
  const { progressByProjectId, stageProgressStatus, stageProgressError } = useProjectStageProgress(projectIds);
  const { favoriteProjectIds, favoritesStatus, favoritesError, busyProjectId, toggleFavorite } = useProjectFavorites(projectIds);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const recentProjects = useMemo(
    () => sortProjectsWithFavorites(projects, favoriteProjectIds, 'updated'),
    [favoriteProjectIds, projects],
  );
  const featuredProject = recentProjects[0] ?? null;
  const otherProjects = recentProjects.slice(1);

  const openCreate = () => {
    setFormError('');
    setIsCreateOpen(true);
  };

  const handleCreate = async (input: ProjectInput) => {
    setIsCreating(true);
    setFormError('');
    const result = await createProject(input);
    setIsCreating(false);
    if (result.error) {
      setFormError(result.error);
      return false;
    }
    if (result.project) {
      setIsCreateOpen(false);
      router.push(`/projects/${result.project.id}` as Href);
    }
    return true;
  };

  return (
    <>
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        {/* 상단 헤더: 브랜드 및 빠른 액션 */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <BrandIcon size={38} />
            <ThemedText type="title" style={{ color: theme.text }}>
              Watt
            </ThemedText>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="새 과제 만들기"
              onPress={openCreate}
              style={({ pressed }) => [
                styles.createButton,
                { backgroundColor: theme.primary },
                pressed && styles.pressed,
              ]}>
              <AppIcon name="add" color={theme.text} size={18} />
              <ThemedText type="smallBold" style={styles.createButtonText}>
                새 과제
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="알림"
              onPress={() => router.push('/notifications' as Href)}
              style={({ pressed }) => [
                styles.iconButton,
                { borderColor: theme.border, backgroundColor: theme.surface },
                pressed && styles.pressed,
              ]}>
              <AppIcon name="notifications" color={theme.text} size={20} />
              {unreadCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: theme.danger }]}>
                  <ThemedText style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="내 정보"
              onPress={() => router.push('/profile' as Href)}
              style={({ pressed }) => [
                styles.iconButton,
                { borderColor: theme.border, backgroundColor: theme.surface },
                pressed && styles.pressed,
              ]}>
              <AppIcon name="profile" color={theme.text} size={20} />
            </Pressable>
          </View>
        </View>

        {/* 내 작업 통계 칩 */}
        <View style={styles.statsRow}>
          <View style={[styles.statsBadge, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
            <ThemedText style={styles.statsBadgeLabel}>내 작업</ThemedText>
            <ThemedText style={styles.statsBadgeValue}>과제 {projects.length}</ThemedText>
            <ThemedText style={styles.statsBadgeValue}>아이디어 {totals.totalIdeas}</ThemedText>
            <ThemedText style={styles.statsBadgeValue}>최종 선정 {totals.selectedIdeas}</ThemedText>
          </View>
        </View>

        {/* 메인 타이틀 안내문구 */}
        <View style={styles.heroSection}>
          <ThemedText style={styles.heroTitle}>오늘 무엇을 이어갈까요?</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            마감과 피드백을 확인하고 가장 중요한 과제부터 진행하세요.
          </ThemedText>
        </View>

        {/* 프로젝트 목록 */}
        {projecterror || ideaCountsError || favoritesError || stageProgressError ? <ThemedText style={{ color: theme.danger }}>{projecterror || ideaCountsError || favoritesError || stageProgressError}</ThemedText> : null}
        {isloadingprojects || isLoadingStats ? <LoadingSkeleton rows={3} /> : projects.length === 0 ? (
          <EmptyState
            icon="projects"
            title="아직 등록된 과제가 없어요"
            description="새로운 프로젝트나 과제를 만들고 아이디어를 모아보세요."
            actionLabel="첫 과제 만들기"
            onAction={openCreate}
          />
        ) : (
          <View style={styles.projectList}>
            {featuredProject ? (
              <ProjectCard
                key={featuredProject.id}
                project={featuredProject}
                stats={countsByProjectId.get(featuredProject.id) ?? { total: 0, selected: 0 }} ideaCountsStatus={ideaCountsStatus}
                flow={flowsByProjectId.get(featuredProject.id)}
                flowStatus={flowStatus}
                stageRecords={progressByProjectId.get(featuredProject.id)} stageStatus={stageProgressStatus}
                favorite={favoriteProjectIds.has(featuredProject.id)} favoriteBusy={busyProjectId === featuredProject.id || favoritesStatus === 'loading'} onToggleFavorite={favoritesStatus === 'unavailable' ? undefined : () => void toggleFavorite(featuredProject.id)}
                featured
              />
            ) : null}

            {otherProjects.length > 0 ? (
              <View style={styles.otherGrid}>
                {otherProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    stats={countsByProjectId.get(project.id) ?? { total: 0, selected: 0 }} ideaCountsStatus={ideaCountsStatus}
                    flow={flowsByProjectId.get(project.id)}
                    flowStatus={flowStatus}
                    stageRecords={progressByProjectId.get(project.id)} stageStatus={stageProgressStatus}
                    favorite={favoriteProjectIds.has(project.id)} favoriteBusy={busyProjectId === project.id || favoritesStatus === 'loading'} onToggleFavorite={favoritesStatus === 'unavailable' ? undefined : () => void toggleFavorite(project.id)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
    <ProjectCreateModal visible={isCreateOpen} isBusy={isCreating} error={formError} onClose={() => setIsCreateOpen(false)} onSubmit={handleCreate} />
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.four,
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 1040,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  createButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  createButtonText: {
    color: '#1E293B',
    fontSize: 13,
    fontWeight: '700',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
  },
  statsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  statsBadgeLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
  },
  statsBadgeValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  heroSection: {
    gap: 4,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  projectList: {
    gap: Spacing.three,
  },
  otherGrid: {
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.75,
  },
});
