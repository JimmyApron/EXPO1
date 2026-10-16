import { useState } from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { manuscriptFingerprint, manuscriptText, workspaceId } from '@/lib/document-workspace';
import { saveFile } from '@/utils/export/saveFile';
import { WorkspaceButton as Button, WorkspaceField as Field, workspaceStyles as s } from './controls';
import type { WorkspaceAssistant, WorkspaceController } from './types';

export function WorkspacePresentation({ workspace: w, assistant: ai, report }: { workspace: WorkspaceController; assistant: WorkspaceAssistant; report: boolean }) {
  const [error, setError] = useState(''), [exportBusy, setExportBusy] = useState(false);
  const source = w.data.versions.find(v => v.id === w.data.finalVersionId);
  async function generate() {
    if (!source) { setError('검토 화면에서 최종 원고를 먼저 확정해 주세요.'); return; }
    const fingerprint = manuscriptFingerprint(w.data);
    const result = await ai.request('presentation', { finalDocument: manuscriptText(source), settings: w.data.presentation, resources: report ? w.data.resources.filter(r => r.used) : [] });
    if (result) w.update(v => ({ ...v, slides: [...v.slides, ...result.slides.map(slide => ({ ...slide, id: workspaceId() }))], qna: result.qna, presentationFingerprint: fingerprint }));
  }
  async function exportSlides() {
    setExportBusy(true); setError('');
    try {
      const { default: PptxGenJS } = await import('pptxgenjs');
      const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE'; pptx.title = w.data.title; pptx.author = 'Watt';
      pptx.theme = { headFontFace: 'Malgun Gothic', bodyFontFace: 'Malgun Gothic' };
      w.data.slides.forEach((item, index) => {
        const slide = pptx.addSlide();
        slide.addText(item.title, { x: 0.6, y: 0.4, w: 12, h: 1, fontSize: 28, bold: true, fit: 'shrink' });
        slide.addText(item.content, { x: 0.7, y: 1.7, w: 12, h: 5, fontSize: 20, valign: 'top', fit: 'shrink' });
        slide.addText(String(index + 1), { x: 12, y: 7, w: 0.5, h: 0.2, fontSize: 10 });
        if (item.script) slide.addNotes(item.script);
      });
      const bytes = await pptx.write({ outputType: 'uint8array', compression: true });
      if (!(bytes instanceof Uint8Array)) throw new Error('발표 파일을 만들지 못했습니다.');
      await saveFile(bytes, `${w.data.title || '발표자료'}.pptx`, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    } catch (e) { setError((e as Error).message); } finally { setExportBusy(false); }
  }
  return <View style={s.group}>
    <ThemedText type="sectionTitle">{report ? '조사 결과 발표자료' : '작품·창작 과정 발표자료'}</ThemedText>
    {w.data.presentationFingerprint && w.data.presentationFingerprint !== manuscriptFingerprint(w.data) ? <ThemedText>원고가 변경되었습니다. 발표자료를 다시 검토해 주세요.</ThemedText> : null}
    {([['minutes', '발표 시간 (분)'], ['slideCount', '목표 슬라이드 수'], ['purpose', '발표 목적'], ['audience', '발표 대상'], ['style', '표현 방식']] as const).map(([key, label]) => <Field key={key} label={label} value={w.data.presentation[key]} onChangeText={text => w.update(v => ({ ...v, presentation: { ...v.presentation, [key]: text } }))} />)}
    <View style={s.row}><Button disabled={ai.busy} onPress={() => void generate()}>최종본으로 AI 발표 초안·대본·질문 생성</Button><Button onPress={() => w.update(v => ({ ...v, slides: [...v.slides, { id: workspaceId(), title: '', content: '', script: '' }] }))}>슬라이드 직접 추가</Button></View>
    <ThemedText type="small" themeColor="textSecondary">새 AI 초안은 기존 슬라이드 뒤에 추가합니다. 원래 작성한 슬라이드는 보존됩니다.</ThemedText>
    {w.data.slides.map((slide, index) => <View key={slide.id} style={s.item}>
      <ThemedText type="smallBold">슬라이드 {index + 1}</ThemedText>
      {([['title', '슬라이드 제목'], ['content', '슬라이드 내용'], ['script', '발표 대본']] as const).map(([key, label]) => <Field key={key} label={label} value={slide[key]} onChangeText={text => w.update(v => ({ ...v, slides: v.slides.map(i => i.id === slide.id ? { ...i, [key]: text } : i) }))} />)}
      <View style={s.row}>{([-1, 1] as const).map(direction => <Button key={direction} disabled={index + direction < 0 || index + direction >= w.data.slides.length} onPress={() => w.update(v => { const slides = [...v.slides]; [slides[index], slides[index + direction]] = [slides[index + direction], slides[index]]; return { ...v, slides }; })}>{direction < 0 ? '위로' : '아래로'}</Button>)}<Button danger onPress={() => w.update(v => ({ ...v, slides: v.slides.filter(i => i.id !== slide.id) }))}>슬라이드 삭제</Button></View>
    </View>)}
    <Field label="예상 질문·답변" value={w.data.qna} onChangeText={qna => w.update(v => ({ ...v, qna }))} />
    <View style={s.row}><Button disabled={exportBusy || !w.data.slides.length} onPress={() => void exportSlides()}>PPTX 내려받기</Button><Button onPress={() => { void saveFile(w.data.slides.map((i, n) => `${n + 1}. ${i.title}\n${i.script}`).join('\n\n') + '\n\n예상 질문\n' + w.data.qna, `${w.data.title}_발표대본.txt`, 'text/plain;charset=utf-8').catch(e => setError(e.message)); }}>대본·질문 TXT 내려받기</Button></View>
    {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
  </View>;
}
