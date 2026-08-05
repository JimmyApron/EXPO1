import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type {
    CandidateIdea,
    PresentationData,
    ProjectConditions,
    SampleMvpPlan,
} from '@/types/presentation';
import { copyToClipboard, downloadAsFile } from '@/utils/fileExport';

type PresentationViewProps = {
  projectConditions: ProjectConditions;
  selectedIdea: CandidateIdea;
  sampleMvpPlan: SampleMvpPlan;
};

export function PresentationView({
  projectConditions,
  selectedIdea,
  sampleMvpPlan,
}: PresentationViewProps) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<'slides' | 'qna' | 'report'>('slides');
  const [loading, setLoading] = useState(false);
  const [presentationData, setPresentationData] = useState<PresentationData | null>(null);

  const tabButtons = useMemo(
    () => [
      { key: 'slides' as const, label: '슬라이드 & 대본' },
      { key: 'qna' as const, label: '예상 Q&A' },
      { key: 'report' as const, label: '보고서/사업계획서' },
    ],
    [],
  );

  const handleGeneratePresentation = async () => {
    setLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setPresentationData({
        presentationTitle: `${selectedIdea.title} - 최종 발표 자료`,
        slides: [
          {
            slideNumber: 1,
            title: '1. 문제 정의 및 개발 배경',
            bulletPoints: [selectedIdea.problem, '기존 도구의 한계 및 정리 귀찮음 해소'],
            speakerScript:
              '안녕하세요. 저희 프로젝트는 회의 후 아이디어가 실행으로 이어지지 않는 문제를 해결하기 위해 기획되었습니다.',
          },
          {
            slideNumber: 2,
            title: '2. 핵심 솔루션 및 MVP 기능',
            bulletPoints: sampleMvpPlan.essentialFeatures,
            speakerScript:
              '핵심 솔루션으로 AI 텍스트 자동 추출 및 마인드맵 생성을 제공합니다.',
          },
        ],
        expectedQna: [
          {
            question: '6주 동안 초급~중급 4명 인원으로 개발이 가능한가요?',
            answer: `네, 필수 기능(${sampleMvpPlan.essentialFeatures.join(', ')})에 집중하여 1~4주 차에 핵심 기능을 완성하도록 일정을 수립했습니다.`,
          },
        ],
        businessPlanDraft: `# ${selectedIdea.title} 사업계획서\n\n## 1. 개요\n${selectedIdea.summary}`,
        finalReport: `# ${selectedIdea.title} 최종 결과 보고서\n\n- 팀원 수: ${projectConditions.teamSize}명\n- 기간: ${projectConditions.durationWeeks}주`,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
      <ThemedText type="subtitle">📊 C: AI 발표 자료 생성</ThemedText>

      {!presentationData ? (
        <Pressable
          onPress={handleGeneratePresentation}
          disabled={loading}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}> 
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            {loading ? 'AI가 발표 자료를 생성 중입니다...' : 'idea-001 기반 발표 자료 자동 생성'}
          </ThemedText>
        </Pressable>
      ) : (
        <View style={styles.contentWrapper}>
          <View style={styles.tabRow}>
            {tabButtons.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={({ pressed }) => [
                  styles.tabButton,
                  activeTab === tab.key && styles.activeTabButton,
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={activeTab === tab.key && styles.activeTabText}>
                  {tab.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {activeTab === 'slides' && (
            <ScrollView style={styles.slideList} contentContainerStyle={styles.slideListContent}>
              {presentationData.slides.map((slide) => (
                <ThemedView key={slide.slideNumber} type="backgroundElement" style={styles.slideCard}>
                  <ThemedText type="smallBold">{slide.title}</ThemedText>
                  <View style={styles.listWrapper}>
                    {slide.bulletPoints.map((point, index) => (
                      <ThemedText key={`${slide.slideNumber}-${index}`} type="small" themeColor="textSecondary">
                        • {point}
                      </ThemedText>
                    ))}
                  </View>
                  <ThemedView type="backgroundElement" style={styles.scriptBox}>
                    <ThemedText type="smallBold">🎙️ 발표 대본</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {slide.speakerScript}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              ))}
            </ScrollView>
          )}

          {activeTab === 'qna' && (
            <View style={styles.qnaList}>
              {presentationData.expectedQna.map((qna, idx) => (
                <ThemedView key={`${qna.question}-${idx}`} type="backgroundElement" style={styles.qnaCard}>
                  <ThemedText type="smallBold" style={styles.qnaQuestion}>
                    Q. {qna.question}
                  </ThemedText>
                  <ThemedText type="small" style={styles.qnaAnswer}>
                    A. {qna.answer}
                  </ThemedText>
                </ThemedView>
              ))}
            </View>
          )}

          {activeTab === 'report' && (
            <ThemedView type="backgroundElement" style={styles.reportBox}>
              <ThemedText type="small">{presentationData.businessPlanDraft}</ThemedText>
            </ThemedView>
          )}

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => copyToClipboard(JSON.stringify(presentationData, null, 2))}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold">전체 내용 복사</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => downloadAsFile(presentationData.businessPlanDraft, `${selectedIdea.title}_사업계획서.md`)}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold">사업계획서(.md) 다운로드</ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  contentWrapper: {
    gap: Spacing.two,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tabButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d0d7de',
  },
  activeTabButton: {
    backgroundColor: '#2868d8',
    borderColor: '#2868d8',
  },
  activeTabText: {
    color: '#ffffff',
  },
  slideList: {
    maxHeight: 420,
  },
  slideListContent: {
    gap: Spacing.two,
  },
  slideCard: {
    gap: Spacing.one,
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  listWrapper: {
    gap: 4,
  },
  scriptBox: {
    borderRadius: Spacing.one,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  qnaList: {
    gap: Spacing.two,
  },
  qnaCard: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  qnaQuestion: {
    color: '#d9534f',
  },
  qnaAnswer: {
    color: '#5cb85c',
  },
  reportBox: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  primaryButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: '#2868d8',
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.8,
  },
});
