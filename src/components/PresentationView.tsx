import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CandidateIdea, PresentationData, ProjectConditions, SampleMvpPlan } from '@/types/presentation';
import { copyToClipboard, downloadAsFile } from '@/utils/fileExport';

type PresentationViewProps = {
  projectConditions: ProjectConditions;
  selectedIdea: CandidateIdea;
  sampleMvpPlan: SampleMvpPlan;
  initialData?: PresentationData | null;
  onSave?: (data: PresentationData) => Promise<unknown>;
};

function buildPresentationData(conditions: ProjectConditions, idea: CandidateIdea, mvp: SampleMvpPlan): PresentationData {
  const slideTopics = [
    { title: '문제 정의', points: [idea.problem, `핵심 대상: ${idea.targetUsers.join(', ')}`] },
    { title: '선정 아이디어와 해결 방법', points: [idea.summary, idea.solution] },
    { title: 'MVP 핵심 기능', points: mvp.essentialFeatures },
    { title: '화면 구조', points: mvp.screens },
    { title: '개발 일정과 역할', points: mvp.schedule },
    { title: '기술 구성과 확장 계획', points: [...mvp.requiredApis, ...mvp.laterFeatures] },
  ];

  return {
    presentationTitle: `${idea.title} - 최종 발표 자료`,
    slides: slideTopics.map((slide, index) => ({
      slideNumber: index + 1,
      title: `${index + 1}. ${slide.title}`,
      bulletPoints: slide.points,
      speakerScript: `${slide.title} 단계입니다. ${slide.points.join(' ')} 이 내용을 중심으로 프로젝트의 필요성과 실행 가능성을 설명하겠습니다.`,
    })),
    expectedQna: [
      {
        question: `${conditions.durationWeeks}주 안에 ${conditions.teamSize}명이 구현할 수 있나요?`,
        answer: `네. ${mvp.essentialFeatures.join(', ')}에 우선 집중하고, ${mvp.laterFeatures.join(', ')}은 검증 이후로 분리했습니다.`,
      },
      {
        question: '기존 서비스와의 차별점은 무엇인가요?',
        answer: `${idea.solution}이라는 한 흐름을 제공하고, ${idea.keywords.join(', ')}을 핵심 차별 키워드로 검증합니다.`,
      },
      {
        question: '가장 큰 위험 요소와 대응 방법은 무엇인가요?',
        answer: `초급~중급 팀의 구현 범위를 고려해 핵심 기능부터 사용자 테스트하고, 예산 ${conditions.budget.toLocaleString()}원 안에서 API 사용량을 제한합니다.`,
      },
    ],
    businessPlanDraft: `# ${idea.title} 사업계획서\n\n## 1. 사업 개요\n${idea.summary}\n\n## 2. 문제와 고객\n${idea.problem}\n\n대상 사용자: ${idea.targetUsers.join(', ')}\n\n## 3. 해결 방안\n${idea.solution}\n\n## 4. MVP\n${mvp.essentialFeatures.map((item) => `- ${item}`).join('\n')}\n\n## 5. 실행 조건\n- 기간: ${conditions.durationWeeks}주\n- 인원: ${conditions.teamSize}명\n- 예산: ${conditions.budget.toLocaleString()}원\n- 평가 기준: ${conditions.evaluationCriteria.join(', ')}`,
    finalReport: `# ${idea.title} 최종 결과 보고서\n\n## 프로젝트 목표\n${idea.summary}\n\n## 구현 범위\n${mvp.essentialFeatures.map((item) => `- ${item}`).join('\n')}\n\n## 개발 일정\n${mvp.schedule.map((item) => `- ${item}`).join('\n')}\n\n## 후속 계획\n${mvp.laterFeatures.map((item) => `- ${item}`).join('\n')}`,
  };
}

