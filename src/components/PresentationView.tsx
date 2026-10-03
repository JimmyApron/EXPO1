import { ScaledTextInput as TextInput } from '@/components/scaled-text-input';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ExportPanel } from '@/components/export/ExportPanel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { usePresentationGeneration } from '@/hooks/use-presentation-generation';
import { useTheme } from '@/hooks/use-theme';
import { applyPresentationCandidate, changedPresentationSections, presentationSnapshot } from '@/lib/presentation-versions';
import type { ExportData } from '@/types/export';
import type { CandidateIdea, PresentationData, ProjectConditions, SampleMvpPlan } from '@/types/presentation';

type Props = {
  projectId: string;
  projectConditions: ProjectConditions;
  selectedIdea: CandidateIdea;
  sampleMvpPlan: SampleMvpPlan;
  exportDetails?: Pick<ExportData, 'aiAnalysis' | 'teamRoles' | 'presentationOrder'>;
  initialData?: PresentationData | null;
  hasPreviousPresentation?: boolean;
  onSave?: (data: PresentationData, expected?: PresentationData) => Promise<{ error?: string } | unknown>;
};

function dateLabel(value?: string) {
  const date = new Date(value ?? '');
  return Number.isNaN(date.getTime()) ? '기록 없음' : date.toLocaleString('ko-KR');
}

