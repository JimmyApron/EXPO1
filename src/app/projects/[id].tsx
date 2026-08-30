import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { IdeaBoard } from '@/components/idea-board';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { ProjectForm } from '@/components/project-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useProject } from '@/hooks/use-project';
import { useTheme } from '@/hooks/use-theme';
import { formatDeadlineLabel, getDDayLabel } from '@/lib/deadline';
import { resolveProjectWorkspaceLocation, type ProjectWorkspaceLocation } from '@/lib/project-workspace';
import type { ProjectInput } from '@/types/project';

function confirmDelete(onConfirm: () => void) {
  const message = '이 과제와 연결된 아이디어는 복구할 수 없습니다. 정말 삭제할까요?';
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(message)) onConfirm();
    return;
  }
  Alert.alert('과제 삭제', message, [
    { text: '취소', style: 'cancel' },
    { text: '삭제', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function ProjectDetailScreen() {
  const { id, ideaTab, projectView, flowStep } = useLocalSearchParams<{
    id: string;
    ideaTab?: string;
    projectView?: string;
    flowStep?: string;
  }>();
  const projectId = Array.isArray(id) ? id[0] : id;
  const initialLocation = resolveProjectWorkspaceLocation({ ideaTab, projectView, flowStep });
  const { project, isloadingproject, projecterror, updateProject, deleteProject } = useProject(projectId);
  const [isEditing, setIsEditing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const theme = useTheme();

  const goToList = () => router.replace('/projects' as Href);
  const handleLocationChange = useCallback((location: ProjectWorkspaceLocation) => {
    router.setParams({ projectView: location.section, flowStep: location.step });
  }, []);

  const handleSave = async (input: ProjectInput) => {
    if (!projectId) return;
    setIsBusy(true);
    setMutationError('');
    const result = await updateProject(input);
    if (result.error) setMutationError(result.error);
    else setIsEditing(false);
    setIsBusy(false);
  };

  const handleDelete = () => {
    if (!projectId) return;
    confirmDelete(async () => {
      setIsBusy(true);
      setMutationError('');
      const result = await deleteProject();
      if (result.error) {
        setMutationError(result.error);
        setIsBusy(false);
        return;
      }
      goToList();
    });
  };

  if (isloadingproject) {
    return <ThemedView style={[styles.loading, { backgroundColor: theme.background }]}><LoadingSkeleton rows={3} /></ThemedView>;
  }

  if (!project) {
    return (
      <ThemedView style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText type="sectionTitle">과제를 찾을 수 없어요.</ThemedText>
        <ThemedText type="body" themeColor="textSecondary" style={styles.centerText}>{projecterror || '삭제되었거나 접근 권한이 없는 과제일 수 있어요.'}</ThemedText>
        <Pressable onPress={goToList} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
          <ThemedText type="button" style={styles.whiteText}>과제 목록으로</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scrollContent}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <Pressable accessibilityRole="button" accessibilityLabel="과제 목록으로 돌아가기" onPress={goToList} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <View style={styles.backIcon}><AppIcon name="chevronRight" color={theme.textSecondary} size={18} /></View>
            <ThemedText type="button" themeColor="textSecondary">과제 목록</ThemedText>
          </Pressable>

          {isEditing ? (
            <ThemedView type="surface" style={[styles.editPanel, { borderColor: theme.border }]}>
              <ThemedText type="sectionTitle">과제 수정</ThemedText>
              <ProjectForm project={project} submitLabel="저장" isbusy={isBusy} error={mutationError} onSubmit={handleSave} onCancel={() => setIsEditing(false)} />
            </ThemedView>
          ) : (
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.titleBlock}>
                  <View style={styles.deadlineRow}>
                    <View style={[styles.dayChip, { backgroundColor: theme.warningSoft }]}><ThemedText type="captionStrong" style={{ color: theme.warning }}>{getDDayLabel(project.deadline)}</ThemedText></View>
                    <ThemedText type="caption" themeColor="textSecondary">{formatDeadlineLabel(project.deadline)}</ThemedText>
                  </View>
                  <ThemedText type="screenTitle">{project.title}</ThemedText>
                  <ThemedText type="body" themeColor="textSecondary">{project.description || '과제 설명이 아직 없어요. 목표나 조건을 추가해 보세요.'}</ThemedText>
                </View>
                <View style={styles.actions}>
                  <Pressable disabled={isBusy} onPress={() => setIsEditing(true)} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.border }, (pressed || isBusy) && styles.pressed]}>
                    <ThemedText type="button">수정</ThemedText>
                  </Pressable>
                  <Pressable disabled={isBusy} onPress={handleDelete} style={({ pressed }) => [styles.deleteButton, (pressed || isBusy) && styles.pressed]}>
                    <ThemedText type="button" style={{ color: theme.danger }}>삭제</ThemedText>
                  </Pressable>
                </View>
              </View>
              {mutationError ? <ThemedText type="caption" style={{ color: theme.danger }}>{mutationError} 다시 시도해 주세요.</ThemedText> : null}
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <IdeaBoard
            projectId={project.id}
            projectOwnerId={project.userid}
            projectTitle={project.title}
            projectDeadline={project.deadline}
            initialSection={initialLocation.section}
            initialStep={initialLocation.step}
            onLocationChange={handleLocationChange}
          />
        </ThemedView>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { alignItems: 'center', paddingBottom: Spacing.five },
  safeArea: { width: '100%', alignItems: 'center' },
  container: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: Spacing.four },
  loading: { flex: 1, padding: Spacing.four },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  centerText: { textAlign: 'center', maxWidth: 420 },
  backButton: { minHeight: ControlHeight.touch, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  backIcon: { transform: [{ scaleX: -1 }] },
  hero: { gap: Spacing.three },
  heroTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.three },
  titleBlock: { flex: 1, minWidth: 260, gap: Spacing.two },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dayChip: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  actions: { flexDirection: 'row', alignSelf: 'flex-start', gap: Spacing.two },
  secondaryButton: { minHeight: ControlHeight.touch, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  deleteButton: { minHeight: ControlHeight.touch, justifyContent: 'center', paddingHorizontal: Spacing.two },
  editPanel: { borderWidth: 1, borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.three },
  divider: { height: 1 },
  primaryButton: { minHeight: ControlHeight.button, justifyContent: 'center', borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  whiteText: { color: '#FFFFFF' },
  pressed: { opacity: 0.7 },
});
