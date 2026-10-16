import { RoomBreadcrumb } from '@/components/room/RoomBreadcrumb';
import { ReminderActions } from '@/components/reminder/ReminderActions';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { IdeaBoard } from '@/components/idea-board';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { ProjectForm } from '@/components/project-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useIdeas } from '@/hooks/use-ideas';
import { useProject } from '@/hooks/use-project';
import { useProjectFlow } from '@/hooks/use-project-flow';
import { useProjectStageProgress } from '@/hooks/use-project-stage-progress';
import { useRooms } from '@/hooks/use-rooms';
import { useTeamEvaluationProgress } from '@/hooks/use-team-evaluation-progress';
import { useTheme } from '@/hooks/use-theme';
import { formatDeadlineLabel, getDDayLabel } from '@/lib/deadline';
import { resolveProjectWorkspaceLocation, type ProjectWorkspaceLocation } from '@/lib/project-workspace';
import { getProjectStageSummary } from '@/lib/project-progress';
import { normalizeProjectTemplate } from '@/lib/project-stages';
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
  const { conditions, flow, isloadingflow, flowerror } = useProjectFlow(projectId);
  const { progressByProjectId, stageProgressStatus, stageProgressError, saveStage } = useProjectStageProgress(projectId ? [projectId] : []);
  const { ideas, isLoadingIdeas, ideaError } = useIdeas(projectId);
  const { rooms } = useRooms();
  const projectRoom = rooms.find((item) => item.room.id === project?.roomid);
  const evaluationIdeaIds = useMemo(
    () => ideas.filter((idea) => !idea.legacystructural && Boolean(idea.title.trim() || idea.content.trim())).map((idea) => idea.id),
    [ideas],
  );
  const evaluationProgress = useTeamEvaluationProgress(
    projectId,
    projectRoom?.members,
    evaluationIdeaIds,
    flow?.evaluationround ?? 1,
    conditions.teamSize,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const boardOffset = useRef(0);
  const theme = useTheme();
  const hasCompletedEvaluations = evaluationProgress.completedCount >= evaluationProgress.totalCount;
  const workflowIdeaCount = ideas.filter((idea) => !idea.legacystructural && Boolean(idea.title.trim() || idea.content.trim())).length;
  const selectedIdeaCount = ideas.filter((idea) => idea.status === 'selected').length;
  const stageRecords = (progressByProjectId.get(projectId ?? '') ?? []).filter((record) => record.template === project?.template);
  const stageSummary = getProjectStageSummary(project ?? { template: 'service_app', haspresentation: true }, workflowIdeaCount, selectedIdeaCount, flow, stageRecords);
  const isServiceTemplate = normalizeProjectTemplate(project?.template) === 'service_app';
  const isWorkflowLoading = (isServiceTemplate && (isloadingflow || isLoadingIdeas)) || (!isServiceTemplate && stageProgressStatus === 'loading');
  const isWorkflowUnavailable = Boolean((isServiceTemplate && (flowerror || ideaError)) || (!isServiceTemplate && stageProgressError));
  const nextStep = stageSummary.currentStage.id;
  const nextActionLabel = stageSummary.completedStageCount === stageSummary.totalStageCount
    ? '완성된 결과물 보기'
    : !isServiceTemplate ? `${stageSummary.currentStage.label} 이어서 하기`
    : nextStep === 'extraction'
      ? '아이디어 시작하기'
      : nextStep === 'selection'
        ? '아이디어 평가 이어서 하기'
        : nextStep === 'mvp'
          ? 'MVP 기획 이어서 하기'
          : '발표자료 이어서 하기';

  const goToList = () => router.replace('/projects' as Href);
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      goToList();
    }
  };
  const handleLocationChange = useCallback((location: ProjectWorkspaceLocation) => {
    router.setParams({ projectView: location.section, flowStep: location.step });
  }, []);
  const handleContinue = () => {
    handleLocationChange({ section: 'home', step: nextStep });
    scrollRef.current?.scrollTo({ y: boardOffset.current, animated: true });
  };

  const handleSave = async (input: ProjectInput) => {
    if (!projectId) return false;
    setIsBusy(true);
    setMutationError('');
    const result = await updateProject(input);
    if (result.error) setMutationError(result.error);
    else setIsEditing(false);
    setIsBusy(false);
    return !result.error;
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
    <ScrollView ref={scrollRef} style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scrollContent}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" accessibilityLabel="이전 화면으로 돌아가기" onPress={goBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <View style={styles.backIcon}><AppIcon name="chevronRight" color={theme.textSecondary} size={18} /></View>
              <ThemedText type="button" themeColor="textSecondary">뒤로</ThemedText>
            </Pressable>
            {!isEditing && initialLocation.section === 'home' ? <View style={styles.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel="과제 수정" disabled={isBusy} onPress={() => setIsEditing(true)} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.border }, (pressed || isBusy) && styles.pressed]}>
                <ThemedText type="button">수정</ThemedText>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="과제 삭제" disabled={isBusy} onPress={handleDelete} style={({ pressed }) => [styles.deleteButton, (pressed || isBusy) && styles.pressed]}>
                <ThemedText type="button" style={{ color: theme.danger }}>삭제</ThemedText>
              </Pressable>
            </View> : null}
          </View>

          {project.roomid ? <RoomBreadcrumb roomName={projectRoom?.room.name} title={project.title} /> : null}
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
                  <View style={styles.nextAction}>
                    <View style={styles.nextActionCopy}>
                      <ThemedText type="caption" themeColor="textSecondary">현재 단계 · {isWorkflowLoading ? '확인 중' : isWorkflowUnavailable ? '확인할 수 없음' : stageSummary.completedStageCount === stageSummary.totalStageCount ? '모든 단계 완료' : `${stageSummary.currentStage.label} 중`}</ThemedText>
                      {!isWorkflowLoading && !isWorkflowUnavailable ? <ThemedText type="caption" themeColor="textSecondary">{stageSummary.completedStageCount}/{stageSummary.totalStageCount} 단계 완료</ThemedText> : null}
                      {!isWorkflowLoading && !isWorkflowUnavailable ? <ThemedText type="smallBold">다음 할 일</ThemedText> : null}
                    </View>
                    {!isWorkflowLoading && !isWorkflowUnavailable ? <Pressable accessibilityRole="button" accessibilityLabel={nextActionLabel} onPress={handleContinue} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
                      <ThemedText type="button" style={styles.whiteText}>{nextActionLabel}</ThemedText>
                    </Pressable> : null}
                  </View>
                  {evaluationProgress.error ? <ThemedText accessibilityLiveRegion="polite">{evaluationProgress.error}</ThemedText> : null}
                  <View style={styles.evaluationRow}>
                    <View
                      accessibilityLabel={`평가 진행률 ${evaluationProgress.completedCount}/${evaluationProgress.totalCount}명 완료`}
                      style={[
                        styles.evaluationBadge,
                        {
                          backgroundColor: hasCompletedEvaluations ? theme.successSoft : theme.primarySoft,
                          borderColor: hasCompletedEvaluations ? theme.success : theme.primary,
                        },
                      ]}>
                      <ThemedText
                        type="smallBold"
                        style={{ color: hasCompletedEvaluations ? theme.success : theme.primary }}>
                        {evaluationProgress.isLoading ? '평가 현황을 불러오는 중…' : evaluationProgress.error ? '평가 현황 확인 필요' : `평가 진행률 ${evaluationProgress.completedCount}/${evaluationProgress.totalCount}명 완료`}
                      </ThemedText>
                    </View>
                  </View>
                </View>
                {projectRoom && evaluationIdeaIds.length > 0 && !evaluationProgress.isLoading && !evaluationProgress.error ? <ReminderActions key={project.id} projectId={project.id} title={project.title} deadline={project.deadline} completedCount={evaluationProgress.completedCount} totalCount={projectRoom.members.length} /> : null}
              </View>
              {mutationError ? <ThemedText type="caption" style={{ color: theme.danger }}>{mutationError} 다시 시도해 주세요.</ThemedText> : null}
              {stageProgressError && !isServiceTemplate ? <ThemedText accessibilityRole="alert" type="caption" style={{ color: theme.danger }}>{stageProgressError}</ThemedText> : null}
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <View onLayout={(event) => { boardOffset.current = event.nativeEvent.layout.y; }}>
          <IdeaBoard
            projectId={project.id}
            projectOwnerId={project.userid}
            projectTitle={project.title}
            projectDeadline={project.deadline}
            projectTemplate={project.template}
            isTeamProject={Boolean(project.roomid)}
            hasPresentation={project.haspresentation}
            stageRecords={stageRecords}
            onSaveStage={(stageId, content, isCompleted) => saveStage(project.id, project.template, stageId, content, isCompleted)}
            initialSection={initialLocation.section}
            initialStep={initialLocation.step}
            onLocationChange={handleLocationChange}
          />
          </View>
        </ThemedView>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { alignItems: 'center', paddingBottom: Spacing.five },
  safeArea: { width: '100%', alignItems: 'center' },
  container: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: Spacing.four },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  loading: { flex: 1, padding: Spacing.four },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  centerText: { textAlign: 'center', maxWidth: 420 },
  backButton: { minHeight: ControlHeight.touch, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  backIcon: { transform: [{ scaleX: -1 }] },
  hero: { gap: Spacing.three },
  heroTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.three },
  nextAction: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, paddingVertical: Spacing.two },
  nextActionCopy: { gap: Spacing.one },
  titleBlock: { flex: 1, minWidth: 0, gap: Spacing.two },
  deadlineRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  dayChip: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  evaluationBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  evaluationRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  actions: { flexDirection: 'row', alignSelf: 'flex-start', gap: Spacing.two },
  secondaryButton: { minHeight: ControlHeight.touch, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  deleteButton: { minHeight: ControlHeight.touch, justifyContent: 'center', paddingHorizontal: Spacing.two },
  editPanel: { borderWidth: 1, borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.three },
  divider: { height: 1 },
  primaryButton: { minHeight: ControlHeight.button, justifyContent: 'center', borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  whiteText: { color: '#1E293B' },
  pressed: { opacity: 0.7 },
});