export function PresentationView({ projectId, projectConditions, selectedIdea, sampleMvpPlan, exportDetails, initialData, hasPreviousPresentation = false, onSave }: Props) {
  const theme = useTheme();
  const { canGenerate, generatePresentation } = usePresentationGeneration();
  const [saved, setSaved] = useState<PresentationData | null>(initialData ?? null);
  const [candidate, setCandidate] = useState<PresentationData | null>(null);
  const [instruction, setInstruction] = useState('');
  const [pendingInstruction, setPendingInstruction] = useState('');
  const [activeTab, setActiveTab] = useState<'slides' | 'qna' | 'report'>('slides');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = useRef(false);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => { setSaved(initialData ?? null); setCandidate(null); }, 0);
    return () => globalThis.clearTimeout(timeout);
  }, [initialData]);

  const generate = async () => {
    if (busy.current || !canGenerate || (saved && !instruction.trim())) return;
    busy.current = true; setLoading(true); setError(''); setNotice('');
    try {
      const requested = instruction.trim();
      const generated = await generatePresentation({
        projectId, projectConditions, selectedIdea, mvpPlan: sampleMvpPlan,
        ...(requested ? { instruction: requested } : {}),
        ...(saved ? { previousPresentation: presentationSnapshot(saved) } : {}),
      });
      if (saved) {
        setCandidate({ ...generated, createdAt: new Date().toISOString() }); setPendingInstruction(requested);
        setNotice('새 결과를 만들었습니다. 변경 내용을 확인한 뒤 적용해 주세요.');
      } else {
        const first: PresentationData = { ...presentationSnapshot(generated), ideaId: selectedIdea.id, createdAt: new Date().toISOString(), currentVersionId: `version-${Date.now()}`, versionHistory: [] };
        const result = await onSave?.(first) as { error?: string } | undefined;
        if (result?.error) throw new Error(result.error);
        setSaved(first); setNotice('발표자료를 저장했습니다.');
      }
      setInstruction('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '발표자료를 생성하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setLoading(false); busy.current = false; }
  };

  const apply = async (next: PresentationData) => {
    if (busy.current || !saved) return;
    busy.current = true; setSaving(true); setError('');
    try {
      const result = await onSave?.(next, saved) as { error?: string } | undefined;
      if (result?.error) throw new Error(result.error);
      setSaved(next); setCandidate(null); setNotice('선택한 버전을 저장했습니다.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '버전을 저장하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setSaving(false); busy.current = false; }
  };

  const restore = (versionId: string) => {
    if (!saved) return;
    const entry = saved.versionHistory?.find((item) => item.id === versionId);
    if (!entry?.snapshot) return;
    setCandidate({ ...entry.snapshot, ideaId: selectedIdea.id, createdAt: entry.createdAt });
    setPendingInstruction(`이전 버전 복원: ${dateLabel(entry.createdAt)}`);
    setNotice('이전 버전을 미리 보고 있습니다. 적용하기 전까지 저장된 자료는 유지됩니다.');
  };

  const shown = candidate ?? saved;
  const changes = saved && candidate ? changedPresentationSections(saved, candidate) : [];
  const exportData: ExportData = {
    projectTitle: saved?.presentationTitle || selectedIdea.title, idea: selectedIdea,
    mvpPlan: sampleMvpPlan, presentation: saved, aiAnalysis: exportDetails?.aiAnalysis,
    teamRoles: exportDetails?.teamRoles ?? [], presentationOrder: exportDetails?.presentationOrder ?? [],
  };

  return <ThemedView style={styles.container}>
    <ThemedText type="subtitle">발표자료</ThemedText>
    <ThemedText themeColor="textSecondary">선정 아이디어와 MVP 계획을 바탕으로 발표자료와 문서를 만듭니다.</ThemedText>
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}><ThemedText type="smallBold">기준 아이디어: {selectedIdea.title}</ThemedText><ThemedText type="small" themeColor="textSecondary">{selectedIdea.summary || '아이디어 설명이 없습니다.'}</ThemedText></ThemedView>
    {hasPreviousPresentation && !saved ? <ThemedText style={{ color: theme.warning }}>이전 아이디어의 발표자료가 보관되어 있습니다. 현재 아이디어의 새 자료를 생성해 주세요.</ThemedText> : null}
    {saved ? <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <ThemedText type="smallBold">전체 발표자료 재생성</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">요청을 입력하면 슬라이드, Q&A, 문서 전체를 다시 만듭니다. 새 결과를 적용하기 전까지 저장된 자료는 유지됩니다.</ThemedText>
      <View style={styles.row}>{['더 간결하게', '전문적으로', '근거를 자세히'].map((preset) => <Pressable key={preset} accessibilityRole="button" accessibilityLabel={`${preset} 요청 입력`} disabled={loading || saving} onPress={() => setInstruction(preset)} style={[styles.outlineButton, { borderColor: theme.border }]}><ThemedText type="smallBold">{preset}</ThemedText></Pressable>)}</View>
      <TextInput accessibilityLabel="발표자료 전체 재생성 요청" value={instruction} onChangeText={setInstruction} editable={!loading && !saving} multiline maxLength={1000} placeholder="예: 5분 발표에 맞게 간결하게 구성해 줘" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
    </ThemedView> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={saved ? '발표자료 전체 재생성 요청' : '발표자료 생성 및 저장'} accessibilityState={{ disabled: loading || saving || !canGenerate || Boolean(saved && !instruction.trim()) }} disabled={loading || saving || !canGenerate || Boolean(saved && !instruction.trim())} onPress={() => void generate()} style={[styles.primaryButton, { backgroundColor: theme.primary }, (loading || saving || !canGenerate || Boolean(saved && !instruction.trim())) && styles.disabled]}>
      {loading ? <ActivityIndicator color="#fff" /> : <ThemedText type="smallBold" style={styles.white}>{saved ? '요청 반영해 전체 재생성' : '발표자료 생성·저장'}</ThemedText>}
    </Pressable>
    {!canGenerate ? <ThemedText type="small" themeColor="textSecondary">로그인 후 발표자료를 생성할 수 있습니다.</ThemedText> : null}
    {error ? <ThemedText accessibilityRole="alert" style={{ color: theme.danger }}>{error}</ThemedText> : null}
    {notice ? <ThemedText accessibilityLiveRegion="polite" style={{ color: theme.success }}>{notice}</ThemedText> : null}
    {candidate && saved ? <ThemedView type="primarySoft" style={[styles.card, { borderColor: theme.primary }]}>
      <ThemedText type="smallBold">기존 버전 / 새 버전 비교</ThemedText>
      <ThemedText type="small">수정 요청: {pendingInstruction}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">기존 생성: {dateLabel(saved.createdAt)} · 새 결과 생성: {dateLabel(candidate.createdAt)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">기존: {saved.slides.length}개 슬라이드 · 새 버전: {candidate.slides.length}개 슬라이드</ThemedText>
      {changes.length ? changes.map((change) => <ThemedText key={change} type="small">• {change}</ThemedText>) : <ThemedText type="small">내용 변화가 감지되지 않았습니다.</ThemedText>}
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="새 버전 적용" disabled={saving} onPress={() => void apply(applyPresentationCandidate(saved, candidate, pendingInstruction))} style={[styles.primaryButton, { backgroundColor: theme.primary }]}>{saving ? <ActivityIndicator color="#fff" /> : <ThemedText type="smallBold" style={styles.white}>새 버전 적용</ThemedText>}</Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="이전 버전 유지" disabled={saving} onPress={() => { setCandidate(null); setNotice('이전 버전을 유지했습니다.'); }} style={[styles.outlineButton, { borderColor: theme.border }]}><ThemedText type="smallBold">이전 버전 유지</ThemedText></Pressable>
      </View>
    </ThemedView> : null}
    {saved?.versionHistory?.some((entry) => entry.snapshot) ? <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <ThemedText type="smallBold">보관된 버전</ThemedText>
      {saved.versionHistory.filter((entry) => entry.snapshot).map((entry) => <View key={entry.id} style={styles.row}><ThemedText type="small" style={styles.flex}>{dateLabel(entry.createdAt)} · {entry.summary}</ThemedText><Pressable accessibilityRole="button" accessibilityLabel={`${dateLabel(entry.createdAt)} 버전 미리보기`} onPress={() => restore(entry.id)} style={[styles.outlineButton, { borderColor: theme.border }]}><ThemedText type="smallBold">미리보기</ThemedText></Pressable></View>)}
    </ThemedView> : null}
    {shown ? <View style={styles.container}>
      <ThemedText type="smallBold">{candidate ? '새 버전 미리보기' : '현재 저장된 버전'}: {shown.presentationTitle}</ThemedText>
      <View style={styles.row}>{([{ key: 'slides', label: '슬라이드·대본' }, { key: 'qna', label: '예상 Q&A' }, { key: 'report', label: '보고서·사업계획서' }] as const).map((tab) => <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab.key }} onPress={() => setActiveTab(tab.key)} style={[styles.outlineButton, { borderColor: theme.border, backgroundColor: activeTab === tab.key ? theme.primarySoft : 'transparent' }]}><ThemedText type="smallBold">{tab.label}</ThemedText></Pressable>)}</View>
      {activeTab === 'slides' ? shown.slides.map((slide) => <ThemedView key={slide.slideNumber} type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}><ThemedText type="smallBold">{slide.slideNumber}. {slide.title}</ThemedText>{slide.bulletPoints.map((point, index) => <ThemedText key={index} type="small">• {point}</ThemedText>)}<ThemedText type="smallBold">발표 대본</ThemedText><ThemedText type="small">{slide.speakerScript}</ThemedText></ThemedView>) : null}
      {activeTab === 'qna' ? shown.expectedQna.map((item, index) => <ThemedView key={index} type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}><ThemedText type="smallBold">Q. {item.question}</ThemedText><ThemedText type="small">A. {item.answer}</ThemedText></ThemedView>) : null}
      {activeTab === 'report' ? <><ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}><ThemedText type="smallBold">사업계획서 초안</ThemedText><ThemedText type="small">{shown.businessPlanDraft}</ThemedText></ThemedView><ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}><ThemedText type="smallBold">최종 결과 보고서</ThemedText><ThemedText type="small">{shown.finalReport}</ThemedText></ThemedView></> : null}
    </View> : null}
    {saved ? <ExportPanel data={exportData} /> : null}
  </ThemedView>;
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  card: { gap: Spacing.two, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1, minWidth: 160 },
  outlineButton: { minHeight: ControlHeight.touch, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  primaryButton: { alignSelf: 'flex-start', minHeight: ControlHeight.touch, justifyContent: 'center', borderRadius: Radius.medium, paddingHorizontal: Spacing.four },
  input: { minHeight: 88, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.two, textAlignVertical: 'top' },
  white: { color: '#fff' }, disabled: { opacity: 0.55 },
});
