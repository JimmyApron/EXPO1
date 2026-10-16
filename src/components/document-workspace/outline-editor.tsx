import { useState } from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { defaultOutline, moveOutline, newOutlineItem, outlineDescendants, snapshot } from '@/lib/document-workspace';
import type { ProjectSettings } from '@/lib/topic-workspace';
import type { ProjectTemplate } from '@/types/project';
import type { OutlineItem } from '@/types/document-workspace';
import type { WorkspaceAiResult } from '@/hooks/use-workspace-assistant';
import { WorkspaceButton as Button, WorkspaceField as Field, workspaceStyles as s, useWorkspaceConfirm } from './controls';
import type { WorkspaceAssistant, WorkspaceController } from './types';

export function OutlineEditor({ template, settings, workspace: w, assistant: ai, context }: { template: ProjectTemplate; settings: ProjectSettings; workspace: WorkspaceController; assistant: WorkspaceAssistant; context: unknown }) {
  const [suggestion, setSuggestion] = useState<WorkspaceAiResult | null>(null);
  const [addedSuggestionIndexes, setAddedSuggestionIndexes] = useState<Set<number>>(() => new Set());
  const confirmWorkspaceAction = useWorkspaceConfirm();
  const edit = (id: string, patch: Partial<OutlineItem>) => w.update(v => ({ ...v, outline: v.outline.map(i => i.id === id ? { ...i, ...patch } : i) }));
  const add = (parentId: string | null = null) => w.update(v => {
    const item = newOutlineItem('', parentId);
    if (!parentId) return { ...v, outline: [...v.outline, item] };
    const ids = outlineDescendants(v.outline, parentId);
    const end = Math.max(...v.outline.map((i, index) => ids.has(i.id) ? index : -1)) + 1;
    return { ...v, outline: [...v.outline.slice(0, end), item, ...v.outline.slice(end)] };
  });
  const hidden = new Set(w.data.outline.filter(i => i.collapsed).flatMap(i => [...outlineDescendants(w.data.outline, i.id)].filter(id => id !== i.id)));
  const guidanceLabel = (item: OutlineItem) => {
    if (template !== 'writing_creative') return '이 부분에서 다룰 내용·작성 안내';
    if (settings.writingKind === 'script') return '장면 설정 · 장소 / 등장인물 / 행동 / 대사 / 장면 전환';
    if (settings.writingKind === 'fiction') {
      const parent = w.data.outline.find(i => i.id === item.parentId);
      return /인물/.test(item.title + (parent?.title ?? '')) ? '인물 설정 · 이름 / 역할 / 성격 / 관계 메모' : '배경·사건·갈등·전개·결말 메모';
    }
    if (settings.writingKind === 'poetry') return '정서·이미지·표현·주요 구절 메모';
    return '이 부분에서 다룰 경험·생각·메시지';
  };
  return <View style={s.group}>
    <ThemedText type="sectionTitle">{template === 'report_research' ? '목차 구성' : '개요·표현 방향'}</ThemedText>
    <ThemedText type="small" themeColor="textSecondary">제목·작성 안내를 설정하고 위·아래 버튼으로 순서를 바꾸세요. 작성한 본문은 항목 ID에 연결되어 순서 변경 후에도 유지됩니다.</ThemedText>
    <View style={s.row}><Button onPress={() => add()}>항목 추가</Button>
      <Button onPress={() => w.update(v => ({ ...v, outline: [...v.outline, ...defaultOutline(template, settings)] }))}>유형별 기본 구성 추가</Button>
      <Button disabled={ai.busy} onPress={async () => { setAddedSuggestionIndexes(new Set()); setSuggestion(await ai.request('outline', { context, settings, resources: w.data.resources, evidence: w.data.evidence, existingOutline: w.data.outline.map(i => ({ title: i.title, guidance: i.guidance })) })); }}>AI 목차·개요 추천 / 개선</Button></View>
    {suggestion ? <View style={s.item}><ThemedText type="small">{suggestion.text}</ThemedText>
      {suggestion.outline.map((i, index) => <View key={index} style={s.group}><ThemedText type="smallBold">{i.title}</ThemedText><ThemedText>{i.guidance}</ThemedText><Button disabled={addedSuggestionIndexes.has(index)} onPress={() => { w.update(v => ({ ...v, outline: [...v.outline, { ...newOutlineItem(i.title), guidance: i.guidance }] })); setAddedSuggestionIndexes(v => new Set(v).add(index)); }}>{addedSuggestionIndexes.has(index) ? '목차에 추가됨' : '이 제안을 새 항목으로 추가'}</Button></View>)}
      <Button onPress={() => setSuggestion(null)}>제안 닫기</Button></View> : null}
    {w.data.outline.filter(i => !hidden.has(i.id)).map(item => <View key={item.id} style={[s.item, item.parentId ? { marginLeft: 12 } : null]}>
      <View style={s.row}><Button onPress={() => edit(item.id, { collapsed: !item.collapsed })}>{`${item.title || '새 항목'} ${item.collapsed ? '펼치기' : '접기'}`}</Button>
        <Button onPress={() => w.update(v => ({ ...v, outline: moveOutline(v.outline, item.id, -1) }))}>위로</Button>
        <Button onPress={() => w.update(v => ({ ...v, outline: moveOutline(v.outline, item.id, 1) }))}>아래로</Button>
        <Button onPress={() => add(item.id)}>하위 항목 추가</Button>
        <Button danger onPress={() => confirmWorkspaceAction('이 항목과 하위 항목을 삭제할까요? 현재 원고는 삭제 직전 버전으로 보관합니다.', () => w.update(v => { const ids = outlineDescendants(v.outline, item.id); return { ...v, versions: [...v.versions, snapshot(v, '목차 삭제 직전')], outline: v.outline.filter(i => !ids.has(i.id)) }; }))}>항목 삭제</Button></View>
      {!item.collapsed ? <>
        <Field label="목차·개요 제목" value={item.title} onChangeText={title => edit(item.id, { title })} />
        <Field label={guidanceLabel(item)} value={item.guidance} onChangeText={guidance => edit(item.id, { guidance })} />
        <Field label="항목 목표 글자 수 (선택)" keyboardType="number-pad" value={item.targetLength?.toString() ?? ''} onChangeText={text => edit(item.id, { targetLength: Number(text) > 0 ? Number(text) : null })} />
        {template === 'report_research' ? <><ThemedText type="smallBold">연결할 자료·근거</ThemedText><View style={s.row}>
          {w.data.resources.map(r => <Button key={r.id} selected={item.resourceIds.includes(r.id)} onPress={() => edit(item.id, { resourceIds: item.resourceIds.includes(r.id) ? item.resourceIds.filter(id => id !== r.id) : [...item.resourceIds, r.id] })}>{r.title || '제목 없는 자료'}</Button>)}
          {w.data.evidence.map(e => <Button key={e.id} selected={item.evidenceIds.includes(e.id)} onPress={() => edit(item.id, { evidenceIds: item.evidenceIds.includes(e.id) ? item.evidenceIds.filter(id => id !== e.id) : [...item.evidenceIds, e.id] })}>{`근거 · ${e.title}`}</Button>)}
        </View></> : null}
        {item.body ? <ThemedText type="small" themeColor="textSecondary">연결된 본문 {Array.from(item.body).length}자</ThemedText> : null}
      </> : null}
    </View>)}
  </View>;
}
