import { ScaledTextInput as TextInput } from '@/components/scaled-text-input';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { ExportPanel } from '@/components/export/ExportPanel';
import { PresentationSettingsForm } from '@/components/PresentationSettingsForm';
import PresentationHtmlPreview from '@/components/PresentationHtmlPreview';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { usePresentationGeneration } from '@/hooks/use-presentation-generation';
import { useTheme } from '@/hooks/use-theme';
import { applyPresentationCandidate, changedPresentationSections, presentationSnapshot } from '@/lib/presentation-versions';
import { canApplyPresentationTheme } from '@/lib/presentation-entitlement';
import { isPremiumPresentationTheme } from '@/lib/presentation-themes';
import { createPresentationHtml } from '@/utils/export/presentationHtml';
import type { ExportData } from '@/types/export';
import type { CandidateIdea, PresentationData, PresentationSettings, ProjectConditions, SampleMvpPlan } from '@/types/presentation';

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

const defaultSettings = (idea: CandidateIdea): PresentationSettings => ({ title: `${idea.title} 발표자료`, pageCount: 7, theme: 'minimal-light' });
const settingsFor = (data: PresentationData | null | undefined, idea: CandidateIdea): PresentationSettings => data?.settings ?? (data ? { title: data.presentationTitle, pageCount: data.slides.length, theme: 'minimal-light' } : defaultSettings(idea));

