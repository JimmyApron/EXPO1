import { useState } from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { snapshot, workspaceId } from '@/lib/document-workspace';
import type { ProjectSettings } from '@/lib/topic-workspace';
import { WorkspaceButton as Button, WorkspaceField as Field, workspaceStyles as s } from './controls';
import type { WorkspaceAssistant, WorkspaceController } from './types';

export function WritingFeedbackPanel({ workspace: w, assistant: ai, settings, onEdit }: { workspace: WorkspaceController; assistant: WorkspaceAssistant; settings: ProjectSettings; onEdit: () => void }) {
  const [error, setError] = useState('');
  async function request() {
    const bodies = [...w.data.outline.map(i => ({ id: i.id, title: i.title, body: i.body })), { id: null, title: '자유 본문', body: w.data.freeBody }];
    const result = await ai.request('feedback', { settings, title: w.data.title, sections: bodies });
    if (!result) return;
    const feedback = result.suggestions.flatMap(i => {
      const targets = bodies.filter(b => i.original && b.body.includes(i.original));
      // Ambiguous or invented excerpts cannot become an executable replacement.
      if (targets.length !== 1 || targets[0].body.split(i.original).length !== 2) return [];
      return [{ id: workspaceId(), kind: i.kind, outlineId: targets[0].id, original: i.original, suggestion: i.text, reason: i.reason, status: 'pending' as const }];
    });
    w.update(v => ({ ...v, feedback: [...v.feedback, ...feedback] }));
    if (!feedback.length) setError(result.text || '적용 가능한 수정 제안이 없습니다. 직접 원고를 검토해 주세요.');
  }
  const pending = w.data.feedback.filter(f => f.status === 'pending');
  return <View style={s.group}>
    <ThemedText type="sectionTitle">AI 피드백·수정</ThemedText>
    <ThemedText type="small" themeColor="textSecondary">AI 의견은 참고 제안입니다. 맞춤법·흐름·글 종류별 표현과 과제 조건을 검토하고 직접 적용 여부를 정하세요.</ThemedText>
    <View style={s.row}><Button disabled={ai.busy} onPress={() => void request()}>AI 피드백 요청</Button><Button onPress={onEdit}>원고 직접 수정</Button></View>
    {pending.map(f => <View key={f.id} style={s.item}>
      <ThemedText type="smallBold">{f.kind}</ThemedText><ThemedText type="small">원문: {f.original}</ThemedText><ThemedText type="small">이유: {f.reason}</ThemedText>
      <Field label="수정 제안 (직접 편집 가능)" value={f.suggestion} onChangeText={suggestion => w.update(v => ({ ...v, feedback: v.feedback.map(i => i.id === f.id ? { ...i, suggestion } : i) }))} />
      <View style={s.row}><Button onPress={() => {
        const target = w.data.outline.find(i => i.id === f.outlineId), body = target?.body ?? (f.outlineId ? '' : w.data.freeBody);
        if (body.split(f.original).length !== 2) { setError('원문이 변경되었거나 같은 구절이 여러 번 나타납니다. 원고에서 직접 수정해 주세요.'); return; }
        w.update(v => ({ ...v, versions: [...v.versions, snapshot(v, '피드백 적용 전')],
          ...(target ? { outline: v.outline.map(i => i.id === target.id ? { ...i, body: body.replace(f.original, f.suggestion), completed: false } : i) } : { freeBody: body.replace(f.original, f.suggestion) }),
          feedback: v.feedback.map(i => i.id === f.id ? { ...i, status: 'applied' } : i) }));
      }}>수정안 적용</Button><Button onPress={() => w.update(v => ({ ...v, feedback: v.feedback.map(i => i.id === f.id ? { ...i, status: 'ignored' } : i) }))}>무시</Button><Button onPress={onEdit}>직접 수정</Button></View>
    </View>)}
    <ThemedText type="small">대기 {pending.length}개 · 적용 {w.data.feedback.filter(f => f.status === 'applied').length}개 · 무시 {w.data.feedback.filter(f => f.status === 'ignored').length}개</ThemedText>
    {error ? <ThemedText accessibilityLiveRegion="polite">{error}</ThemedText> : null}
  </View>;
}
