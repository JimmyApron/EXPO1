import { useState } from 'react';
import { Linking, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { workspaceId } from '@/lib/document-workspace';
import { importTextFile } from '@/utils/import-text-file';
import type { ResearchResource } from '@/types/document-workspace';
import type { Idea } from '@/types/idea';
import { WorkspaceButton as Button, WorkspaceField as Field, workspaceStyles as s, useWorkspaceConfirm } from './controls';
import type { WorkspaceAssistant, WorkspaceController } from './types';

export function ReportResourceLibrary({ workspace: w, assistant: ai, topic }: { workspace: WorkspaceController; assistant: WorkspaceAssistant; topic: Idea | null }) {
  const confirmWorkspaceAction = useWorkspaceConfirm();
  const [activeId, setActiveId] = useState(''), [compareIds, setCompareIds] = useState<string[]>([]), [error, setError] = useState('');
  const resource = w.data.resources.find(r => r.id === activeId);
  function add(content = '', name = '') {
    const next: ResearchResource = { id: workspaceId(), title: name, content, kind: '웹사이트', source: '', author: '', date: '', url: '', summary: '', claim: '', memo: '', verified: false, used: false };
    w.update(v => ({ ...v, resources: [...v.resources, next] })); setActiveId(next.id);
  }
  function edit<K extends keyof ResearchResource>(key: K, value: ResearchResource[K]) { w.update(v => ({ ...v, resources: v.resources.map(r => r.id === activeId ? { ...r, [key]: value } : r) })); }
  async function summarize() {
    if (!resource?.content.trim()) { setError('URL만으로는 원문을 분석할 수 없습니다. 자료 본문을 붙여넣거나 TXT 파일을 불러와 주세요.'); return; }
    setError(''); const id = resource.id;
    const result = await ai.request('resource', { resource, topic });
    if (result) w.update(v => ({ ...v, resources: v.resources.map(r => r.id === id ? { ...r, summary: result.text } : r) }));
  }
  const selected = w.data.resources.filter(r => compareIds.includes(r.id));
  return <View style={s.group}>
    <ThemedText type="sectionTitle">조사 자료함</ThemedText>
    <ThemedText type="smallBold">조사 주제: {topic?.title || '1단계에서 최종 주제를 선택해 주세요.'}</ThemedText>
    <ThemedText type="small" themeColor="textSecondary">직접 확인한 자료를 등록하세요. URL 원문 자동 수집은 지원하지 않습니다. 본문이 있는 자료만 AI 요약·비교에 사용합니다.</ThemedText>
    <View style={s.row}><Button onPress={() => add()}>자료 추가</Button><Button onPress={async () => { try { const file = await importTextFile(); if (file) add(file.content, file.name); } catch (e) { setError((e as Error).message); } }}>TXT 자료 불러오기</Button></View>
    {w.data.resources.map(r => <View key={r.id} style={s.item}>
      <View style={s.row}><Button selected={r.id === activeId} onPress={() => setActiveId(r.id)}>{r.title || '제목 없는 자료'}</Button>
        <Button selected={compareIds.includes(r.id)} onPress={() => setCompareIds(ids => ids.includes(r.id) ? ids.filter(id => id !== r.id) : [...ids, r.id])}>{compareIds.includes(r.id) ? '비교 선택됨' : '비교 선택'}</Button></View>
      <ThemedText type="small" themeColor="textSecondary">{r.kind} · {r.source || '출처 미입력'} · {r.verified ? '사용자가 확인함' : '확인 필요'} · {r.used ? '사용 중' : '미사용'}</ThemedText>
      {r.summary ? <ThemedText type="small">{r.summary}</ThemedText> : null}
    </View>)}
    {resource ? <View style={s.group}>
      <Field label="자료 제목" value={resource.title} onChangeText={v => edit('title', v)} />
      <View style={s.row}>{['논문', '통계', '보고서', '기사', '웹사이트', '직접 조사', '기타'].map(kind => <Button key={kind} selected={resource.kind === kind} onPress={() => edit('kind', kind)}>{kind}</Button>)}</View>
      {([['source', '출처명'], ['author', '작성자·기관'], ['date', '발행일'], ['url', 'URL'], ['content', '자료 본문'], ['summary', '주요 내용 요약 (AI 제안은 검토 후 수정)'], ['claim', '핵심 주장'], ['memo', '개인 메모']] as const).map(([key, label]) => <Field key={key} label={label} value={resource[key]} onChangeText={v => edit(key, v)} />)}
      <View style={s.row}><Button selected={resource.verified} onPress={() => edit('verified', !resource.verified)}>{resource.verified ? '자료 확인 취소' : '직접 자료 확인 완료'}</Button>
        <Button selected={resource.used} onPress={() => edit('used', !resource.used)}>{resource.used ? '사용 해제' : '보고서에 사용'}</Button>
        <Button disabled={ai.busy} onPress={() => void summarize()}>AI 본문 요약</Button>
        <Button onPress={async () => { if (!/^https?:\/\//i.test(resource.url)) { setError('http 또는 https URL을 입력해 주세요.'); return; } try { await Linking.openURL(resource.url); } catch { setError('출처를 열지 못했습니다. URL을 확인해 주세요.'); } }}>원문 출처 열기</Button>
        <Button danger onPress={() => confirmWorkspaceAction('이 자료와 연결된 근거·목차의 출처 연결을 해제할까요? 작성한 본문은 보존됩니다.', () => { w.update(v => ({ ...v, resources: v.resources.filter(r => r.id !== activeId), evidence: v.evidence.map(e => e.resourceId === activeId ? { ...e, resourceId: '' } : e), outline: v.outline.map(i => ({ ...i, resourceIds: i.resourceIds.filter(id => id !== activeId) })) })); setActiveId(''); })}>자료 삭제</Button>
      </View>
    </View> : null}
    <View style={s.row}><Button disabled={ai.busy || selected.length < 2} onPress={async () => { if (selected.some(r => !r.content.trim())) { setError('비교할 모든 자료의 본문을 입력해 주세요.'); return; } setError(''); const result = await ai.request('compare', { resources: selected }); if (result) w.update(v => ({ ...v, resourceComparison: result.text })); }}>선택 자료 AI 비교</Button></View>
    <Field label="자료 비교 · 공통 주장 / 차이점 / 추가 확인" value={w.data.resourceComparison} onChangeText={resourceComparison => w.update(v => ({ ...v, resourceComparison }))} />
    <ThemedText type="sectionTitle">핵심 근거 카드</ThemedText>
    <Button disabled={!resource} onPress={() => { if (resource) w.update(v => ({ ...v, evidence: [...v.evidence, { id: workspaceId(), title: resource.title, content: resource.claim || resource.summary, resourceId: resource.id, quote: '', memo: '' }] })); }}>선택 자료에서 근거 추가</Button>
    {w.data.evidence.map(e => <View key={e.id} style={s.item}>
      <ThemedText type="small">출처: {w.data.resources.find(r => r.id === e.resourceId)?.title || '출처 연결 필요'}</ThemedText>
      {([['title', '근거 제목'], ['content', '핵심 내용'], ['quote', '관련 수치·인용 부분'], ['memo', '근거 메모']] as const).map(([key, label]) => <Field key={key} label={label} value={e[key]} onChangeText={text => w.update(v => ({ ...v, evidence: v.evidence.map(item => item.id === e.id ? { ...item, [key]: text } : item) }))} />)}
      <Button danger onPress={() => confirmWorkspaceAction('근거 카드를 삭제할까요? 본문은 보존됩니다.', () => w.update(v => ({ ...v, evidence: v.evidence.filter(item => item.id !== e.id), outline: v.outline.map(i => ({ ...i, evidenceIds: i.evidenceIds.filter(id => id !== e.id) })) })))}>근거 삭제</Button>
    </View>)}
    {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
  </View>;
}
