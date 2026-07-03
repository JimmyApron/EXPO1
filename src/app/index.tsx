import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProjectForm } from '@/components/project-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useFavoriteIdeas } from '@/hooks/use-favorite-ideas';
import { useProjects } from '@/hooks/use-projects';
import { useTheme } from '@/hooks/use-theme';
import { IdeaCategoryLabels, type IdeaCategory } from '@/types/idea';
import type { Project, ProjectInput } from '@/types/project';

type FavoriteProjectSummary = {
  projectid: string;
  projectTitle: string;
  categories: IdeaCategory[];
};

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

function FavoriteProjectCard({ item }: { item: FavoriteProjectSummary }) {
  return (
    <Pressable
      onPress={() => router.push(`/projects/${item.projectid}` as Href)}
      style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={styles.favoriteCard}>
        <ThemedText type="smallBold" style={styles.favoriteProjectTitle}>
          {item.projectTitle}
        </ThemedText>
        <ThemedView style={styles.categoryRow}>
          {item.categories.map((category) => (
            <ThemedView key={category} style={styles.categoryPill}>
              <ThemedText type="smallBold" style={styles.categoryText}>
                {IdeaCategoryLabels[category]}
              </ThemedText>
            </ThemedView>
          ))}
        </ThemedView>
      </ThemedView>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { user, signout } = useAuth();
  const { projects, isloadingprojects, projecterror, createProject } = useProjects();
  const { favoriteIdeas, isLoadingFavoriteIdeas, favoriteIdeaError } = useFavoriteIdeas();
  const [iscreating, setIscreating] = useState(false);
  const [formerror, setFormerror] = useState('');
  const theme = useTheme();

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
                <ThemedText type="subtitle">과제 보드</ThemedText>
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
            <ThemedView style={styles.sectionHeader}>
              <ThemedText type="smallBold">즐겨찾기 아이디어</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {favoriteProjects.length}개 과제
              </ThemedText>
            </ThemedView>

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
                <ThemedText type="smallBold">즐겨찾기한 아이디어가 없습니다</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  과제 상세에서 아이디어 카드의 별표를 눌러 모아보세요.
                </ThemedText>
              </ThemedView>
            ) : (
              <ThemedView style={styles.favoriteList}>
                {favoriteProjects.map((item) => (
                  <FavoriteProjectCard key={item.projectid} item={item} />
                ))}
              </ThemedView>
            )}
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
    fontSize: 16,
    lineHeight: 24,
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
  favoriteList: {
    gap: Spacing.two,
  },
  favoriteCard: {
    gap: Spacing.two,
    borderRadius: Spacing.three,
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
    borderColor: '#9aa2b1',
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  categoryText: {
    color: '#3f4652',
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
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
  emptyText: {
    textAlign: 'center',
  },
  errorText: {
    color: '#d92d20',
  },
  pressed: {
    opacity: 0.72,
  },
});
