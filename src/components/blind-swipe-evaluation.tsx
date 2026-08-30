import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ResultSummaryScreen } from '@/components/result/result-summary-screen';
import { ThemedText } from '@/components/themed-text';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useBlindIdeaAnalysis } from '@/hooks/use-blind-idea-analysis';
import { useFinalIdeaAnalysis } from '@/hooks/use-final-idea-analysis';
import { useIdeaEvaluations } from '@/hooks/use-idea-evaluations';
import type { useProjectFlow } from '@/hooks/use-project-flow';
import { calculateIdeaResults, createBlindIdeaAnalyses, createIdeaResultData } from '@/lib/idea-evaluation';
import { createCoachInputFingerprint, isCoachAnalysisStale } from '@/lib/project-flow';
import type { EvaluationChoice } from '@/types/idea-evaluation';
import type { Idea } from '@/types/idea';

type ProjectFlowController = ReturnType<typeof useProjectFlow>;

type BlindSwipeEvaluationProps = {
  projectId: string;
  projectOwnerId: string;
  ideas: Idea[];
  flowController: ProjectFlowController;
  isLoadingIdeas: boolean;
  loadIdeas: () => Promise<void>;
  onGoToExtraction: () => void;
  onGoToList: () => void;
  onGoToMvp: () => void;
};

const orange = '#F59E0B';
const orangeDark = '#D97706';
const cream = '#FAF7F2';
const navy = '#1E293B';
const muted = '#64748B';
const cardExitDistance = 520;
const swipeThreshold = 86;

