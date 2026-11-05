import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { citationDraft, manuscriptCount, manuscriptText, snapshot } from '@/lib/document-workspace';
import type { ProjectSettings } from '@/lib/topic-workspace';
import type { ProjectTemplate } from '@/types/project';
import { WorkspaceButton as Button, WorkspaceField as Field, WorkspaceResizableField, workspaceStyles as s } from './controls';
import type { WorkspaceAssistant, WorkspaceController } from './types';
import type { WorkspaceAiTask } from '@/hooks/use-workspace-assistant';
import { MarkdownPreview } from './markdown-preview';

export function DocumentEditor({ template, settings, workspace: w, assistant: ai }: { template: ProjectTemplate; settings: ProjectSettings; workspace: WorkspaceController; assistant: WorkspaceAssistant }) {
  const [sectionId, setSectionId] = useState(w.data.outline[0]?.id ?? '');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [preview, setPreview] = useState(false), [error, setError] = useState('');
  const [proposal, setProposal] = useState<{ text: string; original: string; body: string; sectionId: string; task: WorkspaceAiTask; start: number; end: number } | null>(null);
  const section = w.data.outline.find(i => i.id === sectionId), body = section?.body ?? w.data.freeBody;
  const setBody = (text: string) => w.update(v => section ? { ...v, outline: v.outline.map(i => i.id === section.id ? { ...i, body: text, completed: false } : i) } : { ...v, freeBody: text });
  function insert(text: string) { const start = Math.min(selection.start, body.length), end = Math.min(selection.end, body.length); setBody(body.slice(0, start) + text + body.slice(end)); }
  async function assist(task: WorkspaceAiTask) {
    setError(''); setProposal(null);
    const start = Math.max(0, Math.min(selection.start, selection.end, body.length)), end = Math.max(0, Math.min(Math.max(selection.start, selection.end), body.length));
    const original = body.slice(start, end), captured = body, targetId = section?.id ?? '';
    const context = { title: w.data.title, settings, section: section?.title, guidance: section?.guidance, selection: original, body, task };
    const result = await ai.request(task, context);
    if (!result) return;
    const text = result.resultText.trim();
    if (!text) { setError('AI가 수정안을 반환하지 않았습니다. 다시 요청해 주세요.'); return; }
    setProposal({ text, original, body: captured, sectionId: targetId, task, start, end });
  }
  function apply() {
    if (!proposal) return;
    const target = w.data.outline.find(i => i.id === proposal.sectionId), latest = target?.body ?? w.data.freeBody;
    if (latest !== proposal.body || (proposal.sectionId && !target)) { setError('AI 요청 후 원문이 변경되었습니다. 현재 원고로 다시 요청해 주세요.'); return; }
    const text = proposal.task === 'continue'
      ? proposal.original
        ? `${latest.slice(0, proposal.end)}${proposal.end > 0 && latest[proposal.end - 1] !== '\n' ? '\n' : ''}${proposal.text}${latest.slice(proposal.end)}`
        : `${latest}${latest && !latest.endsWith('\n') ? '\n' : ''}${proposal.text}`
      : proposal.original ? latest.slice(0, proposal.start) + proposal.text + latest.slice(proposal.end) : proposal.text;
    w.update(v => ({ ...v, versions: [...v.versions, snapshot(v, 'AI 제안 적용 전')],
      ...(target ? { outline: v.outline.map(i => i.id === target.id ? { ...i, body: text, completed: false } : i) } : { freeBody: text }) }));
    setProposal(null);
  }
  return <View style={s.group}>
    <Field label={template === 'report_research' ? '문서 제목' : '작품 제목'} value={w.data.title} onChangeText={title => w.update(v => ({ ...v, title }))} />
    <ThemedText type="small" themeColor="textSecondary">{manuscriptCount(w.data)}자 · {settings.targetLength ? `목표 ${settings.targetLength}${settings.lengthUnit === 'pages' ? '페이지 (인쇄 후 확인)' : '자'}` : '목표 분량 미설정'} · {w.status}</ThemedText>
    <View style={s.row}><Button selected={!section} onPress={() => { setSectionId(''); setSelection({ start: 0, end: 0 }); }}>자유 본문</Button>
      {w.data.outline.map(i => <Button key={i.id} selected={sectionId === i.id} onPress={() => { setSectionId(i.id); setSelection({ start: 0, end: 0 }); }}>{`${i.completed ? '완료 · ' : ''}${i.title || '제목 없는 항목'}`}</Button>)}</View>
    {section?.guidance ? <ThemedText type="small" themeColor="textSecondary">작성 안내: {section.guidance}</ThemedText> : null}
    <View style={s.row}><Button onPress={() => insert(`**${body.slice(selection.start, selection.end) || '강조할 문장'}**`)}>굵게</Button><Button onPress={() => insert(`*${body.slice(selection.start, selection.end) || '기울임 문장'}*`)}>기울임</Button><Button onPress={() => insert(`\n- ${body.slice(selection.start, selection.end) || '목록 항목'}`)}>목록</Button><Button onPress={() => insert('\n\n')}>문단 추가</Button><Button onPress={() => insert('\n\n## 새 장면·챕터\n\n')}>장면·챕터 구분</Button></View>
    <ThemedText type="small" themeColor="textSecondary">기본 서식은 Markdown으로 저장합니다. 본문에서 수정할 부분을 선택한 뒤 AI 도구를 사용할 수 있습니다.</ThemedText>
    <Field label={section?.title || '자유 본문'} value={body} onChangeText={setBody} onSelectionChange={e => setSelection(e.nativeEvent.selection)} style={s.editor} placeholder="문단을 나누어 본문을 작성하세요." />
    <View style={s.row}>{section ? <Button selected={section.completed} onPress={() => w.update(v => ({ ...v, outline: v.outline.map(i => i.id === section.id ? { ...i, completed: !i.completed } : i) }))}>{section.completed ? '이 항목 작성 완료 취소' : '이 항목 작성 완료'}</Button> : null}
      <Button onPress={() => { w.update(v => ({ ...v, versions: [...v.versions, snapshot(v, v.versions.length ? '수정 원고' : '최초 초안')] })); void w.save(); }}>원고 버전 저장</Button>
      <Button selected={preview} onPress={() => setPreview(!preview)}>{preview ? '전체 미리보기 접기' : '전체 미리보기'}</Button></View>
    {preview ? <MarkdownPreview text={manuscriptText(w.data)} /> : null}
    <View style={s.row}>{([['polish', '문장 다듬기'], ['expand', '문단·묘사 확장'], ['shorten', '문장 축약'], ['continue', '이어서 쓰기'], ['tone', '분위기·표현 개선'], ['rewrite', '문단 재작성'], ...(settings.writingKind === 'fiction' || settings.writingKind === 'script' ? [['dialogue', '대사 개선']] : [])] as [WorkspaceAiTask, string][]).map(([task, label]) => <Button key={task} disabled={ai.busy || !body.trim()} onPress={() => void assist(task)}>{`AI ${label}`}</Button>)}</View>
    {!body.trim() ? <ThemedText type="caption" themeColor="textSecondary">현재 항목에 본문을 입력하면 AI 문장 도구를 사용할 수 있어요.</ThemedText> : null}
    {ai.busy ? <View style={s.row}><ActivityIndicator /><ThemedText type="small" themeColor="textSecondary">AI가 수정안을 만들고 있어요.</ThemedText></View> : null}
    {error || ai.error ? <ThemedText accessibilityRole="alert">{error || ai.error}</ThemedText> : null}
    {proposal ? <View style={s.item}><ThemedText type="smallBold">원문</ThemedText><ThemedText selectable>{proposal.original || proposal.body}</ThemedText><ThemedText type="smallBold">AI 제안 · 검토 후 적용</ThemedText><WorkspaceResizableField label="수정 제안" initialHeight={280} value={proposal.text} editable={!ai.busy} onChangeText={text => setProposal(v => v ? { ...v, text } : v)} /><View style={s.row}><Button disabled={ai.busy} onPress={apply}>제안 적용</Button><Button onPress={() => setProposal(null)}>제안 무시</Button></View></View> : null}
    {template === 'report_research' ? <View style={s.group}>
      <ThemedText type="smallBold">연결된 근거·출처</ThemedText>
      {w.data.evidence.filter(e => !section || section.evidenceIds.includes(e.id)).map(e => <View key={e.id} style={s.item}><ThemedText>{e.title}: {e.content}</ThemedText><ThemedText type="small">출처: {w.data.resources.find(r => r.id === e.resourceId)?.title || '출처 연결 필요'}</ThemedText><Button onPress={() => insert(`\n${e.quote || e.content}\n`)}>근거를 본문에 넣기</Button></View>)}
      {w.data.resources.map((r, index) => <View key={r.id} style={s.item}><ThemedText type="small">{r.title}</ThemedText><Button onPress={() => {
        const cite = citationDraft(r, settings.citationStyle, index + 1); insert(` (${settings.citationStyle === 'IEEE' ? `[${index + 1}]` : `${r.author || '작성자 확인 필요'}, ${r.date || '발행일 확인 필요'}`}) `);
        w.update(v => ({ ...v, resources: v.resources.map(x => x.id === r.id ? { ...x, used: true } : x), outline: v.outline.map(i => i.id === section?.id ? { ...i, resourceIds: [...new Set([...i.resourceIds, r.id])] } : i) }));
        if (cite.missing.length) setError(`출처 정보 확인 필요: ${cite.missing.join(', ')}`);
      }}>이 자료 인용 연결</Button></View>)}
    </View> : null}
  </View>;
}
