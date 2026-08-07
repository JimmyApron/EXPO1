import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { usePresentationGeneration } from '@/hooks/use-presentation-generation';
import { useTheme } from '@/hooks/use-theme';
import type { CandidateIdea, PresentationData, ProjectConditions, SampleMvpPlan } from '@/types/presentation';
import { copyToClipboard, downloadAsDocx } from '@/utils/fileExport';

type PresentationViewProps = {
  projectId: string;
  projectConditions: ProjectConditions;
  selectedIdea: CandidateIdea;
  sampleMvpPlan: SampleMvpPlan;
  initialData?: PresentationData | null;
  onSave?: (data: PresentationData) => Promise<unknown>;
};

export function PresentationView({
  projectId,
  projectConditions,
  selectedIdea,
  sampleMvpPlan,
  initialData,
  onSave,
}: PresentationViewProps) {
  const theme = useTheme();
  const { canGenerate, generatePresentation } = usePresentationGeneration();
  const [activeTab, setActiveTab] = useState<'slides' | 'qna' | 'report'>('slides');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [presentationData, setPresentationData] = useState<PresentationData | null>(initialData ?? null);
  const tabs = useMemo(
    () => [
      { key: 'slides' as const, label: '슬라이드 & 대본' },
      { key: 'qna' as const, label: '예상 Q&A' },
      { key: 'report' as const, label: '보고서 · 사업계획서' },
    ],
    [],
  );

  const handleGeneratePresentation = async () => {
    if (loading || !canGenerate) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const generatedData = await generatePresentation({
        projectId,
        projectConditions,
        selectedIdea,
        mvpPlan: sampleMvpPlan,
      });
      const data: PresentationData = { ...generatedData, ideaId: selectedIdea.id };
      setPresentationData(data);

      const result = (await onSave?.(data)) as { error?: string } | undefined;
      if (result?.error) {
        setError(result.error);
      }
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : '발표 자료를 생성하지 못했습니다. 다시 시도해주세요.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle">발표자료</ThemedText>
      <ThemedText themeColor="textSecondary">
        선정 아이디어와 저장된 MVP 결과를 AI가 발표·문서 형식으로 구성합니다.
      </ThemedText>
      <ThemedView type="backgroundElement" style={[styles.basisCard, { borderColor: theme.success, backgroundColor: theme.successSoft }]}>
        <ThemedText type="smallBold" style={{ color: theme.success }}>기준 아이디어</ThemedText>
        <ThemedText type="smallBold">{selectedIdea.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{selectedIdea.summary}</ThemedText>
      </ThemedView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={presentationData ? '발표자료 다시 생성' : '발표자료 생성 및 저장'}
        accessibilityState={{ disabled: loading || !canGenerate }}
        onPress={handleGeneratePresentation}
        disabled={loading || !canGenerate}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: theme.primary },
          (pressed || loading || !canGenerate) && styles.pressed,
        ]}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            {presentationData ? '발표자료 다시 생성' : '발표자료 생성·저장'}
          </ThemedText>
        )}
      </Pressable>
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      {presentationData ? (
        <View style={styles.contentWrapper}>
          <View style={styles.tabRow}>
            {tabs.map((tab) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === tab.key }}
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tabButton,
                  { borderColor: theme.border },
                  activeTab === tab.key && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}>
                <ThemedText type="smallBold" style={activeTab === tab.key ? styles.activeTabText : undefined}>
                  {tab.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {activeTab === 'slides' ? (
            <View style={styles.listGap}>
              {presentationData.slides.map((slide) => (
                <ThemedView
                  key={slide.slideNumber}
                  type="backgroundElement"
                  style={[styles.card, { borderColor: theme.border }, Shadows.card]}>
                  <ThemedText type="smallBold">{slide.title}</ThemedText>
                  {slide.bulletPoints.map((point, index) => (
                    <ThemedText
                      key={`${slide.slideNumber}-${index}`}
                      type="small"
                      themeColor="textSecondary">
                      • {point}
                    </ThemedText>
                  ))}
                  <View style={[styles.scriptBox, { backgroundColor: theme.primarySoft, borderLeftColor: theme.primary }]}>
                    <ThemedText type="smallBold">발표 대본</ThemedText>
                    <ThemedText type="small">{slide.speakerScript}</ThemedText>
                  </View>
                </ThemedView>
              ))}
            </View>
          ) : null}

          {activeTab === 'qna' ? (
            <View style={styles.listGap}>
              {presentationData.expectedQna.map((qna, index) => (
                <ThemedView
                  key={`${qna.question}-${index}`}
                  type="backgroundElement"
                  style={[styles.card, { borderColor: theme.border }]}>
                  <ThemedText type="smallBold">Q. {qna.question}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">A. {qna.answer}</ThemedText>
                </ThemedView>
              ))}
            </View>
          ) : null}

          {activeTab === 'report' ? (
            <View style={styles.listGap}>
              <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
                <ThemedText type="smallBold">사업계획서 초안</ThemedText>
                <ThemedText type="small">{presentationData.businessPlanDraft}</ThemedText>
              </ThemedView>
              <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
                <ThemedText type="smallBold">최종 결과 보고서</ThemedText>
                <ThemedText type="small">{presentationData.finalReport}</ThemedText>
              </ThemedView>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => copyToClipboard(JSON.stringify(presentationData, null, 2))}
              style={[styles.secondaryButton, { borderColor: theme.border }]}>
              <ThemedText type="smallBold">전체 결과 복사</ThemedText>
            </Pressable>
            <Pressable
              onPress={() =>
                void downloadAsDocx(
                  presentationData.businessPlanDraft,
                  `${selectedIdea.title}_사업계획서.docx`,
                  { documentType: '사업계획서', projectTitle: selectedIdea.title },
                )
              }
              style={[styles.secondaryButton, { borderColor: theme.border }]}>
              <ThemedText type="smallBold">사업계획서 다운로드</ThemedText>
            </Pressable>
            <Pressable
              onPress={() =>
                void downloadAsDocx(
                  presentationData.finalReport,
                  `${selectedIdea.title}_최종보고서.docx`,
                  { documentType: '최종 결과 보고서', projectTitle: selectedIdea.title },
                )
              }
              style={[styles.secondaryButton, { borderColor: theme.border }]}>
              <ThemedText type="smallBold">최종 보고서 다운로드</ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  basisCard: { gap: Spacing.one, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  contentWrapper: { gap: Spacing.three },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tabButton: {
    minHeight: ControlHeight.touch,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  activeTabText: { color: '#fff' },
  listGap: { gap: Spacing.three },
  card: { gap: Spacing.three, borderWidth: 1, borderRadius: Radius.large, padding: Spacing.four },
  scriptBox: {
    gap: Spacing.one,
    borderLeftWidth: 3,
    borderRadius: Radius.small,
    padding: Spacing.three,
  },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  primaryButton: {
    alignSelf: 'flex-start',
    minHeight: ControlHeight.input,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.medium,
  },
  secondaryButton: {
    minHeight: ControlHeight.touch,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
  },
  primaryButtonText: { color: '#fff' },
  error: { color: '#dc2626' },
  pressed: { opacity: 0.6 },
});