export function PresentationView({ projectConditions, selectedIdea, sampleMvpPlan, initialData, onSave }: PresentationViewProps) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<'slides' | 'qna' | 'report'>('slides');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [presentationData, setPresentationData] = useState<PresentationData | null>(initialData ?? null);
  const tabs = useMemo(() => [
    { key: 'slides' as const, label: '슬라이드 & 대본' },
    { key: 'qna' as const, label: '예상 Q&A' },
    { key: 'report' as const, label: '보고서 · 사업계획서' },
  ], []);

  const handleGeneratePresentation = async () => {
    setLoading(true);
    setError('');
    try {
      const data = buildPresentationData(projectConditions, selectedIdea, sampleMvpPlan);
      setPresentationData(data);
      const result = await onSave?.(data) as { error?: string } | undefined;
      if (result?.error) setError(result.error);
    } catch {
      setError('발표 자료를 생성하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle">C. AI 발표 자료 생성</ThemedText>
      <ThemedText themeColor="textSecondary">선정 아이디어와 저장된 MVP 결과를 발표·문서 형식으로 연결합니다.</ThemedText>
      <Pressable onPress={handleGeneratePresentation} disabled={loading} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.primary }, (pressed || loading) && styles.pressed]}>
        {loading ? <ActivityIndicator color="#fff" /> : <ThemedText type="smallBold" style={styles.primaryButtonText}>{presentationData ? '발표 자료 다시 생성' : '발표 자료 생성·저장'}</ThemedText>}
      </Pressable>
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      {presentationData ? (
        <View style={styles.contentWrapper}>
          <View style={styles.tabRow}>{tabs.map((tab) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab.key }} key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.tabButton, { borderColor: theme.border }, activeTab === tab.key && { backgroundColor: theme.primary, borderColor: theme.primary }]}><ThemedText type="smallBold" style={activeTab === tab.key ? styles.activeTabText : undefined}>{tab.label}</ThemedText></Pressable>)}</View>
          {activeTab === 'slides' ? <ScrollView style={styles.slideList} contentContainerStyle={styles.listGap}>{presentationData.slides.map((slide) => <ThemedView key={slide.slideNumber} type="backgroundElement" style={[styles.card, { borderColor: theme.border }, Shadows.card]}><ThemedText type="smallBold">{slide.title}</ThemedText>{slide.bulletPoints.map((point, index) => <ThemedText key={`${slide.slideNumber}-${index}`} type="small" themeColor="textSecondary">• {point}</ThemedText>)}<View style={[styles.scriptBox, { backgroundColor: theme.primarySoft, borderLeftColor: theme.primary }]}><ThemedText type="smallBold">발표 대본</ThemedText><ThemedText type="small">{slide.speakerScript}</ThemedText></View></ThemedView>)}</ScrollView> : null}
          {activeTab === 'qna' ? <View style={styles.listGap}>{presentationData.expectedQna.map((qna, index) => <ThemedView key={`${qna.question}-${index}`} type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}><ThemedText type="smallBold">Q. {qna.question}</ThemedText><ThemedText type="small" themeColor="textSecondary">A. {qna.answer}</ThemedText></ThemedView>)}</View> : null}
          {activeTab === 'report' ? <View style={styles.listGap}><ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}><ThemedText type="smallBold">사업계획서 초안</ThemedText><ThemedText type="small">{presentationData.businessPlanDraft}</ThemedText></ThemedView><ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}><ThemedText type="smallBold">최종 결과 보고서</ThemedText><ThemedText type="small">{presentationData.finalReport}</ThemedText></ThemedView></View> : null}
          <View style={styles.actionRow}>
            <Pressable onPress={() => copyToClipboard(JSON.stringify(presentationData, null, 2))} style={[styles.secondaryButton, { borderColor: theme.border }]}><ThemedText type="smallBold">전체 결과 복사</ThemedText></Pressable>
            <Pressable onPress={() => downloadAsFile(presentationData.businessPlanDraft, `${selectedIdea.title}_사업계획서.md`)} style={[styles.secondaryButton, { borderColor: theme.border }]}><ThemedText type="smallBold">사업계획서 다운로드</ThemedText></Pressable>
            <Pressable onPress={() => downloadAsFile(presentationData.finalReport, `${selectedIdea.title}_최종보고서.md`)} style={[styles.secondaryButton, { borderColor: theme.border }]}><ThemedText type="smallBold">최종 보고서 다운로드</ThemedText></Pressable>
          </View>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three }, contentWrapper: { gap: Spacing.three }, tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tabButton: { minHeight: ControlHeight.touch, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: Radius.pill, borderWidth: 1 }, activeTabText: { color: '#fff' },
  slideList: { maxHeight: 700 }, listGap: { gap: Spacing.three }, card: { gap: Spacing.three, borderWidth: 1, borderRadius: Radius.large, padding: Spacing.four }, scriptBox: { gap: Spacing.one, borderLeftWidth: 3, borderRadius: Radius.small, padding: Spacing.three },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }, primaryButton: { alignSelf: 'flex-start', minHeight: ControlHeight.input, justifyContent: 'center', paddingHorizontal: Spacing.four, borderRadius: Radius.medium }, secondaryButton: { minHeight: ControlHeight.touch, justifyContent: 'center', paddingHorizontal: Spacing.three, borderWidth: 1, borderRadius: Radius.medium }, primaryButtonText: { color: '#fff' }, error: { color: '#dc2626' }, pressed: { opacity: 0.6 },
});
