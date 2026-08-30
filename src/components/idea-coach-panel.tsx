import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ResultSummaryScreen } from '@/components/result/result-summary-screen';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useFinalIdeaAnalysis } from '@/hooks/use-final-idea-analysis';
import { useIdeaResults } from '@/hooks/use-idea-results';
import type { useProjectFlow } from '@/hooks/use-project-flow';
import { useTheme } from '@/hooks/use-theme';
import { createCoachInputFingerprint, isCoachAnalysisStale, isMvpPlanCurrent } from '@/lib/project-flow';
import type { FinalIdeaAnalysis } from '@/types/final-analysis';
import type { Idea } from '@/types/idea';
import type { CompleteProjectConditions } from '@/types/project-flow';

type ProjectFlowController = ReturnType<typeof useProjectFlow>;

type IdeaCoachPanelProps = {
  projectId: string;
  projectTitle: string;
  ideas: Idea[];
  isLoadingIdeas: boolean;
  loadIdeas: () => Promise<void>;
  flowController: ProjectFlowController;
  onGoToExtraction: () => void;
  onGoToList: () => void;
  onGoToMvp: () => void;
};

const skillLevelOptions = ['초급', '초급~중급', '중급', '중급~고급', '고급'] as const;

function sameConditions(left: CompleteProjectConditions, right: CompleteProjectConditions) {
  return (
    left.durationWeeks === right.durationWeeks &&
    left.teamSize === right.teamSize &&
    left.skillLevel === right.skillLevel &&
    left.budget === right.budget &&
    left.evaluationCriteria.join('\n') === right.evaluationCriteria.join('\n')
  );
}

