import { useMemo, useRef, useState } from 'react';
import { applyPresentationRewrite, documentBlocks, type PresentationRewriteTarget } from '../../supabase/functions/_shared/presentation-rewrite';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PresentationRewriteControls } from '@/components/presentation-rewrite-controls';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { presentationRewriteErrorMessage, usePresentationGeneration } from '@/hooks/use-presentation-generation';
import { useTheme } from '@/hooks/use-theme';
import type { CandidateIdea, PresentationData, ProjectConditions, SampleMvpPlan } from '@/types/presentation';
import { ExportPanel } from '@/components/export/ExportPanel';
import type { ExportData } from '@/types/export';

type PresentationViewProps = {
  projectId: string;
  projectConditions: ProjectConditions;
  selectedIdea: CandidateIdea;
  sampleMvpPlan: SampleMvpPlan;
  exportDetails?: Pick<ExportData, 'aiAnalysis' | 'teamRoles' | 'presentationOrder'>;
  initialData?: PresentationData | null;
  hasPreviousPresentation?: boolean;
  onSave?: (data: PresentationData, expected?: PresentationData) => Promise<unknown>;
};

function rewriteTargetKey(target: PresentationRewriteTarget) {
  return target.kind === 'slide' ? `slide:${target.index}` : `${target.field}:${target.start}`;
}

export function PresentationView({
  projectId,
  projectConditions,
  selectedIdea,
  sampleMvpPlan,
  initialData,
  hasPreviousPresentation = false,
  exportDetails,
  onSave,
}: PresentationViewProps) {
  const theme = useTheme();
  const { canGenerate, generatePresentation, rewritePresentation } = usePresentationGeneration();
  const [activeTab, setActiveTab] = useState<'slides' | 'qna' | 'report'>('slides');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [presentationData, setPresentationData] = useState<PresentationData | null>(initialData ?? null);
  const operationRef = useRef(false);
  const [rewriting, setRewriting] = useState<string | null>(null);
  const [rewriteStatus, setRewriteStatus] = useState<{ key: string; message: string } | null>(null);

  const handleRewrite = async (target: PresentationRewriteTarget, instruction: string) => {
    if (!presentationData || operationRef.current || !canGenerate) return;
    const key = rewriteTargetKey(target);
    const previous = presentationData;
    operationRef.current = true;
    setRewriting(key);
    setRewriteStatus(null);
    try {
      const content = await rewritePresentation({ projectId, projectConditions, selectedIdea, mvpPlan: sampleMvpPlan }, previous, target, instruction);
      const next = { ...applyPresentationRewrite(previous, target, content), ideaId: selectedIdea.id };
      const result = await onSave?.(next, previous) as { error?: string } | undefined;
      if (result?.error) throw new Error(result.error);
      setPresentationData(next);
      setRewriteStatus({ key, message: onSave ? '이 부분을 재작성하고 저장했습니다.' : '이 부분을 화면에 반영했습니다.' });
    } catch (caught) {
      const message = presentationRewriteErrorMessage(caught);
      setRewriteStatus({
        key,
        message: message.includes('기존 내용은 유지됩니다.') ? message : `${message} 기존 내용은 유지됩니다.`,
      });
    } finally {
      operationRef.current = false;
      setRewriting(null);
    }
  };

  const rewriteControls = (target: PresentationRewriteTarget) => {
    const key = rewriteTargetKey(target);
    return <PresentationRewriteControls disabled={loading || rewriting !== null || !canGenerate} loading={rewriting === key}
      message={rewriteStatus?.key === key ? rewriteStatus.message : ''} onRewrite={(instruction) => void handleRewrite(target, instruction)} />;
  };
  const tabs = useMemo(
    () => [
      { key: 'slides' as const, label: '슬라이드 & 대본' },
      { key: 'qna' as const, label: '예상 Q&A' },
      { key: 'report' as const, label: '보고서 · 사업계획서' },
    ],
    [],
  );

  const handleGeneratePresentation = async () => {
    if (operationRef.current || !canGenerate) {
      return;
    }

    operationRef.current = true;
    setLoading(true);
    setRewriteStatus(null);
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
      operationRef.current = false;
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
      {hasPreviousPresentation && !presentationData ? (
        <ThemedView
          type="warningSoft"
          style={[styles.previousPresentationNotice, { borderColor: theme.warning }]}>
          <ThemedText type="smallBold" style={{ color: theme.warning }}>
            저장된 발표자료는 이전 아이디어 기준이에요.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            현재 선정 아이디어와 MVP를 기준으로 새 발표자료를 만들 수 있습니다. 새 자료를 저장하면 기존 발표자료가 교체됩니다.
          </ThemedText>
        </ThemedView>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          presentationData
            ? '발표자료 다시 생성'
            : hasPreviousPresentation
              ? '현재 아이디어로 새 발표자료 만들기'
              : '발표자료 생성 및 저장'
        }
        accessibilityState={{ disabled: loading || rewriting !== null || !canGenerate }}
        onPress={handleGeneratePresentation}
        disabled={loading || rewriting !== null || !canGenerate}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: theme.primary },
          (pressed || loading || !canGenerate) && styles.pressed,
        ]}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            {presentationData
              ? '발표자료 다시 생성'
              : hasPreviousPresentation
                ? '현재 아이디어로 새 발표자료 만들기'
                : '발표자료 생성·저장'}
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
              {presentationData.slides.map((slide, slideIndex) => (
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
                  {rewriteControls({ kind: 'slide', index: slideIndex })}
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
              {(['businessPlanDraft', 'finalReport'] as const).map((field) => (
                <View key={field} style={styles.listGap}>
                  <ThemedText type="smallBold">{field === 'businessPlanDraft' ? '사업계획서 초안' : '최종 결과 보고서'}</ThemedText>
                  {documentBlocks(presentationData[field]).map(({ start, end }, index) => (
                    <ThemedView key={`${field}:${index}`} type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
                      <ThemedText type="small">{presentationData[field].slice(start, end)}</ThemedText>
                      {rewriteControls({ kind: 'document', field, start, end })}
                    </ThemedView>
                  ))}
                </View>
              ))}
            </View>
          ) : null}


        </View>
      ) : null}
      <ExportPanel data={{
        projectTitle: presentationData?.presentationTitle || selectedIdea.title,
        idea: selectedIdea,
        mvpPlan: sampleMvpPlan,
        presentation: presentationData,
        aiAnalysis: exportDetails?.aiAnalysis,
        teamRoles: exportDetails?.teamRoles ?? [],
        presentationOrder: exportDetails?.presentationOrder ?? [],
      }} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  basisCard: { gap: Spacing.one, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  previousPresentationNotice: { gap: Spacing.one, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
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
