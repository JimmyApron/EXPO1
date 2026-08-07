import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, type AppIconName } from '@/components/app-icon';
import { BrandIcon } from '@/components/brand-icon';
import { EmptyState } from '@/components/empty-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { ProjectCard } from '@/components/project-card';
import { ProjectCreateModal } from '@/components/project-create-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useNotifications } from '@/hooks/use-notifications';
import { useProjectIdeaStats } from '@/hooks/use-project-idea-stats';
import { useProjects } from '@/hooks/use-projects';
import { useRooms } from '@/hooks/use-rooms';
import { useTheme } from '@/hooks/use-theme';
import type { AppNotification } from '@/types/notification';
import type { Project, ProjectInput } from '@/types/project';

function deadlineTime(project: Project) {
  if (!project.deadline) return Number.POSITIVE_INFINITY;
  const time = new Date(`${project.deadline}T00:00:00`).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function getPrimaryProject(projects: Project[]) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const upcoming = projects
    .filter((project) => deadlineTime(project) >= now.getTime())
    .sort((left, right) => deadlineTime(left) - deadlineTime(right));
  if (upcoming[0]) return upcoming[0];
  return [...projects].sort((left, right) => right.updatedat.localeCompare(left.updatedat))[0];
}

function ActionItem({ notification }: { notification: AppNotification }) {
  const theme = useTheme();
  const icon: AppIconName = notification.kind === 'feedback'
    ? 'feedback'
    : notification.kind === 'stalledidea'
      ? 'idea'
      : 'schedule';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/projects/${notification.projectid}` as Href)}
      style={({ pressed }) => [styles.actionItem, pressed && styles.pressed]}>
      <View style={[styles.actionIcon, { backgroundColor: theme.primarySoft }]}>
        <AppIcon name={icon} color={theme.primary} size={20} />
      </View>
      <View style={styles.actionCopy}>
        <ThemedText type="cardTitle" numberOfLines={1}>{notification.title}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>{notification.message}</ThemedText>
      </View>
      <AppIcon name="chevronRight" color={theme.textTertiary} size={20} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { projects, isloadingprojects, projecterror, createProject } = useProjects();
  const { rooms, isloadingrooms, roomerror } = useRooms();
  const { notifications, unreadCount, notificationError } = useNotifications(projects);
  const { totals, isLoadingStats, statsError, getStatsForProject } = useProjectIdeaStats();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const primaryProject = useMemo(() => getPrimaryProject(projects), [projects]);
  const urgentProjects = useMemo(
    () => [...projects].filter((project) => project.deadline).sort((a, b) => deadlineTime(a) - deadlineTime(b)).slice(0, 3),
    [projects],
  );
  const actionNotifications = useMemo(
    () => notifications.filter((item) => !item.isread && ['deadline', 'feedback', 'stalledidea', 'ideareview'].includes(item.kind)).slice(0, 3),
    [notifications],
  );
  const recentProjects = useMemo(
    () => [...projects].sort((a, b) => b.updatedat.localeCompare(a.updatedat)).slice(0, 3),
    [projects],
  );
  const isLoading = isloadingprojects || isLoadingStats;
  const currentError = projecterror || statsError || notificationError;

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
  };

  return (
    <>
      <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scrollContent}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <ThemedView style={styles.container}>
            <View style={styles.header}>
              <Pressable accessibilityRole="link" accessibilityLabel="Watt 홈" onPress={() => router.replace('/')} style={styles.brandRow}>
                <BrandIcon size={42} />
                <ThemedText type="sectionTitle">Watt</ThemedText>
              </Pressable>
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="새 과제 만들기"
                  onPress={openCreate}
                  style={({ pressed }) => [styles.createButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
                  <AppIcon name="add" color="#FFFFFF" size={19} />
                  {width >= 390 ? <ThemedText type="button" style={styles.whiteText}>새 과제</ThemedText> : null}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={unreadCount ? `알림, 읽지 않음 ${unreadCount}개` : '알림'}
                  onPress={() => router.push('/notifications' as Href)}
                  style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.surface }, pressed && styles.pressed]}>
                  <AppIcon name="notifications" color={theme.text} size={23} />
                  {unreadCount > 0 ? (
                    <View style={[styles.notificationBadge, { backgroundColor: theme.danger }]}>
                      <ThemedText style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</ThemedText>
                    </View>
                  ) : null}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="내 정보"
                  onPress={() => router.push('/profile' as Href)}
                  style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.surface }, pressed && styles.pressed]}>
                  <AppIcon name="profile" color={theme.text} size={24} />
                </Pressable>
              </View>
            </View>

            <View style={styles.heroIntro}>
              <View
                accessibilityLabel={`내 작업 요약, 과제 ${projects.length}개, 아이디어 ${totals.totalIdeas}개, 최종 선정 ${totals.selectedIdeas}개`}
                style={[styles.compactSummary, { backgroundColor: theme.surface }]}>
                <ThemedText type="captionStrong" themeColor="textSecondary">내 작업</ThemedText>
                <View style={styles.compactMetric}>
                  <ThemedText type="caption" themeColor="textTertiary">과제</ThemedText>
                  <ThemedText type="captionStrong">{isloadingprojects ? '—' : projects.length}</ThemedText>
                </View>
                <View style={styles.compactMetric}>
                  <ThemedText type="caption" themeColor="textTertiary">아이디어</ThemedText>
                  <ThemedText type="captionStrong">{isLoadingStats ? '—' : totals.totalIdeas}</ThemedText>
                </View>
                <View style={styles.compactMetric}>
                  <ThemedText type="caption" themeColor="textTertiary">최종 선정</ThemedText>
                  <ThemedText type="captionStrong">{isLoadingStats ? '—' : totals.selectedIdeas}</ThemedText>
                </View>
              </View>

              <View style={styles.intro}>
                <ThemedText type="screenTitle">오늘 무엇을 이어갈까요?</ThemedText>
                <ThemedText type="body" themeColor="textSecondary">마감과 피드백을 확인하고 가장 중요한 과제부터 진행하세요.</ThemedText>
              </View>
            </View>

            {currentError ? (
              <ThemedView type="dangerSoft" style={styles.errorBanner}>
                <ThemedText type="captionStrong" style={{ color: theme.danger }}>일부 정보를 불러오지 못했습니다.</ThemedText>
                <ThemedText type="caption" style={{ color: theme.danger }}>{currentError} 잠시 후 다시 시도해 주세요.</ThemedText>
              </ThemedView>
            ) : null}

            {isLoading ? <LoadingSkeleton rows={1} /> : primaryProject ? (
              <ProjectCard project={primaryProject} stats={getStatsForProject(primaryProject.id)} featured />
            ) : (
              <EmptyState icon="projects" title="첫 과제를 시작해 보세요" description="과제를 만들면 아이디어와 진행 상황을 한곳에서 관리할 수 있어요." actionLabel="새 과제 만들기" onAction={openCreate} />
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionCopy}>
                  <ThemedText type="sectionTitle">지금 확인할 일</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">놓치기 쉬운 마감과 피드백이에요.</ThemedText>
                </View>
                {notifications.length > 0 ? (
                  <Pressable onPress={() => router.push('/notifications' as Href)} style={styles.textButton}>
                    <ThemedText type="button" style={{ color: theme.primary }}>전체 보기</ThemedText>
                  </Pressable>
                ) : null}
              </View>
              {actionNotifications.length > 0 ? (
                <View>{actionNotifications.map((item) => <ActionItem key={item.id} notification={item} />)}</View>
              ) : (
                <ThemedText type="body" themeColor="textSecondary" style={styles.quietState}>지금 바로 확인할 알림이 없어요.</ThemedText>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionCopy}>
                  <ThemedText type="sectionTitle">마감 임박</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">마감일이 가까운 순서로 보여드려요.</ThemedText>
                </View>
                <Pressable onPress={() => router.push('/projects' as Href)} style={styles.textButton}>
                  <ThemedText type="button" style={{ color: theme.primary }}>전체 보기</ThemedText>
                </Pressable>
              </View>
              {isLoading ? <LoadingSkeleton rows={2} /> : urgentProjects.length > 0 ? (
                <View style={styles.list}>{urgentProjects.map((project) => <ProjectCard key={project.id} project={project} stats={getStatsForProject(project.id)} />)}</View>
              ) : (
                <ThemedText type="body" themeColor="textSecondary" style={styles.quietState}>마감일이 설정된 과제가 없어요.</ThemedText>
              )}
            </View>

            <View style={styles.twoColumnArea}>
              <View style={styles.columnSection}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="sectionTitle">최근 과제</ThemedText>
                  <Pressable onPress={() => router.push('/projects' as Href)} style={styles.textButton}><ThemedText type="button" style={{ color: theme.primary }}>전체 보기</ThemedText></Pressable>
                </View>
                {recentProjects.length > 0 ? <View style={styles.list}>{recentProjects.map((project) => <ProjectCard key={project.id} project={project} stats={getStatsForProject(project.id)} />)}</View> : null}
              </View>

              <View style={styles.columnSection}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionCopy}><ThemedText type="sectionTitle">참여 중인 방</ThemedText><ThemedText type="caption" themeColor="textSecondary">최근 함께 작업한 공간이에요.</ThemedText></View>
                  <Pressable onPress={() => router.push('/rooms' as Href)} style={styles.textButton}><ThemedText type="button" style={{ color: theme.primary }}>방 관리</ThemedText></Pressable>
                </View>
                {isloadingrooms ? <LoadingSkeleton rows={1} /> : rooms.length > 0 ? (
                  <View style={styles.roomList}>{rooms.slice(0, 2).map((item) => (
                    <Pressable key={item.room.id} onPress={() => router.push('/rooms' as Href)} style={({ pressed }) => [styles.roomRow, pressed && styles.pressed]}>
                      <View style={[styles.roomIcon, { backgroundColor: theme.primarySoft }]}><AppIcon name="rooms" color={theme.primary} size={21} /></View>
                      <View style={styles.actionCopy}><ThemedText type="cardTitle" numberOfLines={1}>{item.room.name}</ThemedText><ThemedText type="caption" themeColor="textSecondary">멤버 {item.members.length}명</ThemedText></View>
                      <AppIcon name="chevronRight" color={theme.textTertiary} size={20} />
                    </Pressable>
                  ))}</View>
                ) : (
                  <Pressable onPress={() => router.push('/rooms' as Href)} style={styles.quietState}>
                    <ThemedText type="body" themeColor="textSecondary">참여 중인 방이 없어요. 방을 만들거나 초대 코드로 참가해 보세요.</ThemedText>
                  </Pressable>
                )}
                {roomerror ? <ThemedText type="caption" style={{ color: theme.danger }}>{roomerror}</ThemedText> : null}
              </View>
            </View>
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
  container: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three, gap: Spacing.five },
  header: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  brandRow: { minHeight: ControlHeight.touch, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  createButton: { minHeight: ControlHeight.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: Radius.medium, paddingHorizontal: 14 },
  iconButton: { width: ControlHeight.touch, height: ControlHeight.touch, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notificationBadge: { position: 'absolute', right: -3, top: -3, minWidth: 18, height: 18, borderRadius: Radius.pill, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 9, lineHeight: 12, fontWeight: '800' },
  whiteText: { color: '#FFFFFF' },
  heroIntro: { gap: Spacing.three },
  compactSummary: { alignSelf: 'flex-start', minHeight: 36, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.three, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  compactMetric: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  intro: { gap: Spacing.one },
  errorBanner: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  section: { gap: Spacing.three },
  sectionHeader: { minHeight: ControlHeight.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  sectionCopy: { flex: 1, gap: 2 },
  textButton: { minHeight: ControlHeight.touch, justifyContent: 'center', paddingHorizontal: Spacing.one },
  actionItem: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.24)' },
  actionIcon: { width: 42, height: 42, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, gap: 2, minWidth: 0 },
  quietState: { minHeight: 70, justifyContent: 'center', paddingVertical: Spacing.three },
  list: { gap: Spacing.two },
  twoColumnArea: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.five },
  columnSection: { flex: 1, minWidth: 300, gap: Spacing.three },
  roomList: { gap: Spacing.one },
  roomRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  roomIcon: { width: 42, height: 42, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
