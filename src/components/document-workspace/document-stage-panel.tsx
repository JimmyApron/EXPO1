import { useState } from 'react';
import { ActivityIndicator, View, useWindowDimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { getTopicFields, getTopicLabels, normalizeTopicDetails, topicSearchText, WRITING_KINDS, type ProjectSettings } from '@/lib/topic-workspace';
import { manuscriptCount, stageValidation } from '@/lib/document-workspace';
import type { ProjectStage, ProjectStageId } from '@/lib/project-stages';
import type { ProjectStageRecord } from '@/hooks/use-project-stage-progress';
import { useWorkspaceAssistant, type WorkspaceAiResult } from '@/hooks/use-workspace-assistant';
import type { Idea, IdeaInput } from '@/types/idea';
import type { ProjectTemplate } from '@/types/project';
import type { MindMapNode } from '@/types/mind-map';
import { saveFile } from '@/utils/export/saveFile';
import { ReportResourceLibrary } from './report-resource-library';
import { OutlineEditor } from './outline-editor';
import { DocumentEditor } from './document-editor';
import { ProjectResultPanel } from './project-result-panel';
import { WritingFeedbackPanel } from './writing-feedback-panel';
import { WorkspacePresentation } from './workspace-presentation';
import { WorkspaceButton as Button, WorkspaceField as Field, WorkspacePanel, WorkspaceConfirmProvider, workspaceStyles as s, useWorkspaceConfirm } from './controls';
import type { WorkspaceController } from './types';

type Props = {
  template: ProjectTemplate; projectId: string; projectTitle: string; settings: ProjectSettings;
  stage: ProjectStageId; stages: ProjectStage[]; records: ProjectStageRecord[]; workspace: WorkspaceController;
  ideas: Idea[]; selectedIdea: Idea | null; mindMapNodes: MindMapNode[];
  onOpenList: () => void; onOpenMap: () => void; onEditIdea: (id: string) => void; onAddIdea: () => void;
  onNavigate: (stage: ProjectStageId) => void;
  onSaveStage: (stage: ProjectStageId, content: string, completed: boolean) => Promise<{ error?: string }>;
  onCreateIdea: (input: IdeaInput) => Promise<{ idea?: Idea; error?: string }>;
  onSetTopic: (title: string) => Promise<{ error?: string }>;
};
function DocumentStagePanelContent({ template, projectId, projectTitle, settings, stage, stages, records, workspace: w, ideas, selectedIdea, mindMapNodes, onOpenList, onOpenMap, onEditIdea, onAddIdea, onNavigate, onSaveStage, onCreateIdea, onSetTopic }: Props) {
  const ai = useWorkspaceAssistant(projectId), report = template === 'report_research', labels = getTopicLabels(template);
  const confirmWorkspaceAction = useWorkspaceConfirm();
  const { width } = useWindowDimensions();
  const [supportOpen, setSupportOpen] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<WorkspaceAiResult | null>(null), [topicPrompt, setTopicPrompt] = useState('');
  const stageIndex = stages.findIndex(s => s.id === stage), record = records.find(r => r.stageid === stage && r.template === template);
  const bodyStage = report ? 'result' : 'draft';
  async function saveStage(completed = Boolean(record?.iscompleted)) {
    if (busy) return false;
    const validation = completed ? stageValidation(w.data, template, stage, Boolean(selectedIdea && w.data.selectedIdeaId === selectedIdea.id)) : '';
    if (validation) { setError(validation); return false; }
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await w.save();
      if (saved.error) { setError(saved.error); return false; }
      const result = await onSaveStage(stage, `${stages[stageIndex].label} · ${ideas.length}개 후보 · 자료 ${w.data.resources.length}개 · 개요 ${w.data.outline.length}개 · 원고 ${manuscriptCount(w.data)}자`, completed);
      if (result.error) { setError(result.error); return false; }
      setNotice(completed ? '단계를 완료했습니다.' : '저장했습니다.'); return true;
    } finally { setBusy(false); }
  }
  async function navigate(target: ProjectStageId) { const result = await w.save(); if (result.error) { setError(result.error); return; } onNavigate(target); }
  async function selectTopic(idea: Idea) {
    w.update(v => ({ ...v, selectedIdeaId: idea.id }));
    const saved = await w.save();
    if (saved.error) { setError(saved.error); return; }
    const mapped = await onSetTopic(idea.title); if (mapped.error) setError(mapped.error);
  }
  const context = { selectedTopic: selectedIdea, settings, mindMap: mindMapNodes.map(n => ({ type: n.nodetype, title: n.title, summary: n.summary, parentId: n.parentnodeid })) };
  if (w.loading) return <WorkspacePanel title="작업 공간 불러오는 중"><ActivityIndicator /></WorkspacePanel>;
  return <WorkspacePanel title={stages[stageIndex]?.label || '과제 작업 공간'}>
    <ThemedText type="small" themeColor="textSecondary">{projectTitle} · {report ? settings.reportKind : WRITING_KINDS.find(k => k.id === settings.writingKind)?.label} · {w.status}</ThemedText>
    {w.error ? <View style={s.group}><ThemedText accessibilityRole="alert">{w.error}</ThemedText><View style={s.row}>
      <Button onPress={() => { void saveFile(JSON.stringify(w.data, null, 2), `${projectTitle}_기기초안.json`, 'application/json').catch(e => setError(e.message)); }}>현재 초안 내려받기</Button>
      <Button onPress={() => confirmWorkspaceAction('기기 초안을 서버 최신 내용으로 바꿀까요? 필요한 초안은 먼저 내려받아 주세요.', () => { void w.reload(); })}>서버 최신 내용 불러오기</Button>
    </View></View> : null}
    <View style={{ flexDirection: width >= 1100 && supportOpen ? 'row' : 'column', alignItems: 'stretch', gap: 20 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 16 }}>
        {stage === 'extraction' ? <View style={s.group}>
          <ThemedText type="body">{report ? '조사할 주제를 모으고 목적·핵심 질문·범위를 정하세요.' : '소재를 모으고 핵심 메시지·분위기·전개 방향을 정하세요.'} 목록과 마인드맵에서 같은 카드를 사용합니다.</ThemedText>
          <View style={s.row}><Button onPress={onOpenList}>{labels.list}</Button><Button onPress={onOpenMap}>{labels.map}</Button><Button onPress={onAddIdea}>{`${labels.item} 추가`}</Button></View>
          {!ideas.length ? <ThemedText type="small" themeColor="textSecondary">먼저 후보를 추가하세요. 예: {report ? '대학생의 수면과 학습 습관의 관계' : '오랜만에 돌아온 동네에서 발견한 편지'}</ThemedText> : null}
          {ideas.map(idea => <View key={idea.id} style={s.item}><ThemedText type="smallBold">{idea.title}</ThemedText><ThemedText>{idea.content}</ThemedText>
            <View style={s.row}><Button selected={w.data.selectedIdeaId === idea.id} disabled={busy} onPress={() => void selectTopic(idea)}>{w.data.selectedIdeaId === idea.id ? '최종 선택됨' : `${labels.item} 최종 선택`}</Button><Button onPress={() => onEditIdea(idea.id)}>내용 수정</Button></View>
          </View>)}
          {selectedIdea ? <View style={s.group}><ThemedText type="smallBold">{report ? '확정 주제와 조사 계획' : '확정 소재와 작성 방향'}: {selectedIdea.title}</ThemedText>
            {getTopicFields(template).map(field => <ThemedText key={field.key} type="small">{field.label}: {normalizeTopicDetails(selectedIdea.details)[field.key] || '미입력'}</ThemedText>)}
            <ThemedText type="small">키워드: {selectedIdea.keywords.join(', ') || '미입력'}</ThemedText>
            <Button onPress={() => onEditIdea(selectedIdea.id)}>계획·방향 편집</Button>
          </View> : null}
          <Field label={report ? 'AI로 구체화할 주제·질문' : 'AI로 확장·조합할 소재와 전개 방향'} value={topicPrompt} onChangeText={setTopicPrompt} />
          <Button disabled={ai.busy || (!topicPrompt.trim() && !ideas.length)} onPress={async () => setSuggestions(await ai.request('topics', { ...context, prompt: topicPrompt, candidates: ideas.map(i => ({ title: i.title, content: i.content, keywords: i.keywords })) }))}>{report ? 'AI 주제 구체화·핵심 질문 추천' : 'AI 소재 확장·조합·제목 추천'}</Button>
          {suggestions ? <View style={s.group}><ThemedText>{suggestions.text}</ThemedText>{suggestions.suggestions.map((suggestion, index) => <View key={index} style={s.item}>
            <Field label="추천 제목 (수정 가능)" value={suggestion.title} onChangeText={title => setSuggestions(v => v ? { ...v, suggestions: v.suggestions.map((i, n) => n === index ? { ...i, title } : i) } : v)} />
            <Field label="추천 내용 (수정 가능)" value={suggestion.text} onChangeText={text => setSuggestions(v => v ? { ...v, suggestions: v.suggestions.map((i, n) => n === index ? { ...i, text } : i) } : v)} />
            <Button disabled={busy} onPress={async () => { setBusy(true); try { const result = await onCreateIdea({ title: suggestion.title, content: suggestion.text, status: 'thought', category: report ? 'research' : 'planning' }); if (result.error) setError(result.error); else setSuggestions(v => v ? { ...v, suggestions: v.suggestions.filter((_, n) => n !== index) } : v); } finally { setBusy(false); } }}>{`${labels.list}에 추가`}</Button>
          </View>)}</View> : null}
        </View> : null}
        {report && stage === 'selection' ? <ReportResourceLibrary workspace={w} assistant={ai} topic={selectedIdea} /> : null}
        {stage === (report ? 'mvp' : 'selection') ? <OutlineEditor template={template} settings={settings} workspace={w} assistant={ai} context={context} /> : null}
        {stage === bodyStage ? <DocumentEditor template={template} settings={settings} workspace={w} assistant={ai} /> : null}
        {stage === 'revision' ? <WritingFeedbackPanel workspace={w} assistant={ai} settings={settings} onEdit={() => void navigate(bodyStage)} /> : null}
        {(report && stage === 'revision') || (!report && stage === 'result') ? <ProjectResultPanel workspace={w} settings={settings} report={report} topicUpdatedAt={selectedIdea ? topicSearchText(selectedIdea) : ''} onEdit={() => void navigate(bodyStage)} onResources={() => void navigate('selection')} /> : null}
        {stage === 'presentation' ? <WorkspacePresentation workspace={w} assistant={ai} report={report} /> : null}
      </View>
      {supportOpen ? <View style={{ width: width >= 1100 ? 280 : '100%', gap: 12 }}>
        <ThemedText type="smallBold">이전 단계 참고 자료</ThemedText><ThemedText type="small">{selectedIdea?.title || '아직 최종 선택한 주제·소재가 없습니다.'}</ThemedText>
        {selectedIdea ? <ThemedText type="small">{selectedIdea.content}</ThemedText> : null}
        {mindMapNodes.filter(n => n.nodetype !== 'root').map(n => <ThemedText key={n.id} type="small">{n.title}{n.summary ? ` · ${n.summary}` : ''}</ThemedText>)}
        <Button onPress={onOpenMap}>{labels.map}</Button>
        {Object.entries(w.data.legacyNotes).map(([id, text]) => <View key={id}><ThemedText type="smallBold">이전 버전에서 저장한 내용 · {id}</ThemedText><ThemedText selectable type="small">{text}</ThemedText></View>)}
      </View> : null}
    </View>
    <Button onPress={() => setSupportOpen(!supportOpen)}>{supportOpen ? '참고 자료 접기' : '주제·소재 / 마인드맵 / 이전 저장 내용 보기'}</Button>
    <View style={s.row}>
      <Button disabled={stageIndex === 0 || busy} onPress={() => void navigate(stages[stageIndex - 1].id)}>이전 단계</Button>
      <Button disabled={busy} onPress={() => void saveStage()}>저장</Button>
      <Button disabled={busy} selected={record?.iscompleted} onPress={() => void saveStage(!record?.iscompleted)}>{record?.iscompleted ? '완료 취소' : '단계 완료'}</Button>
      <Button disabled={stageIndex === stages.length - 1 || busy} onPress={() => void navigate(stages[stageIndex + 1].id)}>다음 단계</Button>
    </View>
    {ai.busy || busy ? <ActivityIndicator /> : null}
    {error || (stage !== bodyStage && ai.error) ? <ThemedText accessibilityRole="alert">{error || ai.error}</ThemedText> : null}
    {notice ? <ThemedText accessibilityLiveRegion="polite">{notice}</ThemedText> : null}
  </WorkspacePanel>;
}

export function DocumentStagePanel(props: Props) {
  return <WorkspaceConfirmProvider><DocumentStagePanelContent {...props} /></WorkspaceConfirmProvider>;
}
