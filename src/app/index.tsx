import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProjectForm } from '@/components/project-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/hooks/use-auth';
import { useProjects } from '@/hooks/use-projects';
import { useTheme } from '@/hooks/use-theme';
import type { Project, ProjectInput } from '@/types/project';

const categories = ['all', 'design', 'develop'] as const;
const sampleideas = [101, 102, 103];

function ProjectCard({ project }: { project: Project }) {
  return (
    <Pressable
      onPress={() => router.push(`/projects/${project.id}` as Href)}
      style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={styles.projectCard}>
        <ThemedText type="smallBold" style={styles.projectTitle}>
          {project.title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.projectDescription}>
          {project.description || '설명이 아직 없습니다.'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          마감일: {project.deadline || '미정'}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { user, signout } = useAuth();
  const { projects, isloadingprojects, projecterror, createProject } = useProjects();
  const { categoryfilter, setCategoryfilter, favoriteids, togglefavorite } = useApp();
  const [iscreating, setIscreating] = useState(false);
  const [formerror, setFormerror] = useState('');
  const theme = useTheme();

  const handleCreateProject = async (input: ProjectInput) => {
    setIscreating(true);
    setFormerror('');

    const result = await createProject(input);

    if (result.error) {
      setFormerror(result.error);
    }

    setIscreating(false);
  };

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <ThemedView style={styles.header}>
            <ThemedView style={styles.headerTop}>
              <ThemedView style={styles.headerTitle}>
                <ThemedText type="subtitle">과제 보관함</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.headerCopy}>
                  과제별 아이디어를 프로젝트 단위로 정리하세요.
                </ThemedText>
              </ThemedView>
              <Pressable
                onPress={signout}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold">로그아웃</ThemedText>
              </Pressable>
            </ThemedView>
            <ThemedText type="small" themeColor="textSecondary">
              로그인 계정: {user?.email ?? user?.id}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">새 과제 만들기</ThemedText>
            <ProjectForm
              submitLabel="저장"
              isbusy={iscreating}
              error={formerror}
              onSubmit={handleCreateProject}
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionHeader}>
              <ThemedText type="smallBold">과제 목록</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {projects.length}개
              </ThemedText>
            </ThemedView>

            {projecterror ? (
              <ThemedText type="small" style={styles.errorText}>
                {projecterror}
              </ThemedText>
            ) : null}

            {isloadingprojects ? (
              <ThemedView type="backgroundElement" style={styles.emptyState}>
                <ActivityIndicator />
              </ThemedView>
            ) : projects.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyState}>
                <ThemedText type="smallBold">아직 생성된 과제가 없습니다</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  발표, 리포트, 실습 과제를 만들고 아이디어를 정리하세요.
                </ThemedText>
              </ThemedView>
            ) : (
              <ThemedView style={styles.projectList}>
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </ThemedView>
            )}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionHeader}>
              <ThemedText type="smallBold">카테고리 필터</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {categoryfilter.toUpperCase()}
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.tabContainer}>
              {categories.map((category) => (
                <Pressable
                  key={category}
                  onPress={() => setCategoryfilter(category)}
                  style={({ pressed }) => [
                    styles.tabButton,
                    categoryfilter === category && styles.activeTabButton,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText
                    style={categoryfilter === category ? styles.activeTabText : styles.tabText}>
                    {category.toUpperCase()}
                  </ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionHeader}>
              <ThemedText type="smallBold">아이디어 즐겨찾기</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {favoriteids.length}개 저장됨
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={styles.favoriteList}>
              {sampleideas.map((ideaid) => {
                const isfavorite = favoriteids.includes(ideaid);

                return (
                  <ThemedView key={ideaid} style={styles.favoriteRow}>
                    <ThemedText type="small">Idea ID: {ideaid}</ThemedText>
                    <Pressable
                      onPress={() => togglefavorite(ideaid)}
                      style={({ pressed }) => [
                        styles.favoriteButton,
                        isfavorite && styles.activeFavoriteButton,
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText
                        type="smallBold"
                        style={isfavorite ? styles.activeFavoriteText : styles.favoriteText}>
                        {isfavorite ? 'FAVORITE' : 'ADD'}
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                );
              })}
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </SafeAreaView>
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
    paddingTop: Spacing.six,
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
    gap: Spacing.two,
  },
  headerCopy: {
    maxWidth: 620,
  },
  section: {
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  projectList: {
    gap: Spacing.three,
  },
  cardPressable: {
    borderRadius: Spacing.three,
  },
  projectCard: {
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  projectTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  projectDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
  emptyText: {
    textAlign: 'center',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#9aa2b1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  errorText: {
    color: '#d92d20',
  },
  pressed: {
    opacity: 0.72,
  },
  tabContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tabButton: {
    minHeight: 36,
    borderRadius: Spacing.two,
    backgroundColor: '#f1f2f6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  activeTabButton: {
    backgroundColor: '#2f3542',
  },
  tabText: {
    color: '#2f3542',
    fontSize: 12,
  },
  activeTabText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 700,
  },
  favoriteList: {
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  favoriteRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  favoriteButton: {
    minWidth: 92,
    borderRadius: Spacing.two,
    backgroundColor: '#e6e8ee',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  activeFavoriteButton: {
    backgroundColor: '#ff4757',
  },
  favoriteText: {
    color: '#2f3542',
  },
  activeFavoriteText: {
    color: '#ffffff',
  },
});
