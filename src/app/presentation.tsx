import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PresentationView } from '@/components/PresentationView';
import { ProjectFlowSteps } from '@/components/project-flow-steps';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, ControlHeight, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useIdeas } from '@/hooks/use-ideas';
import { useProjectFlow } from '@/hooks/use-project-flow';
import { useTheme } from '@/hooks/use-theme';
import type { CandidateIdea, SampleMvpPlan } from '@/types/presentation';

export default function PresentationScreen() {
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const theme = useTheme();
  const { ideas, isLoadingIdeas } = useIdeas(projectId);
  const { flow, conditions, isloadingflow, flowerror, savePresentationData } = useProjectFlow(projectId);
  const idea = ideas.find((item) => item.id === flow?.selectedideaid) ?? ideas.find((item) => item.status === 'selected');
  const plan = flow?.mvpplan;

  if (isLoadingIdeas || isloadingflow) return <ThemedView style={styles.center}><ActivityIndicator /></ThemedView>;
  if (!projectId || !idea || !plan) {
    return <ThemedView style={styles.center}><ThemedText type="smallBold">선정 아이디어와 MVP 계획이 필요합니다.</ThemedText>{flowerror ? <ThemedText style={styles.error}>{flowerror}</ThemedText> : null}<Pressable onPress={() => projectId ? router.replace(`/mvp-generator?projectId=${projectId}` as Href) : router.replace('/')} style={styles.button}><ThemedText type="smallBold" style={styles.buttonText}>MVP 화면으로 이동</ThemedText></Pressable></ThemedView>;
  }

  const candidate: CandidateIdea = {
    id: idea.id,
    title: idea.title,
    summary: idea.summary || idea.content,
    problem: idea.problem || '아이디어가 실행 계획으로 연결되지 않는 문제를 해결합니다.',
    targetUsers: idea.targetusers.length > 0 ? idea.targetusers : ['과제 팀'],
    solution: idea.solution || idea.content,
    keywords: idea.keywords,
    coreFeatures: idea.corefeatures,
  };
  const simplePlan: SampleMvpPlan = {
    essentialFeatures: plan.mustHaveFeatures.map((item) => item.name),
    laterFeatures: plan.laterFeatures.map((item) => item.name),
    screens: plan.screens.map((item) => item.name),
    schedule: plan.schedule.map((item) => `${item.period}: ${item.goal}`),
    requiredApis: plan.apis.map((item) => item.name),
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scrollContent}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <Pressable onPress={() => router.back()} style={styles.backButton}><ThemedText type="small" themeColor="textSecondary">← MVP 결과</ThemedText></Pressable>
          <ProjectFlowSteps current="presentation" />
          <PresentationView projectConditions={conditions} selectedIdea={candidate} sampleMvpPlan={simplePlan} initialData={flow?.presentationdata} onSave={savePresentationData} />
        </ThemedView>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { alignItems: 'center', paddingBottom: BottomTabInset + Spacing.four }, safeArea: { width: '100%', alignItems: 'center' }, container: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.three, gap: Spacing.four }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.three }, backButton: { minHeight: ControlHeight.touch, alignSelf: 'flex-start', justifyContent: 'center' }, error: { color: '#dc2626' }, button: { minHeight: ControlHeight.button, justifyContent: 'center', paddingHorizontal: Spacing.three, backgroundColor: '#4050D0', borderRadius: Radius.medium }, buttonText: { color: '#fff' },
});
