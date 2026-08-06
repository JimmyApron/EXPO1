import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ProjectFlowSteps } from '@/components/project-flow-steps';
import { BottomTabInset, ControlHeight, MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { selectedIdea as sampleSelectedIdea } from '@/constants/mvp';
import { useIdeas } from '@/hooks/use-ideas';
import { useMvpPlan } from '@/hooks/use-mvp-plan';
import { useProjectFlow } from '@/hooks/use-project-flow';
import { useTheme } from '@/hooks/use-theme';
import type { MvpIdea } from '@/types/mvp-plan';

function BulletList({ items }: { items: string[] }) {
  return <View style={styles.list}>{items.map((item, index) => <ThemedText key={`${item}-${index}`} type="small" themeColor="textSecondary">• {item}</ThemedText>)}</View>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();

  return <ThemedView type="backgroundElement" style={[styles.section, { borderColor: theme.border }, Shadows.card]}><ThemedText type="smallBold" style={styles.sectionTitle}>{title}</ThemedText>{children}</ThemedView>;
}

export default function MvpGeneratorScreen() {
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const { ideas, isLoadingIdeas } = useIdeas(projectId);
  const { flow, conditions, isloadingflow, flowerror, saveMvpPlan } = useProjectFlow(projectId);
  const selected = ideas.find((idea) => idea.id === flow?.selectedideaid) ?? ideas.find((idea) => idea.status === 'selected');
  const mvpIdea: MvpIdea = useMemo(() => selected
    ? ({
        id: selected.id,
        title: selected.title,
        description: selected.summary || selected.content,
        targetUsers: selected.targetusers.join(', ') || '과제 대상 사용자',
      })
    : sampleSelectedIdea, [selected]);
  const { plan, isGenerating, error, generatePlan } = useMvpPlan(mvpIdea, conditions, flow?.mvpplan, saveMvpPlan);
  const theme = useTheme();

  const openPresentation = async () => {
    if (!projectId) return;
    const result = await saveMvpPlan(plan);
    if (!result.error) router.push(`/presentation?projectId=${projectId}` as Href);
  };

  if ((isLoadingIdeas || isloadingflow) && projectId) {
    return <ThemedView style={styles.center}><ActivityIndicator /></ThemedView>;
  }

  if (projectId && !selected) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="smallBold">A 단계에서 최종 아이디어를 먼저 선택해주세요.</ThemedText>
        {flowerror ? <ThemedText style={styles.error}>{flowerror}</ThemedText> : null}
        <Pressable onPress={() => router.replace(`/coach?projectId=${projectId}` as Href)} style={styles.generateButton}><ThemedText type="smallBold" style={styles.buttonText}>AI 코치로 이동</ThemedText></Pressable>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scrollContent}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <Pressable onPress={() => router.back()} style={styles.backButton}><ThemedText type="small" themeColor="textSecondary">← AI 코치</ThemedText></Pressable>
          <ProjectFlowSteps current="mvp" />
          <View style={styles.hero}>
            <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}><ThemedText type="smallBold" style={[styles.badgeText, { color: theme.primary }]}>B · AI MVP GENERATOR</ThemedText></View>
            <ThemedText type="subtitle">{plan.ideaTitle}</ThemedText>
            <ThemedText themeColor="textSecondary">{plan.summary}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">선정 아이디어: {selected?.sourceid ?? mvpIdea.id} · {mvpIdea.targetUsers}</ThemedText>
            <Pressable disabled={isGenerating} onPress={generatePlan} style={({ pressed }) => [styles.generateButton, { backgroundColor: theme.primary }, (pressed || isGenerating) && styles.pressed]}>
              {isGenerating ? <ActivityIndicator color="#fff" /> : <ThemedText type="smallBold" style={styles.buttonText}>AI로 MVP 계획 생성·저장</ThemedText>}
            </Pressable>
            {error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}
          </View>

          <View style={styles.twoColumn}>
            <Section title="MVP 필수 기능">{plan.mustHaveFeatures.map((feature) => <View key={feature.name} style={styles.item}><ThemedText type="smallBold">{feature.name}</ThemedText><ThemedText type="small" themeColor="textSecondary">{feature.description}</ThemedText></View>)}</Section>
            <Section title="추후 기능">{plan.laterFeatures.map((feature) => <View key={feature.name} style={styles.item}><ThemedText type="smallBold">{feature.name}</ThemedText><ThemedText type="small" themeColor="textSecondary">{feature.description}</ThemedText></View>)}</Section>
          </View>

          <Section title="화면 구조와 와이어프레임 초안">{plan.screens.map((screen) => <View key={screen.name} style={styles.wireframe}><ThemedText type="smallBold">{screen.name}</ThemedText><ThemedText type="small" themeColor="textSecondary">{screen.purpose}</ThemedText><View style={[styles.wireframeBox, { borderColor: theme.primary }]}>{screen.wireframe.map((block) => <View key={block} style={[styles.wireframeBlock, { backgroundColor: theme.primarySoft }]}><ThemedText type="small">{block}</ThemedText></View>)}</View></View>)}</Section>
          <Section title="전체 개발 일정">{plan.schedule.map((step) => <View key={step.period} style={styles.timeline}><ThemedText type="smallBold" style={styles.periodText}>{step.period}</ThemedText><View style={styles.grow}><ThemedText type="smallBold">{step.goal}</ThemedText><BulletList items={step.tasks} /></View></View>)}</Section>
          <Section title="팀원 역할 분담"><View style={styles.cardGrid}>{plan.teamRoles.map((role) => <View key={role.role} style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}><ThemedText type="smallBold">{role.role}</ThemedText><BulletList items={role.responsibilities} /></View>)}</View></Section>
          <Section title="필요 API 목록">{plan.apis.map((api) => <View key={api.name} style={styles.apiRow}><ThemedText type="smallBold" style={styles.method}>{api.method}</ThemedText><View style={styles.grow}><ThemedText type="smallBold">{api.name}</ThemedText><ThemedText type="small" themeColor="textSecondary">{api.purpose}</ThemedText></View></View>)}</Section>
          <Section title="발표 순서">{plan.presentationOrder.map((item, index) => <ThemedText key={`${item}-${index}`} type="small">{index + 1}. {item}</ThemedText>)}</Section>

          {projectId ? <Pressable onPress={openPresentation} style={[styles.nextButton, { backgroundColor: theme.success }]}><ThemedText type="smallBold" style={styles.buttonText}>C. 이 MVP로 발표 자료 만들기 →</ThemedText></Pressable> : null}
        </ThemedView>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { alignItems: 'center', paddingBottom: BottomTabInset + Spacing.four }, safeArea: { width: '100%', alignItems: 'center' },
  container: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.three, gap: Spacing.four }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.three },
  backButton: { minHeight: ControlHeight.touch, alignSelf: 'flex-start', justifyContent: 'center' }, hero: { gap: Spacing.three, paddingVertical: Spacing.three },
  badge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Radius.pill }, badgeText: { letterSpacing: 0.6 },
  generateButton: { minHeight: ControlHeight.button, alignSelf: 'flex-start', justifyContent: 'center', backgroundColor: '#4050D0', paddingHorizontal: Spacing.four, borderRadius: Radius.medium }, nextButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', padding: Spacing.three, borderRadius: Radius.medium },
  buttonText: { color: '#fff' }, error: { color: '#dc2626' }, pressed: { opacity: 0.65 }, twoColumn: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  section: { flex: 1, minWidth: 280, gap: Spacing.three, borderRadius: Radius.large, borderWidth: 1, padding: Spacing.four }, sectionTitle: { fontSize: 18, lineHeight: 26 }, item: { gap: Spacing.one },
  list: { gap: Spacing.one }, wireframe: { gap: Spacing.two }, wireframeBox: { borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.medium, padding: Spacing.two, gap: Spacing.two }, wireframeBlock: { padding: Spacing.two, borderRadius: Radius.small },
  timeline: { flexDirection: 'row', gap: Spacing.three }, periodText: { color: '#4050D0', minWidth: 64 }, grow: { flex: 1 }, cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }, card: { minWidth: 220, flex: 1, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.two },
  apiRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' }, method: { color: '#3442B8', minWidth: 52 },
});
