import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { BrandIcon } from '@/components/brand-icon';
import { EmptyState } from '@/components/empty-state';
import { ProjectCard } from '@/components/project-card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useNotifications } from '@/hooks/use-notifications';
import { useProjectIdeaStats } from '@/hooks/use-project-idea-stats';
import { useProjects } from '@/hooks/use-projects';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();
  const { projects } = useProjects();
  const { unreadCount } = useNotifications(projects);
  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const stats = (useProjectIdeaStats as any)(projectIds);

  const featuredProject = projects[0] ?? null;
  const otherProjects = projects.slice(1);

  // stats가 Map인지 일반 객체인지 안전하게 처리
  const getStats = (id: string) => {
    if (!stats) return { total: 0, selected: 0 };
    if (stats instanceof Map) {
      return stats.get(id) ?? { total: 0, selected: 0 };
    }
    return (stats as Record<string, any>)[id] ?? { total: 0, selected: 0 };
  };

  const { totalIdeas, totalSelected } = useMemo(() => {
    let ideas = 0;
    let selected = 0;
    if (stats instanceof Map) {
      stats.forEach((v: any) => {
        ideas += v?.total ?? 0;
        selected += v?.selected ?? 0;
      });
    } else if (stats && typeof stats === 'object') {
      Object.values(stats).forEach((v: any) => {
        ideas += v?.total ?? 0;
        selected += v?.selected ?? 0;
      });
    }
    return { totalIdeas: ideas, totalSelected: selected };
  }, [stats]);

  return (
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
              onPress={() => router.push('/projects/new' as Href)}
              style={({ pressed }) => [
                styles.createButton,
                { backgroundColor: theme.primary },
                pressed && styles.pressed,
              ]}>
              <AppIcon name="add" color="#FFFFFF" size={18} />
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
            <ThemedText style={styles.statsBadgeValue}>아이디어 {totalIdeas}</ThemedText>
            <ThemedText style={styles.statsBadgeValue}>최종 선정 {totalSelected}</ThemedText>
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
        {projects.length === 0 ? (
          <EmptyState
            icon="projects"
            title="아직 등록된 과제가 없어요"
            description="새로운 프로젝트나 과제를 만들고 아이디어를 모아보세요."
            actionLabel="첫 과제 만들기"
            onAction={() => router.push('/projects/new' as Href)}
          />
        ) : (
          <View style={styles.projectList}>
            {featuredProject ? (
              <ProjectCard
                key={featuredProject.id}
                project={featuredProject}
                stats={getStats(featuredProject.id)}
                featured
              />
            ) : null}

            {otherProjects.length > 0 ? (
              <View style={styles.otherGrid}>
                {otherProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    stats={getStats(project.id)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
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
    color: '#FFFFFF',
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