export function BlindSwipeEvaluation({
  projectId,
  projectOwnerId,
  ideas,
  flowController,
  isLoadingIdeas,
  loadIdeas,
  onGoToExtraction,
  onGoToList,
  onGoToMvp,
}: BlindSwipeEvaluationProps) {
  const { flow, conditions, saveCoachResult, saveSelectedIdea } = flowController;
  const {
    currentUserId,
    evaluations,
    evaluationError,
    isLoadingEvaluations,
    isSavingEvaluation,
    saveEvaluation,
  } = useIdeaEvaluations(projectId);
  const [displayIdeaId, setDisplayIdeaId] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const [isSelectingResult, setIsSelectingResult] = useState(false);
  const recommendationRequestKey = useRef('');
  const translateX = useSharedValue(0);

  const candidates = useMemo(
    () => ideas
      .filter((idea) => !idea.legacystructural && Boolean(idea.title.trim() || idea.content.trim()))
      .sort((left, right) => left.createdat.localeCompare(right.createdat)),
    [ideas],
  );
  const { analyses: aiAnalyses, blindAnalysisError, isAnalyzingIdeas, isAnalysisReady } = useBlindIdeaAnalysis(projectId, candidates);
  const analyses = useMemo(() => createBlindIdeaAnalyses(candidates, aiAnalyses), [aiAnalyses, candidates]);
  const myEvaluatedIds = useMemo(
    () => new Set(evaluations.filter((evaluation) => evaluation.userId === currentUserId).map((evaluation) => evaluation.ideaId)),
    [currentUserId, evaluations],
  );
  const remaining = useMemo(() => analyses.filter((analysis) => !myEvaluatedIds.has(analysis.id)), [analyses, myEvaluatedIds]);
  const current = useMemo(
    () => (isTransitioning ? analyses.find((analysis) => analysis.id === displayIdeaId) : null) ?? remaining[0] ?? null,
    [analyses, displayIdeaId, isTransitioning, remaining],
  );
  const isComplete = analyses.length > 0 && remaining.length === 0;
  const recommendationFingerprint = useMemo(
    () => createCoachInputFingerprint(candidates, conditions),
    [candidates, conditions],
  );
  const {
    analysis: generatedRecommendation,
    analysisError: recommendationError,
    canAnalyze: canAnalyzeRecommendation,
    isAnalyzing: isAnalyzingRecommendation,
    analyzeIdeas,
  } = useFinalIdeaAnalysis(projectId, candidates, conditions);
  const savedRecommendation = flow?.coachresult;
  const activeRecommendation = generatedRecommendation
    && !isCoachAnalysisStale(generatedRecommendation, recommendationFingerprint)
    ? generatedRecommendation
    : savedRecommendation && !isCoachAnalysisStale(savedRecommendation, recommendationFingerprint)
      ? savedRecommendation
      : null;
  const currentParticipantCount = useMemo(
    () => {
      const candidateIds = new Set(analyses.map((analysis) => analysis.id));
      return new Set(
        evaluations
          .filter((evaluation) => candidateIds.has(evaluation.ideaId))
          .map((evaluation) => evaluation.userId),
      ).size;
    },
    [analyses, evaluations],
  );
  const results = useMemo(
    () => calculateIdeaResults(analyses, evaluations, currentParticipantCount),
    [analyses, currentParticipantCount, evaluations],
  );
  const resultData = useMemo(
    () => createIdeaResultData(results, activeRecommendation),
    [activeRecommendation, results],
  );
  const teamSize = Math.max(1, conditions.teamSize);
  const majorityCount = Math.floor(teamSize / 2) + 1;
  const isProjectLeader = Boolean(currentUserId && currentUserId === projectOwnerId);
  const canSelectFinalIdea = isProjectLeader || currentParticipantCount >= majorityCount;
  const selectionHint = `팀장 또는 ${majorityCount}명 이상 참여 후 최종 선정할 수 있어요.`;
  const selectedIdeaId = flow?.selectedideaid
    ?? candidates.find((idea) => idea.status === 'selected')?.id
    ?? null;

  const requestRecommendation = useCallback(async (force = false) => {
    if (!isComplete || !canAnalyzeRecommendation || activeRecommendation || isAnalyzingRecommendation) return;
    if (!force && recommendationRequestKey.current === recommendationFingerprint) return;
    recommendationRequestKey.current = recommendationFingerprint;
    const recommendation = await analyzeIdeas(recommendationFingerprint);
    if (recommendation) await saveCoachResult(recommendation);
  }, [
    activeRecommendation,
    analyzeIdeas,
    canAnalyzeRecommendation,
    isAnalyzingRecommendation,
    isComplete,
    recommendationFingerprint,
    saveCoachResult,
  ]);

  useEffect(() => {
    if (!isComplete || activeRecommendation || recommendationError) return;
    const timeout = globalThis.setTimeout(() => void requestRecommendation(), 0);
    return () => globalThis.clearTimeout(timeout);
  }, [activeRecommendation, isComplete, recommendationError, requestRecommendation]);

  const finishTransition = () => {
    translateX.value = 0;
    setDisplayIdeaId('');
    setIsTransitioning(false);
  };

  const choose = async (choice: EvaluationChoice) => {
    if (!current || isTransitioning || isSavingEvaluation) return;

    setSelectionError('');
    setIsTransitioning(true);
    setDisplayIdeaId(current.id);
    const saved = await saveEvaluation(current.id, choice);
    if (saved.error) {
      setSelectionError(saved.error);
      setIsTransitioning(false);
      return;
    }

    translateX.value = withTiming(choice === 'pick' ? cardExitDistance : -cardExitDistance, { duration: 230 }, (finished) => {
      if (finished) runOnJS(finishTransition)();
    });
  };

  const swipe = (choice: EvaluationChoice) => {
    void choose(choice);
  };

  const pan = Gesture.Pan()
    .enabled(Boolean(current) && !isTransitioning && !isSavingEvaluation)
    .activeOffsetX([-10, 10])
    .failOffsetY([-18, 18])
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX > swipeThreshold) {
        runOnJS(swipe)('pick');
      } else if (event.translationX < -swipeThreshold) {
        runOnJS(swipe)('pass');
      } else {
        translateX.value = withTiming(0, { duration: 160 });
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${interpolate(translateX.value, [-260, 0, 260], [-7, 0, 7])}deg` },
    ],
  }));

  const selectForMvp = async (ideaId: string) => {
    if (isSelectingResult) return;
    if (!canSelectFinalIdea) {
      setSelectionError(selectionHint);
      return;
    }
    setSelectionError('');
    setIsSelectingResult(true);
    const saved = await saveSelectedIdea(ideaId);
    if (saved.error) {
      setSelectionError(saved.error);
      setIsSelectingResult(false);
      return;
    }
    await loadIdeas();
    setIsSelectingResult(false);
  };

  if (isLoadingIdeas || isLoadingEvaluations || !isAnalysisReady || isAnalyzingIdeas) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={orange} />
        <ThemedText type="smallBold" style={styles.navyText}>AI가 익명 평가용 분석을 준비하고 있어요</ThemedText>
        <ThemedText type="small" style={styles.mutedText}>후보별 장점, 리스크, 구현 난이도만 정리하며 비교·추천은 하지 않습니다.</ThemedText>
      </View>
    );
  }

  if (analyses.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <ThemedText type="subtitle" style={styles.navyText}>평가할 아이디어가 아직 없어요</ThemedText>
        <ThemedText type="small" style={styles.mutedText}>아이디어를 추출하거나 직접 추가한 뒤 공정한 블라인드 평가를 시작할 수 있습니다.</ThemedText>
        <View style={styles.emptyActions}>
          <Pressable onPress={onGoToExtraction} style={styles.outlineButton}><ThemedText type="smallBold" style={styles.orangeText}>아이디어 추출</ThemedText></Pressable>
          <Pressable onPress={onGoToList} style={styles.outlineButton}><ThemedText type="smallBold" style={styles.orangeText}>직접 추가</ThemedText></Pressable>
        </View>
      </View>
    );
  }

  if (isComplete && !isTransitioning) {
    return (
      <View style={styles.screen}>
        <View style={styles.completeBanner}>
          <ThemedText type="smallBold" style={styles.orangeText}>내 평가는 모두 잠겼습니다</ThemedText>
          <ThemedText type="small" style={styles.mutedText}>확정한 평가는 수정할 수 없어요.</ThemedText>
        </View>
        <ResultSummaryScreen
          data={resultData}
          selectedIdeaId={selectedIdeaId}
          canSelect={canSelectFinalIdea}
          selectionHint={selectionHint}
          isRanking={!activeRecommendation && !recommendationError}
          rankingError={!activeRecommendation ? recommendationError : ''}
          onRetryRanking={() => {
            recommendationRequestKey.current = '';
            void requestRecommendation(true);
          }}
          onSelectIdea={selectForMvp}
          onGoToMvp={onGoToMvp}
        />
        {selectionError ? <ThemedText type="small" style={styles.errorText}>{selectionError}</ThemedText> : null}
        {evaluationError ? <ThemedText type="small" style={styles.mutedText}>{evaluationError}</ThemedText> : null}
        {blindAnalysisError ? <ThemedText type="small" style={styles.mutedText}>{blindAnalysisError}</ThemedText> : null}
      </View>
    );
  }

  if (!current) return null;

  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <ThemedText type="subtitle" style={styles.navyText}>블라인드 스와이프 평가</ThemedText>
        <ThemedText type="small" style={styles.mutedText}>모든 아이디어를 평가하면 현재 결과를 볼 수 있어요.</ThemedText>
      </View>
      <View style={styles.progressRow}>
        <ThemedText type="smallBold" style={styles.navyText}>진행 현황</ThemedText>
        <ThemedText type="small" style={styles.mutedText}>{analyses.length - remaining.length + 1} / {analyses.length}</ThemedText>
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((analyses.length - remaining.length) / analyses.length) * 100}%` }]} /></View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.ideaCard, animatedCardStyle]}>
          <View style={styles.anonymousTag}><ThemedText type="captionStrong" style={styles.orangeDarkText}>{current.anonymousLabel}</ThemedText></View>
          <View style={styles.cardSection}>
            <ThemedText type="smallBold" style={styles.navyText}>해결하려는 문제</ThemedText>
            <ThemedText type="body" style={styles.navyText}>{current.problem}</ThemedText>
          </View>
          <View style={styles.cardSection}>
            <ThemedText type="smallBold" style={styles.navyText}>핵심 해결 방식</ThemedText>
            <ThemedText type="small" style={styles.navyText}>{current.solution}</ThemedText>
          </View>
          <View style={styles.cardSection}>
            <ThemedText type="smallBold" style={styles.navyText}>AI 장점</ThemedText>
            <ThemedText type="small" style={styles.navyText}>• {current.advantages[0]}</ThemedText>
            <ThemedText type="small" style={styles.navyText}>• {current.advantages[1]}</ThemedText>
          </View>
          <View style={styles.cardSection}>
            <ThemedText type="smallBold" style={styles.navyText}>AI 리스크</ThemedText>
            <ThemedText type="small" style={styles.navyText}>• {current.risk}</ThemedText>
          </View>
          <View style={styles.cardFooter}>
            <ThemedText type="small" style={styles.mutedText}>구현 난이도 · {current.difficulty}</ThemedText>
            <View style={styles.textActions}>
              <Pressable disabled={isTransitioning || isSavingEvaluation} onPress={() => void choose('pass')}><ThemedText type="smallBold" style={styles.passText}>PASS</ThemedText></Pressable>
              <Pressable disabled={isTransitioning || isSavingEvaluation} onPress={() => void choose('pick')}><ThemedText type="smallBold" style={styles.orangeText}>PICK</ThemedText></Pressable>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>

      <View style={styles.choiceRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Pass, 보류" disabled={isTransitioning || isSavingEvaluation} onPress={() => void choose('pass')} style={({ pressed }) => [styles.passCircle, (pressed || isTransitioning || isSavingEvaluation) && styles.pressed]}><ThemedText style={styles.passSymbol}>×</ThemedText></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Pick, 통과" disabled={isTransitioning || isSavingEvaluation} onPress={() => void choose('pick')} style={({ pressed }) => [styles.pickCircle, (pressed || isTransitioning || isSavingEvaluation) && styles.pressed]}><ThemedText style={styles.starSymbol}>★</ThemedText></Pressable>
      </View>
      <ThemedText type="small" style={styles.swipeHint}>좌/우 스와이프로 1분 만에 평가 완료!</ThemedText>
      {isSavingEvaluation ? <ActivityIndicator color={orange} /> : null}
      {selectionError ? <ThemedText type="small" style={styles.errorText}>{selectionError}</ThemedText> : null}
      {evaluationError ? <ThemedText type="small" style={styles.mutedText}>{evaluationError}</ThemedText> : null}
      {blindAnalysisError ? <ThemedText type="small" style={styles.mutedText}>{blindAnalysisError}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: Spacing.three, padding: Spacing.four, borderRadius: Radius.xlarge, backgroundColor: cream },
  heading: { gap: Spacing.one },
  navyText: { color: navy },
  mutedText: { color: muted },
  orangeText: { color: orange },
  orangeDarkText: { color: orangeDark },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.one },
  progressTrack: { height: 7, borderRadius: Radius.pill, overflow: 'hidden', backgroundColor: '#F3E6C8' },
  progressFill: { height: '100%', borderRadius: Radius.pill, backgroundColor: orange },
  ideaCard: { minHeight: 440, gap: Spacing.three, padding: Spacing.four, borderWidth: 2, borderColor: orange, borderRadius: Radius.xlarge, backgroundColor: '#FFFFFF', ...Shadows.card },
  anonymousTag: { alignSelf: 'flex-start', borderRadius: Radius.small, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF0BE' },
  cardSection: { gap: Spacing.one },
  cardFooter: { marginTop: 'auto', gap: Spacing.two },
  textActions: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.one },
  passText: { color: '#8A94A6' },
  choiceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.five },
  passCircle: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill, borderWidth: 2, borderColor: '#C9CFDA', backgroundColor: '#FFFFFF' },
  pickCircle: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill, backgroundColor: orange },
  passSymbol: { color: '#8A94A6', fontSize: 39, fontWeight: '300', lineHeight: 44 },
  starSymbol: { color: '#FFFFFF', fontSize: 31, lineHeight: 38 },
  swipeHint: { color: muted, textAlign: 'center' },
  loading: { minHeight: 360, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four },
  emptyCard: { gap: Spacing.three, padding: Spacing.four, borderWidth: 1, borderColor: orange, borderRadius: Radius.xlarge, backgroundColor: cream },
  emptyActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  outlineButton: { minHeight: ControlHeight.touch, justifyContent: 'center', borderWidth: 1, borderColor: orange, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, backgroundColor: '#FFFFFF' },
  completeBanner: { gap: Spacing.one, padding: Spacing.three, borderRadius: Radius.medium, borderWidth: 1, borderColor: '#F5D18D', backgroundColor: '#FFF2CD' },
  errorText: { color: '#C2410C' },
  pressed: { opacity: 0.65 },
});
