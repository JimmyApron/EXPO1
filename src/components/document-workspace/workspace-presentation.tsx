import { useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import PresentationHtmlPreview from '@/components/PresentationHtmlPreview';
import { PresentationThemePicker } from '@/components/presentation-theme-picker';
import { ThemedText } from '@/components/themed-text';
import { manuscriptFingerprint, manuscriptText, workspaceId } from '@/lib/document-workspace';
import { canApplyPresentationTheme } from '@/lib/presentation-entitlement';
import { isPremiumPresentationTheme, presentationPalette, type PresentationTheme } from '@/lib/presentation-themes';
import { saveFile } from '@/utils/export/saveFile';
import { sharePrintedPdf } from '@/utils/export/sharePrintedPdf';
import { createPresentationHtml } from '@/utils/export/presentationHtml';
import type { PresentationData } from '@/types/presentation';
import { WorkspaceButton as Button, WorkspaceField as Field, workspaceStyles as s } from './controls';
import type { WorkspaceAssistant, WorkspaceController } from './types';

export function WorkspacePresentation({ workspace: w, assistant: ai, report, projectId }: { workspace: WorkspaceController; assistant: WorkspaceAssistant; report: boolean; projectId: string }) {
  const router = useRouter();
  const [error, setError] = useState(''), [exportBusy, setExportBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false), [premiumDenied, setPremiumDenied] = useState(false);
  const source = w.data.versions.find(v => v.id === w.data.finalVersionId);
  const currentTheme = w.data.presentation.theme || 'minimal-light';
  const [themeSelection, setThemeSelection] = useState({ base: currentTheme, selected: currentTheme });
  const previewTheme = themeSelection.base === currentTheme ? themeSelection.selected : currentTheme;
  const asPresentation = (theme: PresentationTheme): PresentationData => ({
    presentationTitle: w.data.title,
    settings: { title: w.data.title, pageCount: w.data.slides.length, theme },
    slides: w.data.slides.map((slide, index) => ({ slideNumber: index + 1, title: slide.title, bulletPoints: slide.content.split('\n').filter(Boolean), speakerScript: slide.script })),
    expectedQna: [], businessPlanDraft: '', finalReport: '',
  });
  async function checkTheme(theme: PresentationTheme) {
    setPremiumDenied(false);
    if (!isPremiumPresentationTheme(theme) || await canApplyPresentationTheme(projectId, theme)) return true;
    setPremiumDenied(true); setError('프리미엄 테마를 적용하려면 활성 구독 또는 무료체험이 필요합니다.');
    return false;
  }
  async function applyTheme() {
    setError('');
    try {
      if (previewTheme === currentTheme) return true;
      if (!(await checkTheme(previewTheme))) return false;
      w.update(value => ({ ...value, presentation: { ...value.presentation, theme: previewTheme } }));
      const result = await w.save();
      if (result.error) {
        w.update(value => ({ ...value, presentation: { ...value.presentation, theme: currentTheme } }));
        setError(result.error);
        return false;
      }
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : '테마 권한을 확인하지 못했습니다.'); return false; }
  }
  async function generate() {
    if (!source) { setError('검토 화면에서 최종 원고를 먼저 확정해 주세요.'); return; }
    try {
      if (!(await checkTheme(previewTheme))) return;
      if (!(await applyTheme())) return;
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : '테마 권한을 확인하지 못했습니다.'); return; }
    const fingerprint = manuscriptFingerprint(w.data);
    const result = await ai.request('presentation', { finalDocument: manuscriptText(source), settings: { ...w.data.presentation, theme: previewTheme }, resources: report ? w.data.resources.filter(r => r.used) : [] });
    if (result) w.update(v => ({ ...v, slides: [...v.slides, ...result.slides.map(slide => ({ ...slide, id: workspaceId() }))], qna: result.qna, presentationFingerprint: fingerprint }));
  }
  async function exportSlides() {
    setExportBusy(true); setError('');
    try {
      const { default: PptxGenJS } = await import('pptxgenjs');
      const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE'; pptx.title = w.data.title; pptx.author = 'Watt';
      pptx.theme = { headFontFace: 'Malgun Gothic', bodyFontFace: 'Malgun Gothic' };
      const colors = presentationPalette[currentTheme];
      w.data.slides.forEach((item, index) => {
        const slide = pptx.addSlide();
        slide.background = { color: colors.background.slice(1) };
        if (currentTheme === 'modern-dark') slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.16, h: 7.5, line: { color: colors.accent.slice(1) }, fill: { color: colors.accent.slice(1) } });
        if (currentTheme === 'business') slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 0.38, w: 12.1, h: 0.05, line: { color: colors.accent.slice(1) }, fill: { color: colors.accent.slice(1) } });
        slide.addText(item.title, { x: currentTheme === 'modern-dark' ? 1.1 : 0.6, y: currentTheme === 'modern-dark' ? 1.1 : 0.65, w: 11.5, h: 1, fontSize: currentTheme === 'modern-dark' ? 36 : 30, bold: true, color: colors.foreground.slice(1), fit: 'shrink' });
        slide.addText(item.content, { x: currentTheme === 'modern-dark' ? 1.2 : 0.7, y: currentTheme === 'modern-dark' ? 2.4 : 1.85, w: 11.5, h: 4.8, fontSize: 20, color: colors.foreground.slice(1), valign: 'top', fit: 'shrink' });
        slide.addText(String(index + 1).padStart(2, '0'), { x: 12, y: 7, w: 0.5, h: 0.2, fontSize: 10, color: colors.accent.slice(1) });
        if (item.script) slide.addNotes(item.script);
      });
      const bytes = await pptx.write({ outputType: 'uint8array', compression: true });
      if (!(bytes instanceof Uint8Array)) throw new Error('발표 파일을 만들지 못했습니다.');
      await saveFile(bytes, `${w.data.title || '발표자료'}.pptx`, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    } catch (e) { setError((e as Error).message); } finally { setExportBusy(false); }
  }
  async function exportHtml() { await saveFile(createPresentationHtml(asPresentation(currentTheme)), `${w.data.title || '발표자료'}.html`, 'text/html;charset=utf-8'); }
  async function exportPdf() {
    const presentation = asPresentation(currentTheme);
    const html = createPresentationHtml(presentation, { printOnly: Platform.OS !== 'web' });
    if (Platform.OS === 'web') {
      const popup = window.open('', '_blank');
      if (!popup) throw new Error('PDF 출력 창이 차단되었습니다.');
      popup.document.open(); popup.document.write(html); popup.document.close();
      popup.addEventListener('load', () => popup.print(), { once: true });
      return;
    }
    const result = await Print.printToFileAsync({ html, width: 960, height: 540, base64: true });
    if (Platform.OS === 'ios' && result.numberOfPages !== presentation.slides.length) throw new Error('PDF 페이지 수가 슬라이드 수와 다릅니다.');
    await sharePrintedPdf(result.base64, `${w.data.title || '발표자료'}.pdf`);
  }
  async function runExport(action: () => Promise<unknown>) {
    setExportBusy(true); setError('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : '발표자료를 내보내지 못했습니다.'); }
    finally { setExportBusy(false); }
  }
  return <View style={s.group}>
    <ThemedText type="sectionTitle">{report ? '조사 결과 발표자료' : '작품·창작 과정 발표자료'}</ThemedText>
    <PresentationThemePicker value={previewTheme} onChange={selected => setThemeSelection({ base: currentTheme, selected })} />
    <View style={s.row}><Button onPress={() => void applyTheme()}>디자인만 적용 · AI 0단위</Button><Button disabled={!w.data.slides.length} onPress={() => setShowPreview(v => !v)}>{showPreview ? '테마 미리보기 닫기' : '선택한 테마 미리보기'}</Button></View>
    {premiumDenied ? <Button onPress={() => router.push('/watt')}>Watt 이용권 페이지로 이동</Button> : null}
    {showPreview && w.data.slides.length ? <PresentationHtmlPreview html={createPresentationHtml(asPresentation(previewTheme))} /> : null}
    {w.data.presentationFingerprint && w.data.presentationFingerprint !== manuscriptFingerprint(w.data) ? <ThemedText>원고가 변경되었습니다. 발표자료를 다시 검토해 주세요.</ThemedText> : null}
    <ThemedText type="small" themeColor="textSecondary">AI 발표 초안 생성은 4단위를 사용합니다. 테마 변경, 직접 편집, 내려받기는 AI 단위를 사용하지 않습니다.</ThemedText>
    {([['minutes', '발표 시간 (분)'], ['slideCount', '목표 슬라이드 수'], ['purpose', '발표 목적'], ['audience', '발표 대상'], ['style', '표현 방식']] as const).map(([key, label]) => <Field key={key} label={label} value={w.data.presentation[key]} onChangeText={text => w.update(v => ({ ...v, presentation: { ...v.presentation, [key]: text } }))} />)}
    <View style={s.row}><Button disabled={ai.busy} onPress={() => void generate()}>최종본으로 AI 발표 초안·대본·질문 생성</Button><Button onPress={() => w.update(v => ({ ...v, slides: [...v.slides, { id: workspaceId(), title: '', content: '', script: '' }] }))}>슬라이드 직접 추가</Button></View>
    <ThemedText type="small" themeColor="textSecondary">새 AI 초안은 기존 슬라이드 뒤에 추가합니다. 원래 작성한 슬라이드는 보존됩니다.</ThemedText>
    {w.data.slides.map((slide, index) => <View key={slide.id} style={s.item}>
      <ThemedText type="smallBold">슬라이드 {index + 1}</ThemedText>
      {([['title', '슬라이드 제목'], ['content', '슬라이드 내용'], ['script', '발표 대본']] as const).map(([key, label]) => <Field key={key} label={label} value={slide[key]} onChangeText={text => w.update(v => ({ ...v, slides: v.slides.map(i => i.id === slide.id ? { ...i, [key]: text } : i) }))} />)}
      <View style={s.row}>{([-1, 1] as const).map(direction => <Button key={direction} disabled={index + direction < 0 || index + direction >= w.data.slides.length} onPress={() => w.update(v => { const slides = [...v.slides]; [slides[index], slides[index + direction]] = [slides[index + direction], slides[index]]; return { ...v, slides }; })}>{direction < 0 ? '위로' : '아래로'}</Button>)}<Button danger onPress={() => w.update(v => ({ ...v, slides: v.slides.filter(i => i.id !== slide.id) }))}>슬라이드 삭제</Button></View>
    </View>)}
    <Field label="예상 질문·답변" value={w.data.qna} onChangeText={qna => w.update(v => ({ ...v, qna }))} />
    <View style={s.row}><Button disabled={exportBusy || !w.data.slides.length} onPress={() => void exportSlides()}>PPTX 내려받기</Button><Button disabled={exportBusy || !w.data.slides.length} onPress={() => void runExport(exportHtml)}>HTML 내려받기</Button><Button disabled={exportBusy || !w.data.slides.length} onPress={() => void runExport(exportPdf)}>PDF 내려받기</Button><Button onPress={() => { void saveFile(w.data.slides.map((i, n) => `${n + 1}. ${i.title}\n${i.script}`).join('\n\n') + '\n\n예상 질문\n' + w.data.qna, `${w.data.title}_발표대본.txt`, 'text/plain;charset=utf-8').catch(e => setError(e.message)); }}>대본·질문 TXT 내려받기</Button></View>
    {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
  </View>;
}
