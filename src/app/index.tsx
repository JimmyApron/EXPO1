import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProjectForm } from '@/components/project-form';
import { RoomPanel } from '@/components/room-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useFavoriteIdeas } from '@/hooks/use-favorite-ideas';
import { useNotifications } from '@/hooks/use-notifications';
import { useProjectIdeaStats, type ProjectIdeaStats } from '@/hooks/use-project-idea-stats';
import { useProjects } from '@/hooks/use-projects';
import { useTheme } from '@/hooks/use-theme';
import { formatDeadlineLabel, getDDayLabel } from '@/lib/deadline';
import { getIdeaCategoryLabel, type IdeaCategory } from '@/types/idea';
import type { Project, ProjectInput } from '@/types/project';


type FavoriteProjectSummary = {
  projectid: string;
  projectTitle: string;
  categories: IdeaCategory[];
};

type HomeSectionKey = 'urgent' | 'favorite' | 'all';

function getDeadlineTime(deadline: string | null) {
  if (!deadline) {
    return Number.POSITIVE_INFINITY;
  }

  const time = new Date(`${deadline}T00:00:00`).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function getProgressPercent(stats: ProjectIdeaStats) {
  if (stats.total === 0) {
    return 0;
  }

  return Math.round((stats.selected / stats.total) * 100);
}

function DashboardStat({ label, value, tone }: { label: string; value: string; tone?: 'blue' | 'green' | 'orange' }) {
  return (
    <ThemedView type="backgroundElement" style={[styles.statCard, tone === 'green' && styles.greenStat, tone === 'orange' && styles.orangeStat]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="subtitle" style={styles.statValue}>
        {value}
      </ThemedText>
    </ThemedView>
  );
}

function ProjectCard({ project, stats }: { project: Project; stats: ProjectIdeaStats }) {
  const progress = getProgressPercent(stats);

  return (
    <Pressable
      onPress={() => router.push(`/projects/${project.id}` as Href)}
      style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={styles.projectCard}>
        <View style={styles.projectCardHeader}>
          <View style={styles.projectTitleBlock}>
            <ThemedText type="smallBold" style={styles.projectTitle}>
              {project.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDeadlineLabel(project.deadline)}
            </ThemedText>
          </View>
          <View style={styles.dDayPill}>
            <ThemedText type="smallBold" style={styles.dDayText}>
              {getDDayLabel(project.deadline)}
            </ThemedText>
          </View>
        </View>

        <ThemedText themeColor="textSecondary" style={styles.projectDescription}>
          {project.description || '과제 조건이나 방향을 아직 적지 않았습니다.'}
        </ThemedText>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <View style={styles.metricRow}>
          <ThemedText type="small" themeColor="textSecondary">
            아이디어 {stats.total}개
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            쓸 만함 {stats.approved}개
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            최종 {stats.selected}개
          </ThemedText>
        </View>
      </ThemedView>
    </Pressable>
  );
}

function FavoriteProjectCard({ item }: { item: FavoriteProjectSummary }) {
  return (
    <Pressable
      onPress={() => router.push(`/projects/${item.projectid}` as Href)}
      style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={styles.favoriteCard}>
        <ThemedText type="smallBold" style={styles.favoriteProjectTitle}>
          {item.projectTitle}
        </ThemedText>
        <View style={styles.categoryRow}>
          {item.categories.map((category) => (
            <View key={category} style={styles.categoryPill}>
              <ThemedText type="smallBold" style={styles.categoryText}>
                {getIdeaCategoryLabel(category)}
              </ThemedText>
            </View>
          ))}
        </View>
      </ThemedView>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { user, signout } = useAuth();
  const { projects, isloadingprojects, projecterror, createProject } = useProjects();
  const { favoriteIdeas, isLoadingFavoriteIdeas, favoriteIdeaError } = useFavoriteIdeas();
  const { unreadCount } = useNotifications(projects);
  const { totals, isLoadingStats, statsError, getStatsForProject } = useProjectIdeaStats();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [iscreating, setIscreating] = useState(false);
  const [formerror, setFormerror] = useState('');
  const [openSections, setOpenSections] = useState<Record<HomeSectionKey, boolean>>({
    urgent: false,
    favorite: false,
    all: false,
  });
  const theme = useTheme();

  const isLoading = isloadingprojects || isLoadingStats;
  const urgentProjects = useMemo(
    () =>
      [...projects]
        .filter((project) => project.deadline)
        .sort((left, right) => getDeadlineTime(left.deadline) - getDeadlineTime(right.deadline))
        .slice(0, 3),
    [projects],
  );

  const favoriteProjects = useMemo(() => {
    const projectTitles = new Map(projects.map((project) => [project.id, project.title]));
    const grouped = new Map<string, FavoriteProjectSummary>();

    favoriteIdeas.forEach((idea) => {
      const current = grouped.get(idea.projectid);

      if (current) {
        if (!current.categories.includes(idea.category)) {
          current.categories.push(idea.category);
        }
        return;
      }

      grouped.set(idea.projectid, {
        projectid: idea.projectid,
        projectTitle: projectTitles.get(idea.projectid) ?? '알 수 없는 과제',
        categories: [idea.category],
      });
    });

    return Array.from(grouped.values());
  }, [favoriteIdeas, projects]);

  const handleCreateProject = async (input: ProjectInput) => {
    setIscreating(true);
    setFormerror('');

    const result = await createProject(input);

    if (result.error) {
      setFormerror(result.error);
    } else {
      setIsCreateOpen(false);
    }

    setIscreating(false);
  };

  const toggleSection = (section: HomeSectionKey) => {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }));
  };

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerTitle}>
                <ThemedText type="subtitle">IdeaNote Lab</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.headerCopy}>
                  흩어진 과제 아이디어를 모으고, 상태별로 정리하고,{'\n'}
                  최종안까지 발전시키는 프로젝트 노트입니다.
                </ThemedText>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  onPress={() => router.push('/notifications' as Href)}
                  style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.notificationButtonText}>
                    알림
                  </ThemedText>
                  {unreadCount > 0 ? (
                    <View style={styles.notificationBadge}>
                      <ThemedText type="smallBold" style={styles.notificationBadgeText}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </ThemedText>
                    </View>
                  ) : null}
                </Pressable>
                <Pressable
                  onPress={() => {
                    setFormerror('');
                    setIsCreateOpen(true);
                  }}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.primaryButtonText}>
                    + 새 과제
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={signout}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">로그아웃</ThemedText>
                </Pressable>
              </View>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {user?.email ?? user?.id}
            </ThemedText>
          </View>

          <View style={styles.statGrid}>
            <DashboardStat label="진행 중 과제" value={`${projects.length}개`} tone="blue" />
            <DashboardStat label="모은 아이디어" value={`${totals.totalIdeas}개`} />
            <DashboardStat label="최종 사용" value={`${totals.selectedIdeas}개`} tone="green" />
            <DashboardStat label="즐겨찾기" value={`${totals.favoriteIdeas}개`} tone="orange" />
          </View>

          {(projecterror || statsError) ? (
            <ThemedText type="small" style={styles.errorText}>
              {projecterror || statsError}
            </ThemedText>
          ) : null}

          <RoomPanel />

          <View style={styles.section}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`마감 임박 섹션 ${openSections.urgent ? '접기' : '펼치기'}`}
              onPress={() => toggleSection('urgent')}
              style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}>
              <View>
                <ThemedText type="smallBold">마감 임박</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  먼저 챙겨야 할 과제입니다.
                </ThemedText>
              </View>
              <View style={styles.sectionHeaderMeta}>
                <ThemedText type="small" themeColor="textSecondary">
                  {urgentProjects.length}개
                </ThemedText>
                <ThemedText type="smallBold" style={styles.sectionToggleText}>
                  {openSections.urgent ? '접기' : '펼치기'}
                </ThemedText>
              </View>
            </Pressable>

            {openSections.urgent ? isLoading ? (
              <ThemedView type="backgroundElement" style={styles.emptyState}>
                <ActivityIndicator />
              </ThemedView>
            ) : urgentProjects.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyState}>
                <ThemedText type="smallBold">마감일이 등록된 과제가 없습니다.</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  새 과제를 만들고 마감일을 지정해 보세요.
                </ThemedText>
              </ThemedView>
            ) : (
              <View style={styles.projectList}>
                {urgentProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} stats={getStatsForProject(project.id)} />
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`즐겨찾기 아이디어 섹션 ${openSections.favorite ? '접기' : '펼치기'}`}
              onPress={() => toggleSection('favorite')}
              style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}>
              <View>
                <ThemedText type="smallBold">즐겨찾기 아이디어</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  다시 볼 만한 아이디어가 있는 과제입니다.
                </ThemedText>
              </View>
              <View style={styles.sectionHeaderMeta}>
                <ThemedText type="small" themeColor="textSecondary">
                  {favoriteProjects.length}개
                </ThemedText>
                <ThemedText type="smallBold" style={styles.sectionToggleText}>
                  {openSections.favorite ? '접기' : '펼치기'}
                </ThemedText>
              </View>
            </Pressable>

            {openSections.favorite ? (
              <>
                {favoriteIdeaError ? (
                  <ThemedText type="small" style={styles.errorText}>
                    {favoriteIdeaError}
                  </ThemedText>
                ) : null}

                {isLoadingFavoriteIdeas || isloadingprojects ? (
                  <ThemedView type="backgroundElement" style={styles.emptyState}>
                    <ActivityIndicator />
                  </ThemedView>
                ) : favoriteProjects.length === 0 ? (
                  <ThemedView type="backgroundElement" style={styles.emptyState}>
                    <ThemedText type="smallBold">즐겨찾기한 아이디어가 없습니다.</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                      과제 상세에서 중요한 아이디어에 별표를 눌러 모아 보세요.
                    </ThemedText>
                  </ThemedView>
                ) : (
                  <View style={styles.favoriteList}>
                    {favoriteProjects.map((item) => (
                      <FavoriteProjectCard key={item.projectid} item={item} />
                    ))}
                  </View>
                )}
              </>
            ) : null}
          </View>

          <View style={styles.section}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`전체 과제 섹션 ${openSections.all ? '접기' : '펼치기'}`}
              onPress={() => toggleSection('all')}
              style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}>
              <View>
                <ThemedText type="smallBold">전체 과제</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  아이디어 수와 최종 사용 현황을 한눈에 확인하세요.
                </ThemedText>
              </View>
              <View style={styles.sectionHeaderMeta}>
                <ThemedText type="small" themeColor="textSecondary">
                  {projects.length}개
                </ThemedText>
                <ThemedText type="smallBold" style={styles.sectionToggleText}>
                  {openSections.all ? '접기' : '펼치기'}
                </ThemedText>
              </View>
            </Pressable>

            {openSections.all ? isLoading ? (
              <ThemedView type="backgroundElement" style={styles.emptyState}>
                <ActivityIndicator />
              </ThemedView>
            ) : projects.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyState}>
                <ThemedText type="smallBold">아직 생성한 과제가 없습니다.</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  발표, 리포트, 팀 프로젝트별 보관함을 만들어 보세요.
                </ThemedText>
              </ThemedView>
            ) : (
              <View style={styles.projectList}>
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} stats={getStatsForProject(project.id)} />
                ))}
              </View>
            ) : null}
          </View>
        </ThemedView>
      </SafeAreaView>

      <Modal visible={isCreateOpen} transparent animationType="fade" onRequestClose={() => setIsCreateOpen(false)}>
        <View style={styles.modalOverlay}>
          <ThemedView style={[styles.modalPanel, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="smallBold" style={styles.modalTitle}>
                새 과제 만들기
              </ThemedText>
              <Pressable
                onPress={() => setIsCreateOpen(false)}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold">닫기</ThemedText>
              </Pressable>
            </View>
            <ProjectForm
              submitLabel="등록"
              isbusy={iscreating}
              error={formerror}
              onSubmit={handleCreateProject}
              onCancel={() => setIsCreateOpen(false)}
            />
          </ThemedView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: BottomTabInset + Spacing.four,
  },
  safeArea: {
    width: '100%',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five,
  },
  header: {
    gap: Spacing.two,
  },
  headerTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerTitle: {
    flex: 1,
    minWidth: 240,
    maxWidth: 520,
    gap: Spacing.two,
  },
  headerCopy: {
    fontSize: 16,
    lineHeight: 24,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'flex-end',
    marginLeft: 'auto',
    gap: Spacing.two,
  },
  notificationButton: {
    minHeight: 44,
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#93c5fd',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  notificationButtonText: {
    color: '#2563eb',
  },
  notificationBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: Spacing.one,
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 16,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  statCard: {
    width: '48%',
    minHeight: 96,
    gap: Spacing.one,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
  },
  greenStat: {
    borderColor: '#bbf7d0',
  },
  orangeStat: {
    borderColor: '#fed7aa',
  },
  statValue: {
    color: '#2563eb',
  },
  section: {
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  sectionHeaderMeta: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  sectionToggleText: {
    color: '#2563eb',
  },
  favoriteList: {
    gap: Spacing.two,
  },
  favoriteCard: {
    gap: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
  },
  favoriteProjectTitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  categoryPill: {
    minHeight: 30,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  categoryText: {
    color: '#475569',
  },
  projectList: {
    gap: Spacing.three,
  },
  cardPressable: {
    borderRadius: Spacing.three,
  },
  projectCard: {
    gap: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
  },
  projectCardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  projectTitleBlock: {
    flex: 1,
    minWidth: 180,
    gap: Spacing.one,
  },
  projectTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  projectDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  progressTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#10b981',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  dDayPill: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  dDayText: {
    color: '#1d4ed8',
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: Spacing.two,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  closeButton: {
    minHeight: 36,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: Spacing.three,
  },
  modalPanel: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  modalTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.four,
  },
  emptyText: {
    textAlign: 'center',
  },
  errorText: {
    color: '#dc2626',
  },
  pressed: {
    opacity: 0.72,
  },
});
