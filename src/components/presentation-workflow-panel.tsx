import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PresentationView } from '@/components/PresentationView';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import type { useProjectFlow } from '@/hooks/use-project-flow';
import { useTheme } from '@/hooks/use-theme';
import { isMvpPlanCurrent, isPresentationCurrent } from '@/lib/project-flow';
import type { Idea } from '@/types/idea';
import type { CandidateIdea, SampleMvpPlan } from '@/types/presentation';

type PresentationWorkflowPanelProps = {
  projectId: string;
  idea: Idea | null;
  flowController: ReturnType<typeof useProjectFlow>;
  onGoToSelection: () => void;
  onGoToMvp: () => void;
};

function Prerequisite({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.prerequisite, { borderColor: theme.border }]}>
      <ThemedText type="cardTitle">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{description}</ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.primary }, pressed && styles.pressed]}>
        <ThemedText type="button" style={{ color: theme.primary }}>{actionLabel}</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

export function PresentationWorkflowPanel({
  projectId,
  idea,
  flowController,
  onGoToSelection,
  onGoToMvp,
}: PresentationWorkflowPanelProps) {
  const { flow, conditions, savePresentationData } = flowController;
  const plan = isMvpPlanCurrent(flow?.mvpplan, idea?.id) ? flow?.mvpplan ?? null : null;
  const hasCurrentPresentation = isPresentationCurrent(flow?.presentationdata, idea?.id, plan);

  const candidate: CandidateIdea | null = useMemo(() => idea ? ({
    id: idea.id,
    title: idea.title,
    summary: idea.summary || idea.content,
    problem: idea.problem || '아이디어가 실행 계획으로 연결되지 않는 문제를 해결합니다.',
    targetUsers: idea.targetusers.length > 0 ? idea.targetusers : ['과제 팀'],
    solution: idea.solution || idea.content,
    keywords: idea.keywords,
    coreFeatures: idea.corefeatures,
  }) : null, [idea]);

  const simplePlan: SampleMvpPlan | null = useMemo(() => plan ? ({
    essentialFeatures: plan.mustHaveFeatures.map((item) => item.name),
    laterFeatures: plan.laterFeatures.map((item) => item.name),
    screens: plan.screens.map((item) => item.name),
    schedule: plan.schedule.map((item) => `${item.period}: ${item.goal}`),
    requiredApis: plan.apis.map((item) => item.name),
  }) : null, [plan]);

  if (!idea || !candidate) {
    return (
      <View style={styles.container}>
        <View style={styles.heading}>
          <ThemedText type="subtitle">발표자료</ThemedText>
          <ThemedText themeColor="textSecondary">선정 아이디어와 현재 MVP를 기준으로 발표자료와 문서를 생성합니다.</ThemedText>
        </View>
        <Prerequisite
          title="먼저 최종 아이디어를 선정해 주세요."
          description="발표자료의 기준이 될 아이디어가 필요합니다. 후보 비교 결과에서 최종 아이디어를 선택할 수 있어요."
          actionLabel="AI 비교·선정으로 이동"
          onAction={onGoToSelection}
        />
      </View>
    );
  }

  if (!plan || !simplePlan) {
    return (
      <View style={styles.container}>
        <View style={styles.heading}>
          <ThemedText type="subtitle">발표자료</ThemedText>
          <ThemedText themeColor="textSecondary">선정 아이디어와 현재 MVP를 기준으로 발표자료와 문서를 생성합니다.</ThemedText>
        </View>
        <Prerequisite
          title="현재 선정 아이디어의 MVP가 필요해요."
          description="이전에 만든 결과는 보존되어 있습니다. 현재 선정 아이디어 기준의 MVP를 만든 뒤 발표자료를 생성해 주세요."
          actionLabel="MVP 기획으로 이동"
          onAction={onGoToMvp}
        />
      </View>
    );
  }

  return (
    <PresentationView
      key={`${idea.id}:${plan.ideaId}`}
      projectId={projectId}
      projectConditions={conditions}
      selectedIdea={candidate}
      sampleMvpPlan={simplePlan}
      initialData={hasCurrentPresentation ? flow?.presentationdata : null}
      onSave={savePresentationData}
    />
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.four, paddingTop: Spacing.two },
  heading: { gap: Spacing.one },
  prerequisite: { gap: Spacing.two, borderWidth: 1, borderRadius: Radius.large, padding: Spacing.four },
  secondaryButton: { alignSelf: 'flex-start', minHeight: ControlHeight.touch, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  pressed: { opacity: 0.7 },
});