function NumberField({
  label,
  value,
  minimum = 0,
  onChange,
}: {
  label: string;
  value: number;
  minimum?: number;
  onChange: (value: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        value={String(value)}
        keyboardType="number-pad"
        onChangeText={(text) => onChange(Math.max(minimum, Number(text.replace(/\D/g, '')) || minimum))}
        style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
      />
    </View>
  );
}

function SkillLevelField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.field, styles.fullField]}>
      <ThemedText type="smallBold">기술 수준</ThemedText>
      <View accessibilityRole="radiogroup" accessibilityLabel="팀 기술 수준" style={styles.optionRow}>
        {skillLevelOptions.map((option) => {
          const selected = value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected ? theme.primarySoft : theme.background,
                  borderColor: selected ? theme.primary : theme.border,
                },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={selected ? { color: theme.primary } : undefined}>{option}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function BulletList({ items, emptyText }: { items?: string[]; emptyText: string }) {
  const values = items?.filter(Boolean) ?? [];
  return (
    <View style={styles.list}>
      {(values.length > 0 ? values : [emptyText]).map((item, index) => (
        <ThemedText key={`${item}-${index}`} type="small" themeColor="textSecondary">• {item}</ThemedText>
      ))}
    </View>
  );
}

function CandidateAnalysis({ analysis }: { analysis: FinalIdeaAnalysis }) {
  return (
    <View style={styles.analysisDetails}>
      <ThemedText type="small" themeColor="textSecondary">{analysis.summary}</ThemedText>
      <View style={styles.analysisColumns}>
        <View style={styles.analysisColumn}>
          <ThemedText type="smallBold">장점</ThemedText>
          <BulletList items={analysis.strengths} emptyText="장점 분석을 다시 실행해 주세요." />
        </View>
        <View style={styles.analysisColumn}>
          <ThemedText type="smallBold">위험</ThemedText>
          <BulletList items={analysis.risks ?? analysis.improvements} emptyText="위험 분석을 다시 실행해 주세요." />
        </View>
        <View style={styles.analysisColumn}>
          <ThemedText type="smallBold">개선 제안</ThemedText>
          <BulletList items={analysis.improvements} emptyText="개선 제안을 다시 실행해 주세요." />
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        실현 가능성 {analysis.feasibility} · 과제 적합성 {analysis.projectFit}
      </ThemedText>
    </View>
  );
}

export function IdeaCoachPanel({
  projectId,
  projectTitle,
  ideas,
  isLoadingIdeas,
  loadIdeas,
  flowController,
  onGoToExtraction,
  onGoToList,
  onGoToMvp,
}: IdeaCoachPanelProps) {
  const theme = useTheme();
  const {
    flow,
    conditions,
    isloadingflow,
    flowerror,
    saveConditions,
    saveSelectedIdea,
    saveCoachResult,
  } = flowController;
  const [draft, setDraft] = useState<CompleteProjectConditions>(conditions);
  const [criteriaText, setCriteriaText] = useState(conditions.evaluationCriteria.join(', '));
  const [hydratedProjectId, setHydratedProjectId] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [notice, setNotice] = useState('');
  const [mutationError, setMutationError] = useState('');
  const saveSequence = useRef(0);
  const conditionSavePromise = useRef<Promise<{ error?: string }> | null>(null);
  const lastSavedConditions = useRef('');
  const latestDraft = useRef(draft);
  const hydratedProjectRef = useRef('');
  const candidates = useMemo(() => {
    const realIdeas = ideas.filter((idea) => !idea.legacystructural && (idea.title.trim() || idea.content.trim()));
    return realIdeas.length > 0 ? realIdeas : ideas.filter((idea) => idea.title.trim() || idea.content.trim());
  }, [ideas]);
  const fingerprint = useMemo(() => createCoachInputFingerprint(candidates, draft), [candidates, draft]);
  const { analysis, analysisError, canAnalyze, isAnalyzing, isLimited, maxAnalysisIdeas, skippedBlankCount, analyzeIdeas } =
    useFinalIdeaAnalysis(projectId, candidates, draft);
  const activeAnalysis = analysis ?? flow?.coachresult ?? null;
  const isAnalysisStale = isCoachAnalysisStale(activeAnalysis, fingerprint);
  const analysisById = useMemo(
    () => new Map(activeAnalysis?.analyses.map((item) => [item.ideaId, item]) ?? []),
    [activeAnalysis],
  );
  const selectedIdea = ideas.find((idea) => idea.id === flow?.selectedideaid)
    ?? ideas.find((idea) => idea.status === 'selected')
    ?? null;
  const previousMvpIsStale = Boolean(flow?.mvpplan && !isMvpPlanCurrent(flow.mvpplan, selectedIdea?.id));
  const { data: resultData } = useIdeaResults({
    ideas: candidates,
    analysis: activeAnalysis,
    currentUserEvaluatedAll: Boolean(activeAnalysis),
    teamSize: draft.teamSize,
  });

  const persistConditions = useCallback((nextConditions: CompleteProjectConditions): Promise<{ error?: string }> => {
    const serialized = JSON.stringify(nextConditions);
    if (serialized === lastSavedConditions.current) return Promise.resolve<{ error?: string }>({});
    const previousSave = conditionSavePromise.current;
    const nextSave: Promise<{ error?: string }> = (async () => {
      if (previousSave) await previousSave;
      if (serialized === lastSavedConditions.current) return {};
      const result = await saveConditions(nextConditions);
      if (!result.error) lastSavedConditions.current = serialized;
      return result;
    })();
    conditionSavePromise.current = nextSave;
    void nextSave.finally(() => {
      if (conditionSavePromise.current === nextSave) conditionSavePromise.current = null;
    });
    return nextSave;
  }, [saveConditions]);

  useEffect(() => {
    latestDraft.current = draft;
  }, [draft]);

  useEffect(() => {
    if (isloadingflow || hydratedProjectId === projectId) return;
    const timeout = globalThis.setTimeout(() => {
      setDraft(conditions);
      setCriteriaText(conditions.evaluationCriteria.join(', '));
      latestDraft.current = conditions;
      lastSavedConditions.current = JSON.stringify(conditions);
      hydratedProjectRef.current = projectId;
      setHydratedProjectId(projectId);
    }, 0);
    return () => globalThis.clearTimeout(timeout);
  }, [conditions, hydratedProjectId, isloadingflow, projectId]);

  useEffect(() => () => {
    if (hydratedProjectRef.current === projectId) void persistConditions(latestDraft.current);
  }, [persistConditions, projectId]);

  useEffect(() => {
    if (hydratedProjectId !== projectId || sameConditions(draft, conditions)) return;
    const sequence = ++saveSequence.current;
    const timeout = globalThis.setTimeout(async () => {
      setSaveState('saving');
      const result = await persistConditions(draft);
      if (sequence !== saveSequence.current) return;
      if (result.error) {
        setSaveState('error');
        setMutationError(result.error);
      } else {
        setSaveState('saved');
      }
    }, 800);
    return () => globalThis.clearTimeout(timeout);
  }, [conditions, draft, hydratedProjectId, persistConditions, projectId]);

  const updateDraft = <Key extends keyof CompleteProjectConditions>(key: Key, value: CompleteProjectConditions[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaveState('idle');
    setNotice('');
    setMutationError('');
  };

  const handleCriteriaChange = (value: string) => {
    setCriteriaText(value);
    updateDraft('evaluationCriteria', value.split(',').map((item) => item.trim()).filter(Boolean));
  };

  const handleAnalyze = async () => {
    if (isAnalyzing) return;
    setMutationError('');
    setNotice('');
    const savedConditions = await persistConditions(draft);
    if (savedConditions.error) {
      setMutationError(savedConditions.error);
      setSaveState('error');
      return;
    }
    setSaveState('saved');
    const result = await analyzeIdeas(fingerprint);
    if (!result) return;
    const saved = await saveCoachResult(result);
    if (saved.error) setMutationError(saved.error);
    else setNotice('AI 분석 결과를 저장했습니다. 추천을 참고해 최종 아이디어를 선택해 주세요.');
  };

  const handleSelect = async (ideaId: string) => {
    if (!activeAnalysis || isAnalyzing) return;
    setMutationError('');
    setNotice('');
    const changed = Boolean(selectedIdea && selectedIdea.id !== ideaId);
    const result = await saveSelectedIdea(ideaId);
    if (result.error) {
      setMutationError(result.error);
      return;
    }
    await loadIdeas();
    setNotice(changed
      ? '최종 아이디어를 변경했습니다. 이전 MVP·발표자료는 이전 아이디어 기준으로 보관됩니다.'
      : '최종 아이디어를 선정했습니다. 이제 MVP 기획을 시작할 수 있습니다.');
  };

  const saveLabel = saveState === 'saving'
    ? '조건 저장 중…'
    : saveState === 'saved'
      ? '조건 저장됨'
      : saveState === 'error'
        ? '조건 저장 실패'
        : '조건은 자동 저장됩니다';

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <ThemedText type="subtitle">AI로 아이디어 비교하기</ThemedText>
        <ThemedText themeColor="textSecondary">
          {projectTitle}의 후보를 먼저 비교하고, 분석 결과를 확인한 뒤 최종 아이디어를 선택하세요.
        </ThemedText>
      </View>

      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }, Shadows.card]}>
        <View style={styles.sectionHeading}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>비교 조건</ThemedText>
          <ThemedText
            accessibilityLiveRegion="polite"
            type="small"
            style={saveState === 'error' ? { color: theme.danger } : { color: theme.textTertiary }}>
            {saveLabel}
          </ThemedText>
        </View>
        <View style={styles.fieldGrid}>
          <NumberField label="기간(주)" minimum={1} value={draft.durationWeeks} onChange={(value) => updateDraft('durationWeeks', value)} />
          <NumberField label="팀 인원" minimum={1} value={draft.teamSize} onChange={(value) => updateDraft('teamSize', value)} />
          <NumberField label="예산(원)" value={draft.budget} onChange={(value) => updateDraft('budget', value)} />
          <SkillLevelField value={draft.skillLevel} onChange={(value) => updateDraft('skillLevel', value)} />
        </View>
        <View style={styles.field}>
          <ThemedText type="smallBold">평가 기준 (쉼표로 구분)</ThemedText>
          <TextInput
            accessibilityLabel="평가 기준"
            value={criteriaText}
            onChangeText={handleCriteriaChange}
            style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAnalyze || isAnalyzing }}
          disabled={!canAnalyze || isAnalyzing}
          onPress={() => void handleAnalyze()}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.primary },
            (!canAnalyze || isAnalyzing) && styles.disabled,
            pressed && styles.pressed,
          ]}>
          {isAnalyzing ? <ActivityIndicator color="#fff" /> : (
            <ThemedText type="smallBold" style={styles.whiteText}>
              {activeAnalysis ? 'AI 분석 다시 실행하기' : candidates.length === 1 ? 'AI로 구체화·위험 분석하기' : 'AI 비교 분석하기'}
            </ThemedText>
          )}
        </Pressable>
        {isLimited ? <ThemedText type="small" themeColor="textSecondary">최대 {maxAnalysisIdeas}개 후보를 분석합니다.</ThemedText> : null}
        {skippedBlankCount > 0 ? <ThemedText type="small" themeColor="textSecondary">내용이 없는 후보 {skippedBlankCount}개는 분석에서 제외됩니다.</ThemedText> : null}
      </ThemedView>

      {!canAnalyze && !isLoadingIdeas ? (
        <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">분석할 아이디어가 아직 없어요.</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">아이디어를 추출하거나 목록에서 직접 추가한 뒤 돌아오세요.</ThemedText>
          <View style={styles.actionRow}>
            <Pressable onPress={onGoToExtraction} style={[styles.secondaryButton, { borderColor: theme.border }]}><ThemedText type="smallBold">아이디어 추출하기</ThemedText></Pressable>
            <Pressable onPress={onGoToList} style={[styles.secondaryButton, { borderColor: theme.border }]}><ThemedText type="smallBold">아이디어 직접 추가</ThemedText></Pressable>
          </View>
        </ThemedView>
      ) : null}

      {isAnalysisStale ? (
        <ThemedView accessibilityLiveRegion="polite" type="backgroundElement" style={[styles.noticeCard, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
          <ThemedText type="smallBold" style={{ color: theme.warning }}>아이디어 또는 조건이 변경되어 다시 분석하는 것이 좋아요.</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">저장된 분석 결과는 유지되며, 다시 분석하기 전에도 확인할 수 있습니다.</ThemedText>
        </ThemedView>
      ) : null}

      {(flowerror || mutationError || analysisError) ? (
        <ThemedView type="backgroundElement" style={[styles.noticeCard, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
          <ThemedText type="small" style={{ color: theme.danger }}>{mutationError || analysisError || flowerror}</ThemedText>
          {canAnalyze ? <Pressable disabled={isAnalyzing} onPress={() => void handleAnalyze()} style={[styles.inlineButton, { borderColor: theme.danger }]}><ThemedText type="smallBold">다시 시도</ThemedText></Pressable> : null}
        </ThemedView>
      ) : null}
      {notice ? <ThemedText accessibilityLiveRegion="polite" type="small" style={{ color: theme.success }}>{notice}</ThemedText> : null}

      {selectedIdea ? (
        <ThemedView type="backgroundElement" style={[styles.selectedCard, { backgroundColor: theme.successSoft, borderColor: theme.success }, Shadows.card]}>
          <ThemedText type="smallBold" style={{ color: theme.success }}>현재 선정된 아이디어</ThemedText>
          <ThemedText type="subtitle">{selectedIdea.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{selectedIdea.summary || selectedIdea.content}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">아래 후보에서 언제든 다른 아이디어로 변경할 수 있습니다.</ThemedText>
        </ThemedView>
      ) : null}

      {activeAnalysis ? (
        <ThemedView type="primarySoft" style={[styles.card, { borderColor: theme.primary }, Shadows.card]}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>AI 종합 추천</ThemedText>
          <View style={styles.analysisBlock}><ThemedText type="smallBold">추천 아이디어</ThemedText><ThemedText>{activeAnalysis.overall.recommendedIdeaIds.map((id) => ideas.find((idea) => idea.id === id)?.title).filter(Boolean).join(', ') || '추천 후보를 확인할 수 없습니다.'}</ThemedText></View>
          <View style={styles.analysisBlock}><ThemedText type="smallBold">추천 이유</ThemedText><ThemedText type="small" themeColor="textSecondary">{activeAnalysis.overall.recommendationReason}</ThemedText></View>
          <View style={styles.analysisBlock}><ThemedText type="smallBold">전체 비교</ThemedText><ThemedText type="small" themeColor="textSecondary">{activeAnalysis.overall.comparison}</ThemedText></View>
          <View style={styles.analysisBlock}><ThemedText type="smallBold">아이디어 조합 제안</ThemedText><ThemedText type="small" themeColor="textSecondary">{activeAnalysis.overall.combinationSuggestion}</ThemedText></View>
        </ThemedView>
      ) : null}

      <ResultSummaryScreen
        data={resultData}
        selectedIdeaId={selectedIdea?.id}
        onGoToEvaluation={() => undefined}
        onSelectIdea={handleSelect}
      />

      {false ? <View style={styles.section}>
        <ThemedText type="smallBold" style={styles.sectionTitle}>{candidates.length === 1 ? '아이디어 구체화 결과와 최종 선정' : '후보별 분석과 최종 선정'}</ThemedText>
        {(isLoadingIdeas || isloadingflow) ? <ActivityIndicator /> : candidates.map((idea) => {
          const result = analysisById.get(idea.id);
          const selected = selectedIdea?.id === idea.id;
          const recommended = activeAnalysis?.overall.recommendedIdeaIds.includes(idea.id) ?? false;
          return (
            <ThemedView key={idea.id} type="backgroundElement" style={[styles.card, { borderColor: selected ? theme.success : theme.border }, selected && { backgroundColor: theme.successSoft }, Shadows.card]}>
              <View style={styles.ideaHeader}>
                <View style={styles.grow}><ThemedText type="smallBold">{idea.title}</ThemedText><ThemedText type="small" themeColor="textSecondary">{idea.summary || idea.content}</ThemedText></View>
                {recommended ? <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}><ThemedText type="smallBold" style={{ color: theme.primary }}>AI 추천</ThemedText></View> : null}
              </View>
              {result ? <CandidateAnalysis analysis={result} /> : <ThemedText type="small" themeColor="textSecondary">AI 분석 후 장점·위험·개선 제안을 확인할 수 있습니다.</ThemedText>}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: selected || !activeAnalysis }}
                disabled={selected || !activeAnalysis || isAnalyzing}
                onPress={() => void handleSelect(idea.id)}
                style={[styles.selectButton, { backgroundColor: theme.success }, (selected || !activeAnalysis || isAnalyzing) && styles.disabled]}>
                <ThemedText type="smallBold" style={styles.whiteText}>{selected ? '현재 선정됨' : '이 아이디어를 최종 선정'}</ThemedText>
              </Pressable>
            </ThemedView>
          );
        })}
        {!activeAnalysis && candidates.length > 0 ? <ThemedText type="small" themeColor="textSecondary">후보를 분석하면 최종 선정 버튼이 활성화됩니다.</ThemedText> : null}
      </View> : null}

      {previousMvpIsStale ? (
        <ThemedView type="backgroundElement" style={[styles.noticeCard, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
          <ThemedText type="smallBold" style={{ color: theme.warning }}>기존 MVP·발표자료는 이전 아이디어 기준입니다.</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">기존 결과는 삭제하지 않았습니다. 새로 선정한 아이디어로 MVP를 다시 생성하면 흐름을 이어갈 수 있습니다.</ThemedText>
        </ThemedView>
      ) : null}

      {selectedIdea ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="MVP 기획 단계로 이동"
          onPress={onGoToMvp}
          style={({ pressed }) => [styles.nextButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.whiteText}>MVP 기획으로 이동</ThemedText>
        </Pressable>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">MVP 기획을 시작하려면 아이디어를 하나 선정해 주세요.</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.four },
  hero: { gap: Spacing.one, paddingVertical: Spacing.two },
  card: { gap: Spacing.three, padding: Spacing.four, borderRadius: Radius.large, borderWidth: 1 },
  selectedCard: { gap: Spacing.two, padding: Spacing.four, borderRadius: Radius.large, borderWidth: 1 },
  noticeCard: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.medium, borderWidth: 1 },
  section: { gap: Spacing.three },
  sectionHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.two },
  sectionTitle: { fontSize: 18, lineHeight: 26 },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  field: { flex: 1, minWidth: 150, gap: Spacing.one },
  fullField: { flexBasis: '100%' },
  input: { minHeight: ControlHeight.input, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: { minHeight: ControlHeight.touch, minWidth: 88, flexGrow: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.two },
  primaryButton: { minHeight: ControlHeight.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: Radius.medium },
  secondaryButton: { minHeight: ControlHeight.touch, justifyContent: 'center', paddingHorizontal: Spacing.three, borderWidth: 1, borderRadius: Radius.medium },
  inlineButton: { alignSelf: 'flex-start', minHeight: ControlHeight.touch, justifyContent: 'center', paddingHorizontal: Spacing.three, borderWidth: 1, borderRadius: Radius.medium },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  ideaHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: Spacing.three },
  badge: { borderRadius: Radius.pill, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  grow: { flex: 1, minWidth: 220, gap: Spacing.one },
  analysisDetails: { gap: Spacing.two },
  analysisColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  analysisColumn: { flex: 1, minWidth: 180, gap: Spacing.one },
  analysisBlock: { gap: Spacing.one },
  list: { gap: Spacing.one },
  selectButton: { alignSelf: 'flex-start', minHeight: ControlHeight.touch, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: Radius.medium },
  nextButton: { alignSelf: 'flex-start', minHeight: ControlHeight.button, justifyContent: 'center', paddingHorizontal: Spacing.four, borderRadius: Radius.medium },
  whiteText: { color: '#fff' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
