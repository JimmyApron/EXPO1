import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { EmptyState } from '@/components/empty-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { ProjectCard } from '@/components/project-card';
import { ProjectCreateModal } from '@/components/project-create-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useProjectIdeaCounts } from '@/hooks/use-project-idea-counts';
import { useProjectFlowSummaries } from '@/hooks/use-project-flow-summaries';
import { useProjectStageProgress } from '@/hooks/use-project-stage-progress';
import { useProjectFavorites } from '@/hooks/use-project-favorites';
import { sortProjectsWithFavorites } from '@/lib/project-favorites';
import { useProjects } from '@/hooks/use-projects';
import { useTheme } from '@/hooks/use-theme';
import type { ProjectInput } from '@/types/project';

export default function ProjectsScreen() {
  const theme = useTheme();
  const { projects, isloadingprojects, projecterror, createProject } = useProjects();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects]);
  const { countsByProjectId, ideaCountsStatus, ideaCountsError } = useProjectIdeaCounts(projectIds);
  const { favoriteProjectIds, favoritesStatus, favoritesError, busyProjectId, toggleFavorite } = useProjectFavorites(projectIds);
  const { progressByProjectId, stageProgressStatus, stageProgressError } = useProjectStageProgress(projectIds);
  const sortedProjects = useMemo(
    () => sortProjectsWithFavorites(projects, favoriteProjectIds, 'deadline', favoriteOnly && favoritesStatus !== 'unavailable'),
    [favoriteOnly, favoriteProjectIds, favoritesStatus, projects],
  );
  const { flowsByProjectId, flowStatus } = useProjectFlowSummaries(projectIds);

  const openCreate = () => {
    setFormError('');
    setIsCreateOpen(true);
  };

  const handleCreate = async (input: ProjectInput) => {
    setIsCreating(true);
    setFormError('');
    const result = await createProject(input);
    if (result.error) setFormError(result.error);
    else setIsCreateOpen(false);
    setIsCreating(false);
    return !result.error;
  };

  return (
    <>
      <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scrollContent}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <ThemedView style={styles.container}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <ThemedText type="screenTitle">과제</ThemedText>
                <ThemedText type="body" themeColor="textSecondary">마감과 진행률을 확인하고 이어서 작업하세요.</ThemedText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="새 과제 만들기"
                onPress={openCreate}
                style={({ pressed }) => [styles.createButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
                <AppIcon name="add" color={theme.text} size={20} />
                <ThemedText type="button" style={styles.whiteText}>새 과제</ThemedText>
              </Pressable>
            </View>

            {projecterror || ideaCountsError || favoritesError || stageProgressError ? (
              <ThemedView type="dangerSoft" style={styles.errorBanner}>
                <ThemedText type="captionStrong" style={{ color: theme.danger }}>과제를 불러오지 못했습니다.</ThemedText>
                <ThemedText type="caption" style={{ color: theme.danger }}>{projecterror || ideaCountsError || favoritesError || stageProgressError} 다시 시도해 주세요.</ThemedText>
              </ThemedView>
            ) : null}

            {favoritesStatus !== 'unavailable' ? <Pressable accessibilityRole="button" accessibilityLabel="즐겨찾기 과제만 보기" accessibilityState={{ selected: favoriteOnly, disabled: favoritesStatus === 'loading' }} disabled={favoritesStatus === 'loading'} onPress={() => setFavoriteOnly((value) => !value)} style={{ minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: Spacing.three, borderWidth: 1, borderRadius: Radius.medium, borderColor: favoriteOnly ? theme.primary : theme.border }}><ThemedText type="smallBold">★ 즐겨찾기만 보기</ThemedText></Pressable> : null}
            {isloadingprojects || ideaCountsStatus === 'loading' || favoritesStatus === 'loading' ? <LoadingSkeleton rows={4} /> : sortedProjects.length === 0 ? (
              favoriteOnly ? <EmptyState icon="projects" title="즐겨찾기한 과제가 없어요" description="과제 카드의 별을 누르면 여기에 표시됩니다." />
                : <EmptyState icon="projects" title="아직 과제가 없어요" description="새 과제를 만들고 아이디어를 모아 보세요." actionLabel="새 과제 만들기" onAction={openCreate} />
            ) : (
              <View style={styles.list}>{sortedProjects.map((project) => <ProjectCard key={project.id} project={project} stats={countsByProjectId.get(project.id) ?? { total: 0, selected: 0 }} ideaCountsStatus={ideaCountsStatus} flow={flowsByProjectId.get(project.id)} flowStatus={flowStatus} stageRecords={progressByProjectId.get(project.id)} stageStatus={stageProgressStatus} favorite={favoriteProjectIds.has(project.id)} favoriteBusy={busyProjectId === project.id} onToggleFavorite={favoritesStatus === 'unavailable' ? undefined : () => void toggleFavorite(project.id)} />)}</View>
            )}
          </ThemedView>
        </SafeAreaView>
      </ScrollView>
      <ProjectCreateModal visible={isCreateOpen} isBusy={isCreating} error={formError} onClose={() => setIsCreateOpen(false)} onSubmit={handleCreate} />
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: { alignItems: 'center', paddingBottom: Spacing.five },
  safeArea: { width: '100%', alignItems: 'center' },
  container: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.three, gap: Spacing.four },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, paddingTop: Spacing.two },
  headerCopy: { flex: 1, gap: Spacing.one },
  createButton: { minHeight: ControlHeight.touch, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  whiteText: { color: '#1E293B' },
  errorBanner: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  list: { gap: Spacing.two },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