export function PresentationView({ projectId, projectConditions, selectedIdea, sampleMvpPlan, exportDetails, initialData, hasPreviousPresentation = false, onSave }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const { canGenerate, generatePresentation } = usePresentationGeneration();
  const [saved, setSaved] = useState<PresentationData | null>(initialData ?? null);
  const [candidate, setCandidate] = useState<PresentationData | null>(null);
  const [settings, setSettings] = useState<PresentationSettings>(settingsFor(initialData, selectedIdea));
  const [settingsOpen, setSettingsOpen] = useState(!initialData);
  const [pendingInstruction, setPendingInstruction] = useState('');
  const [activeTab, setActiveTab] = useState<'slides' | 'qna' | 'report'>('slides');
  const [showHistory, setShowHistory] = useState(false);
  const [showThemePreview, setShowThemePreview] = useState(false);
  const [premiumDenied, setPremiumDenied] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<PresentationData | null>(null);
  const busy = useRef(false);

  const checkPremium = async () => {
    setPremiumDenied(false);
    if (!isPremiumPresentationTheme(settings.theme)) return true;
    if (await canApplyPresentationTheme(projectId, settings.theme)) return true;
    setPremiumDenied(true);
    setError('프리미엄 테마를 새로 적용하려면 활성 구독 또는 무료체험이 필요합니다. Watt 이용권을 확인해 주세요.');
    return false;
  };

  const checkGenerationTheme = async () => {
    if (!(await checkPremium())) return false;
    const existingTheme = saved?.settings?.theme;
    if (existingTheme && isPremiumPresentationTheme(existingTheme)
      && !(await canApplyPresentationTheme(projectId, existingTheme))) {
      setError('기존 프리미엄 발표자료의 디자인을 기본 테마로 변경한 뒤 AI 생성해 주세요.');
      return false;
    }
    return true;
  };

  const applyThemeOnly = async () => {
    if (busy.current || !saved) return;
    if (saved.settings?.theme === settings.theme) { setNotice('현재 디자인이 이미 적용되어 있습니다.'); return; }
    busy.current = true; setSaving(true); setError(''); setNotice('');
    try {
      if (!(await checkPremium())) return;
      const next = applyPresentationCandidate(saved, {
        ...saved, settings: { ...settingsFor(saved, selectedIdea), theme: settings.theme },
      }, '디자인만 변경');
      const result = await onSave?.(next, saved) as { error?: string } | undefined;
      if (result?.error) throw new Error(result.error);
      setSaved(next); setSettingsOpen(false); setShowThemePreview(false);
      setNotice('슬라이드 내용과 페이지 수를 유지하고 디자인만 변경했습니다. AI 사용량은 차감되지 않습니다.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '디자인을 저장하지 못했습니다.'); }
    finally { setSaving(false); busy.current = false; }
  };

  const confirmGeneration = async () => {
    setError('');
    try { if (await checkGenerationTheme()) setConfirmationOpen(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '구독 권한을 확인하지 못했습니다.'); }
  };

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => { setSaved(initialData ?? null); setCandidate(null); setSettings(settingsFor(initialData, selectedIdea)); setSettingsOpen(!initialData); }, 0);
    return () => globalThis.clearTimeout(timeout);
  }, [initialData, selectedIdea]);

  const generate = async () => {
    if (busy.current || !canGenerate || !settings.title.trim()) return;
    busy.current = true; setLoading(true); setError(''); setNotice('');
    try {
      if (!(await checkGenerationTheme())) return;
      const requested = [settings.purpose ? `발표 목적: ${settings.purpose}` : '', settings.additionalRequests ?? ''].filter(Boolean).join('\n');
      const generated = await generatePresentation({
        projectId, projectConditions, selectedIdea, mvpPlan: sampleMvpPlan,
        settings,
        ...(requested ? { instruction: requested } : {}),
        ...(saved ? { previousPresentation: presentationSnapshot(saved) } : {}),
      });
      const generatedData: PresentationData = { ...presentationSnapshot(generated), presentationTitle: settings.title.trim(), settings, ideaId: selectedIdea.id, createdAt: new Date().toISOString() };
      const next = saved ? applyPresentationCandidate(saved, generatedData, requested || '전체 재생성') : { ...generatedData, currentVersionId: `version-${Date.now()}`, versionHistory: [] };
      const result = await onSave?.(next, saved ?? undefined) as { error?: string } | undefined;
      if (result?.error) throw new Error(result.error);
      setSaved(next); setCandidate(null); setSettingsOpen(false);
      setNotice(saved ? '새 버전을 저장했습니다. 이전 버전은 복원할 수 있습니다.' : '발표자료를 저장했습니다.');
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

  const saveEdits = async () => {
    if (busy.current || !saved || !edited) return;
    busy.current = true; setSaving(true); setError('');
    try {
      const result = await onSave?.(edited, saved) as { error?: string } | undefined;
      if (result?.error) throw new Error(result.error);
      setSaved(edited); setEdited(null); setEditing(false); setNotice('편집한 발표자료를 저장했습니다.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '편집 내용을 저장하지 못했습니다.'); }
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
    {saved && !settingsOpen ? <Pressable accessibilityRole="button" onPress={() => { setSettings(settingsFor(saved, selectedIdea)); setSettingsOpen(true); setCandidate(null); }} style={[styles.primaryButton, { backgroundColor: theme.primary }]}><ThemedText type="smallBold" style={{ color: theme.primaryText }}>AI 발표자료 전체 재생성</ThemedText></Pressable> : null}
    {settingsOpen ? <PresentationSettingsForm value={settings} onChange={setSettings} regenerating={Boolean(saved)} busy={loading || saving} onSubmit={() => void confirmGeneration()} onApplyTheme={saved ? () => void applyThemeOnly() : undefined} onCancel={saved ? () => { setSettingsOpen(false); setSettings(settingsFor(saved, selectedIdea)); } : undefined} /> : null}
    {settingsOpen && saved ? <><Pressable accessibilityRole="button" onPress={() => setShowThemePreview(v => !v)} style={[styles.outlineButton, { borderColor: theme.border }]}><ThemedText type="smallBold">{showThemePreview ? '선택한 테마 미리보기 닫기' : '기존 슬라이드로 선택한 테마 미리보기'}</ThemedText></Pressable>{showThemePreview ? <PresentationHtmlPreview html={createPresentationHtml({ ...saved, settings: { ...settingsFor(saved, selectedIdea), theme: settings.theme } })} /> : null}</> : null}
    {premiumDenied ? <Pressable accessibilityRole="link" onPress={() => router.push('/watt')} style={[styles.outlineButton, { borderColor: theme.primary }]}><ThemedText type="smallBold" style={{ color: theme.primary }}>Watt 이용권 페이지로 이동</ThemedText></Pressable> : null}
    {loading ? <View style={styles.row}><ActivityIndicator color={theme.primary} /><ThemedText type="small">새 발표자료를 만들고 저장하는 중입니다. 기존 자료는 그대로 보존됩니다.</ThemedText></View> : null}
    {!canGenerate ? <ThemedText type="small" themeColor="textSecondary">로그인 후 발표자료를 생성할 수 있습니다.</ThemedText> : null}
    {error ? <ThemedText accessibilityRole="alert" style={{ color: theme.danger }}>{error}</ThemedText> : null}
    {notice ? <ThemedText accessibilityLiveRegion="polite" style={{ color: theme.success }}>{notice}</ThemedText> : null}
    {candidate && saved ? <ThemedView type="primarySoft" style={[styles.card, { borderColor: theme.primary }]}>
      <ThemedText type="smallBold">이전 버전 미리보기</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">현재 버전과 비교된 변경 항목: {changes.length}</ThemedText>
      {changes.length ? changes.map((change) => <ThemedText key={change} type="small">• {change}</ThemedText>) : <ThemedText type="small">내용 변화가 감지되지 않았습니다.</ThemedText>}
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="이전 버전 복원" disabled={saving} onPress={() => void apply(applyPresentationCandidate(saved, candidate, pendingInstruction))} style={[styles.primaryButton, { backgroundColor: theme.primary }]}>{saving ? <ActivityIndicator color={theme.primaryText} /> : <ThemedText type="smallBold" style={{ color: theme.primaryText }}>이전 버전 복원</ThemedText>}</Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="미리보기 닫기" disabled={saving} onPress={() => { setCandidate(null); setNotice('현재 버전을 유지했습니다.'); }} style={[styles.outlineButton, { borderColor: theme.border }]}><ThemedText type="smallBold">닫기</ThemedText></Pressable>
      </View>
    </ThemedView> : null}
    {saved?.versionHistory?.some((entry) => entry.snapshot) ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showHistory }} onPress={() => setShowHistory((open) => !open)} style={[styles.outlineButton, { borderColor: theme.border }]}><ThemedText type="smallBold">{showHistory ? '이전 버전 접기' : `이전 버전 보기 (${saved.versionHistory.filter((entry) => entry.snapshot).length})`}</ThemedText></Pressable> : null}
    {saved && showHistory && saved.versionHistory?.some((entry) => entry.snapshot) ? <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <ThemedText type="smallBold">보관된 버전</ThemedText>
      {saved.versionHistory.filter((entry) => entry.snapshot).map((entry) => <View key={entry.id} style={styles.row}><ThemedText type="small" style={styles.flex}>{dateLabel(entry.createdAt)} · {entry.summary}</ThemedText><Pressable accessibilityRole="button" accessibilityLabel={`${dateLabel(entry.createdAt)} 버전 미리보기`} onPress={() => restore(entry.id)} style={[styles.outlineButton, { borderColor: theme.border }]}><ThemedText type="smallBold">미리보기</ThemedText></Pressable></View>)}
    </ThemedView> : null}
    {saved ? <ExportPanel data={exportData} /> : null}
    {shown ? <View style={styles.container}>
      <ThemedText type="smallBold">{candidate ? '새 버전 미리보기' : '현재 저장된 버전'}: {shown.presentationTitle}</ThemedText>
      {activeTab === 'slides' && saved && !candidate ? <View style={styles.row}>
        {!editing ? <Pressable accessibilityRole="button" onPress={() => { setEdited({ ...saved, slides: saved.slides.map((slide) => ({ ...slide, bulletPoints: [...slide.bulletPoints] })) }); setEditing(true); }} style={[styles.outlineButton, { borderColor: theme.border }]}><ThemedText type="smallBold">슬라이드 편집</ThemedText></Pressable> : <>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => void saveEdits()} style={[styles.primaryButton, { backgroundColor: theme.primary }]}>{saving ? <ActivityIndicator color={theme.primaryText} /> : <ThemedText type="smallBold" style={{ color: theme.primaryText }}>편집 내용 저장</ThemedText>}</Pressable>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => { setEdited(null); setEditing(false); }} style={[styles.outlineButton, { borderColor: theme.border }]}><ThemedText type="smallBold">편집 닫기</ThemedText></Pressable>
        </>}
      </View> : null}
      <View style={styles.row}>{([{ key: 'slides', label: '슬라이드·대본' }, { key: 'qna', label: '예상 Q&A' }, { key: 'report', label: '보고서·사업계획서' }] as const).map((tab) => <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab.key }} onPress={() => setActiveTab(tab.key)} style={[styles.outlineButton, { borderColor: theme.border, backgroundColor: activeTab === tab.key ? theme.primarySoft : 'transparent' }]}><ThemedText type="smallBold">{tab.label}</ThemedText></Pressable>)}</View>
      {activeTab === 'slides' ? (editing && edited ? edited.slides : shown.slides).map((slide) => <ThemedView key={slide.slideNumber} type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>{editing && edited ? <>
        <TextInput accessibilityLabel={`${slide.slideNumber}번 슬라이드 제목`} value={slide.title} onChangeText={(text) => setEdited({ ...edited, slides: edited.slides.map((item) => item.slideNumber === slide.slideNumber ? { ...item, title: text } : item) })} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
        <TextInput accessibilityLabel={`${slide.slideNumber}번 슬라이드 내용`} value={slide.bulletPoints.join('\n')} multiline onChangeText={(text) => setEdited({ ...edited, slides: edited.slides.map((item) => item.slideNumber === slide.slideNumber ? { ...item, bulletPoints: text.split('\n').filter(Boolean) } : item) })} style={[styles.input, styles.multiline, { color: theme.text, borderColor: theme.border }]} />
        <ThemedText type="smallBold">발표 대본</ThemedText><TextInput accessibilityLabel={`${slide.slideNumber}번 슬라이드 발표 대본`} value={slide.speakerScript} multiline onChangeText={(text) => setEdited({ ...edited, slides: edited.slides.map((item) => item.slideNumber === slide.slideNumber ? { ...item, speakerScript: text } : item) })} style={[styles.input, styles.multiline, { color: theme.text, borderColor: theme.border }]} />
      </> : <><ThemedText type="smallBold">{slide.slideNumber}. {slide.title}</ThemedText>{slide.bulletPoints.map((point, index) => <ThemedText key={index} type="small">• {point}</ThemedText>)}<ThemedText type="smallBold">발표 대본</ThemedText><ThemedText type="small">{slide.speakerScript}</ThemedText></>}</ThemedView>) : null}
      {activeTab === 'qna' ? shown.expectedQna.map((item, index) => <ThemedView key={index} type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}><ThemedText type="smallBold">Q. {item.question}</ThemedText><ThemedText type="small">A. {item.answer}</ThemedText></ThemedView>) : null}
      {activeTab === 'report' ? <><ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}><ThemedText type="smallBold">사업계획서 초안</ThemedText><ThemedText type="small">{shown.businessPlanDraft}</ThemedText></ThemedView><ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}><ThemedText type="smallBold">최종 결과 보고서</ThemedText><ThemedText type="small">{shown.finalReport}</ThemedText></ThemedView></> : null}
    </View> : null}
    <Modal visible={confirmationOpen} transparent animationType="fade" onRequestClose={() => setConfirmationOpen(false)}>
      <View style={[styles.confirmOverlay, { backgroundColor: theme.overlay }]}>
        <ThemedView type="surfaceElevated" style={[styles.confirmPanel, { borderColor: theme.border }, Shadows.floating]}>
          <ThemedText type="cardTitle">{saved ? '기존 발표자료 대체 확인' : '발표자료 생성 확인'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            AI 사용량 4단위를 사용합니다. {saved ? '생성이 성공적으로 저장된 뒤에만 현재 자료가 새 버전으로 바뀝니다. 기존 버전은 복원할 수 있습니다.' : '확인하면 설정한 내용으로 발표자료 생성을 시작합니다.'}
          </ThemedText>
          <View style={styles.confirmActions}>
            <Pressable accessibilityRole="button" onPress={() => setConfirmationOpen(false)} style={[styles.cancelButton, { borderColor: theme.border }]}>
              <ThemedText type="smallBold">취소</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setConfirmationOpen(false); void generate(); }} style={[styles.confirmButton, { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" style={{ color: theme.primaryText }}>{saved ? '재생성 시작' : '생성 시작'}</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  </ThemedView>;
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  card: { gap: Spacing.two, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1, minWidth: 160 },
  outlineButton: { minHeight: ControlHeight.touch, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  primaryButton: { alignSelf: 'flex-start', minHeight: ControlHeight.touch, justifyContent: 'center', borderRadius: Radius.medium, paddingHorizontal: Spacing.four },
  input: { minHeight: ControlHeight.touch, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  multiline: { minHeight: 76, paddingVertical: Spacing.two, textAlignVertical: 'top' },
  confirmOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  confirmPanel: { width: '100%', maxWidth: 420, gap: Spacing.three, borderWidth: 1, borderRadius: Radius.large, padding: Spacing.four },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  cancelButton: { minHeight: ControlHeight.touch, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  confirmButton: { minHeight: ControlHeight.touch, justifyContent: 'center', borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  disabled: { opacity: 0.55 },
});
