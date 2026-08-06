import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ProjectFlowSteps } from '@/components/project-flow-steps';
import { BottomTabInset, ControlHeight, MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { useFinalIdeaAnalysis } from '@/hooks/use-final-idea-analysis';
import { useIdeas } from '@/hooks/use-ideas';
import { useProject } from '@/hooks/use-project';
import { useProjectFlow } from '@/hooks/use-project-flow';
import { useTheme } from '@/hooks/use-theme';
import type { FinalIdeaAnalysisResult } from '@/types/final-analysis';
import type { CompleteProjectConditions } from '@/types/project-flow';

const skillLevelOptions = ['초급', '초급~중급', '중급', '중급~고급', '고급'] as const;

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        value={String(value)}
        keyboardType="number-pad"
        onChangeText={(text) => onChange(Math.max(0, Number(text.replace(/\D/g, '')) || 0))}
        style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
      />
    </View>
  );
}

function SkillLevelField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const theme = useTheme();

  return (
    <View style={[styles.field, styles.skillLevelField]}>
      <ThemedText type="smallBold">기술 수준</ThemedText>
      <View accessibilityRole="radiogroup" style={styles.skillLevelOptions}>
        {skillLevelOptions.map((option) => {
          const isSelected = value === option;

          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                styles.skillLevelOption,
                {
                  backgroundColor: isSelected ? theme.primarySoft : theme.background,
                  borderColor: isSelected ? theme.primary : theme.border,
                },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={isSelected ? { color: theme.primary } : undefined}>
                {option}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function CoachScreen() {
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const theme = useTheme();
  const { project } = useProject(projectId);
  const { ideas, isLoadingIdeas, loadIdeas } = useIdeas(projectId);
  const {
    flow,
    conditions,
    isloadingflow,
    flowerror,
    saveConditions,
    saveSelectedIdea,
    saveCoachResult,
  } = useProjectFlow(projectId);
  const [draft, setDraft] = useState<CompleteProjectConditions>(conditions);
  const [notice, setNotice] = useState('');
  const [mutationError, setMutationError] = useState('');
  const savedAnalysisRef = useRef<FinalIdeaAnalysisResult | null>(null);
  const candidates = useMemo(() => {
    const nonRootIdeas = ideas.filter((idea) => idea.side !== 'center' || idea.sourceid);
    return nonRootIdeas.length > 0 ? nonRootIdeas : ideas;
  }, [ideas]);
  const {
    analysis,
    analysisError,
    canAnalyze,
    isAnalyzing,
    analyzeIdeas,
  } = useFinalIdeaAnalysis(projectId ?? '', candidates, draft);
  const activeAnalysis = analysis ?? flow?.coachresult ?? null;
  const analysisById = useMemo(
    () => new Map(activeAnalysis?.analyses.map((item) => [item.ideaId, item]) ?? []),
    [activeAnalysis],
  );

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => setDraft(conditions), 0);
    return () => globalThis.clearTimeout(timeout);
  }, [conditions]);

  useEffect(() => {
    if (analysis && savedAnalysisRef.current !== analysis) {
      savedAnalysisRef.current = analysis;
      void saveCoachResult(analysis);
    }
  }, [analysis, saveCoachResult]);

  const updateDraft = <Key extends keyof CompleteProjectConditions>(key: Key, value: CompleteProjectConditions[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice('');
  };

  const handleSaveConditions = async () => {
    setMutationError('');
    const result = await saveConditions(draft);
    if (result.error) setMutationError(result.error);
    else setNotice('과제 조건을 저장했습니다.');
  };

  const handleSelect = async (ideaId: string) => {
    setMutationError('');
    const result = await saveSelectedIdea(ideaId);
    if (result.error) {
      setMutationError(result.error);
      return;
    }
    await loadIdeas();
    setNotice('최종 아이디어를 선정했습니다. 이제 MVP 기획으로 이어갈 수 있습니다.');
  };

  if (!projectId) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="smallBold">과제에서 AI 코치를 열어주세요.</ThemedText>
        <Pressable onPress={() => router.replace('/')} style={styles.secondaryButton}>
          <ThemedText type="smallBold">과제 목록</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scrollContent}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText type="small" themeColor="textSecondary">← 아이디어 보드</ThemedText>
          </Pressable>

          <ProjectFlowSteps current="coach" />

          <View style={styles.hero}>
            <ThemedText type="subtitle">A. 조건 기반 추천 · AI 과제 코치</ThemedText>
            <ThemedText themeColor="textSecondary">
              {project?.title ?? '현재 과제'}의 후보를 조건별로 비교하고 최종 아이디어를 선택합니다.
            </ThemedText>
          </View>

          <ThemedView
            type="backgroundElement"
            style={[styles.card, { borderColor: theme.border }, Shadows.card]}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>과제 조건</ThemedText>
            <View style={styles.fieldGrid}>
              <NumberField label="기간(주)" value={draft.durationWeeks} onChange={(value) => updateDraft('durationWeeks', value)} />
              <NumberField label="팀 인원" value={draft.teamSize} onChange={(value) => updateDraft('teamSize', value)} />
              <NumberField label="예산(원)" value={draft.budget} onChange={(value) => updateDraft('budget', value)} />
              <SkillLevelField value={draft.skillLevel} onChange={(value) => updateDraft('skillLevel', value)} />
            </View>
            <View style={styles.field}>
              <ThemedText type="smallBold">평가 기준 (쉼표로 구분)</ThemedText>
              <TextInput
                value={draft.evaluationCriteria.join(', ')}
                onChangeText={(value) => updateDraft('evaluationCriteria', value.split(',').map((item) => item.trim()).filter(Boolean))}
                style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
              />
            </View>
            <View style={styles.actionRow}>
              <Pressable onPress={handleSaveConditions} style={[styles.secondaryButton, { borderColor: theme.border }]}>
                <ThemedText type="smallBold">조건 저장</ThemedText>
              </Pressable>
              <Pressable disabled={!canAnalyze || isAnalyzing} onPress={analyzeIdeas} style={[styles.primaryButton, { backgroundColor: theme.primary }, (!canAnalyze || isAnalyzing) && styles.disabled]}>
                {isAnalyzing ? <ActivityIndicator color="#fff" /> : <ThemedText type="smallBold" style={styles.primaryText}>AI 비교 분석</ThemedText>}
              </Pressable>
            </View>
          </ThemedView>

          {(flowerror || mutationError || analysisError) ? <ThemedText style={styles.error}>{mutationError || analysisError || flowerror}</ThemedText> : null}
          {notice ? <ThemedText style={styles.success}>{notice}</ThemedText> : null}

          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>후보 아이디어 비교</ThemedText>
            {(isLoadingIdeas || isloadingflow) ? <ActivityIndicator /> : candidates.length === 0 ? (
              <ThemedText themeColor="textSecondary">먼저 대화에서 아이디어를 추출하고 저장해주세요.</ThemedText>
            ) : candidates.map((idea) => {
              const result = analysisById.get(idea.id);
              const selected = flow?.selectedideaid === idea.id || idea.status === 'selected';
              return (
                <ThemedView
                  key={idea.id}
                  type="backgroundElement"
                  style={[
                    styles.card,
                    { borderColor: selected ? theme.success : theme.border },
                    selected && { backgroundColor: theme.successSoft },
                    Shadows.card,
                  ]}>
                  <View style={styles.ideaHeader}>
                    <View style={styles.grow}>
                      <ThemedText type="smallBold">{idea.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{idea.summary || idea.content}</ThemedText>
                    </View>
                    {selected ? <ThemedText type="smallBold" style={styles.success}>최종 선정</ThemedText> : null}
                  </View>
                  {result ? (
                    <View style={styles.analysisGrid}>
                      <View style={styles.grow}><ThemedText type="smallBold">구현 가능성 · {result.feasibility}</ThemedText><ThemedText type="small" themeColor="textSecondary">{result.summary}</ThemedText></View>
                      <View style={styles.grow}><ThemedText type="smallBold">위험·개선 방향</ThemedText><ThemedText type="small" themeColor="textSecondary">{result.improvements.join(' · ')}</ThemedText></View>
                    </View>
                  ) : null}
                  {idea.keywords.length > 0 ? <ThemedText type="small" themeColor="textSecondary">추천 키워드: {idea.keywords.join(' · ')}</ThemedText> : null}
                  <Pressable onPress={() => handleSelect(idea.id)} style={[styles.selectButton, { backgroundColor: theme.success }, selected && styles.disabled]} disabled={selected}>
                    <ThemedText type="smallBold" style={styles.primaryText}>{selected ? '선정 완료' : '이 아이디어로 최종 선정'}</ThemedText>
                  </Pressable>
                </ThemedView>
              );
            })}
          </View>

          {activeAnalysis ? (
            <ThemedView
              type="primarySoft"
              style={[styles.card, { borderColor: theme.primary }, Shadows.card]}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>AI 종합 추천</ThemedText>
              <ThemedText>{activeAnalysis.overall.comparison}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">추천 이유: {activeAnalysis.overall.recommendationReason}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">새 아이디어 조합: {activeAnalysis.overall.combinationSuggestion}</ThemedText>
            </ThemedView>
          ) : null}

          {flow?.selectedideaid ? (
            <Pressable onPress={() => router.push(`/mvp-generator?projectId=${projectId}` as Href)} style={[styles.nextButton, { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" style={styles.primaryText}>B. 선정 아이디어로 MVP 기획하기 →</ThemedText>
            </Pressable>
          ) : null}
        </ThemedView>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { alignItems: 'center', paddingBottom: BottomTabInset + Spacing.four },
  safeArea: { width: '100%', alignItems: 'center' },
  container: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.three, gap: Spacing.four },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  backButton: { minHeight: ControlHeight.touch, alignSelf: 'flex-start', justifyContent: 'center' },
  hero: { gap: Spacing.one, paddingVertical: Spacing.three },
  section: { gap: Spacing.three },
  sectionTitle: { fontSize: 18, lineHeight: 26 },
  card: { gap: Spacing.three, padding: Spacing.four, borderRadius: Radius.large, borderWidth: 1 },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  field: { flex: 1, minWidth: 160, gap: Spacing.one },
  input: { minHeight: ControlHeight.input, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  skillLevelField: { flexBasis: '100%' },
  skillLevelOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  skillLevelOption: {
    minHeight: ControlHeight.touch,
    minWidth: 96,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  primaryButton: { minHeight: ControlHeight.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: Radius.medium },
  secondaryButton: { minHeight: ControlHeight.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: Radius.medium, borderWidth: 1 },
  selectButton: { alignSelf: 'flex-start', minHeight: ControlHeight.touch, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: Radius.medium },
  nextButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four, borderRadius: Radius.medium },
  primaryText: { color: '#fff' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  error: { color: '#dc2626' },
  success: { color: '#168B51' },
  ideaHeader: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  analysisGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  grow: { flex: 1, minWidth: 220, gap: Spacing.one },
});
