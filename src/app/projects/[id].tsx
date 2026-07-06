import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IdeaBoard } from '@/components/idea-board';
import { ProjectForm } from '@/components/project-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useProjects } from '@/hooks/use-projects';
import { useTheme } from '@/hooks/use-theme';
import { formatDeadlineLabel, getDDayLabel } from '@/lib/deadline';
import type { ProjectInput } from '@/types/project';

function confirmDelete(onConfirm: () => void) {
  const message = '과제를 삭제할까요? 삭제한 과제와 아이디어는 되돌릴 수 없습니다.';

  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(message)) {
      onConfirm();
    }
    return;
  }

  Alert.alert('과제 삭제', message, [
    { text: '취소', style: 'cancel' },
    { text: '삭제', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Array.isArray(id) ? id[0] : id;
  const { projects, isloadingprojects, projecterror, updateProject, deleteProject } = useProjects();
  const [isEditing, setIsEditing] = useState(false);
  const [isbusy, setIsbusy] = useState(false);
  const [mutationerror, setMutationerror] = useState('');
  const theme = useTheme();

  const project = projectId ? projects.find((item) => item.id === projectId) : undefined;

  const goToList = () => {
    router.replace('/');
  };

  const handleSave = async (input: ProjectInput) => {
    if (!projectId) {
      return;
    }

    setIsbusy(true);
    setMutationerror('');

    const result = await updateProject(projectId, input);

    if (result.error) {
      setMutationerror(result.error);
    } else {
      setIsEditing(false);
    }

    setIsbusy(false);
  };

  const handleDelete = () => {
    if (!projectId) {
      return;
    }

    confirmDelete(async () => {
      setIsbusy(true);
      setMutationerror('');

      const result = await deleteProject(projectId);

      if (result.error) {
        setMutationerror(result.error);
        setIsbusy(false);
        return;
      }

      goToList();
    });
  };

  if (isloadingprojects) {
    return (
      <ThemedView style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!project) {
    return (
      <ThemedView style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ThemedText type="smallBold">과제를 찾을 수 없습니다.</ThemedText>
        {projecterror ? (
          <ThemedText type="small" style={styles.errorText}>
            {projecterror}
          </ThemedText>
        ) : null}
        <Pressable
          onPress={goToList}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            목록으로 돌아가기
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <Pressable
            onPress={goToList}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor="textSecondary">
              ← 과제 목록
            </ThemedText>
          </Pressable>

          {isEditing ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">과제 수정</ThemedText>
              <ProjectForm
                project={project}
                submitLabel="저장"
                isbusy={isbusy}
                error={mutationerror}
                onSubmit={handleSave}
                onCancel={() => setIsEditing(false)}
              />
            </ThemedView>
          ) : (
            <ThemedView style={styles.section}>
              <ThemedView type="backgroundElement" style={styles.heroPanel}>
                <View style={styles.detailHeader}>
                  <View style={styles.titleBlock}>
                    <ThemedText type="subtitle">{project.title}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.description}>
                      {project.description || '과제 조건이나 방향을 아직 적지 않았습니다.'}
                    </ThemedText>
                  </View>
                  <View style={styles.actions}>
                    <Pressable
                      disabled={isbusy}
                      onPress={() => setIsEditing(true)}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        (pressed || isbusy) && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold">수정</ThemedText>
                    </Pressable>
                    <Pressable
                      disabled={isbusy}
                      onPress={handleDelete}
                      style={({ pressed }) => [
                        styles.dangerButton,
                        (pressed || isbusy) && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold" style={styles.dangerButtonText}>
                        삭제
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>

                {mutationerror ? (
                  <ThemedText type="small" style={styles.errorText}>
                    {mutationerror}
                  </ThemedText>
                ) : null}

                <View style={styles.summaryGrid}>
                  <View style={styles.summaryBox}>
                    <ThemedText type="smallBold">D-day</ThemedText>
                    <ThemedText type="subtitle" style={styles.dDayText}>
                      {getDDayLabel(project.deadline)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatDeadlineLabel(project.deadline)}
                    </ThemedText>
                  </View>

                  <View style={styles.summaryBox}>
                    <ThemedText type="smallBold">사용 흐름</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      아이디어 등록 → 칸반 정리 → 최종안 구성
                    </ThemedText>
                  </View>
                </View>
              </ThemedView>
            </ThemedView>
          )}

          <IdeaBoard projectId={project.id} projectDeadline={project.deadline} />
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
    paddingTop: Spacing.five,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  section: {
    gap: Spacing.three,
  },
  heroPanel: {
    gap: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
  },
  detailHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  titleBlock: {
    flex: 1,
    minWidth: 240,
    gap: Spacing.two,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'flex-start',
    gap: Spacing.two,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  summaryBox: {
    flex: 1,
    minWidth: 220,
    gap: Spacing.one,
    borderRadius: Spacing.two,
    backgroundColor: '#f8fafc',
    padding: Spacing.three,
  },
  dDayText: {
    color: '#2563eb',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
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
  dangerButton: {
    minHeight: 44,
    borderRadius: Spacing.two,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  dangerButtonText: {
    color: '#ffffff',
  },
  errorText: {
    color: '#dc2626',
  },
  pressed: {
    opacity: 0.72,
  },
});
