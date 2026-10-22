import type { DocumentWorkspace, ManuscriptVersion, OutlineItem, ResearchResource } from '../types/document-workspace.ts';
import type { ProjectSettings } from './topic-workspace.ts';
import type { ProjectTemplate } from '../types/project.ts';
import type { ProjectStageId } from './project-stages.ts';

// These IDs identify local document sections, not credentials or access tokens.
// Hermes may lack Web Crypto; persisted cards themselves use database UUIDs.
export function workspaceId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 3) | 8).toString(16);
  });
}
export function emptyWorkspace(title = ''): DocumentWorkspace {
  return { schemaVersion: 1, selectedIdeaId: null, title, subtitle: '', resources: [], evidence: [], resourceComparison: '',
    outline: [], freeBody: '', versions: [], feedback: [], finalVersionId: null, finalFingerprint: '', finalTopicUpdatedAt: '',
    slides: [], qna: '', presentationFingerprint: '', presentation: { minutes: '5', slideCount: '8', purpose: '', audience: '', style: '', theme: 'minimal-light' }, legacyNotes: {}, reviewChecks: {} };
}
export function normalizeWorkspace(value: unknown, title = ''): DocumentWorkspace {
  const base = emptyWorkspace(title);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  const v = value as Partial<DocumentWorkspace>;
  return { ...base, ...v, schemaVersion: 1, presentation: { ...base.presentation, ...v.presentation },
    resources: Array.isArray(v.resources) ? v.resources : [], evidence: Array.isArray(v.evidence) ? v.evidence : [],
    outline: Array.isArray(v.outline) ? v.outline.map(x => ({ ...newOutlineItem(x.title, x.parentId, x.id), ...x })) : [],
    feedback: Array.isArray(v.feedback) ? v.feedback : [], versions: Array.isArray(v.versions) ? v.versions : [], slides: Array.isArray(v.slides) ? v.slides : [] };
}
export function newOutlineItem(title: string, parentId: string | null = null, id: string = workspaceId()): OutlineItem {
  return { id, title, parentId, guidance: '', targetLength: null, resourceIds: [], evidenceIds: [], body: '', completed: false, collapsed: false };
}
export function defaultOutline(template: ProjectTemplate, settings: ProjectSettings) {
  if (template === 'report_research') {
    const main = settings.reportKind === '비교·분석형' ? ['비교 기준', '대상별 분석', '공통점과 차이점']
      : settings.reportKind === '실험·관찰형' ? ['연구 방법', '관찰·실험 결과', '결과 해석']
      : settings.reportKind === '문헌연구형' ? ['문헌 검토', '주요 논점 분석', '종합 논의'] : ['조사 방법', '조사 결과 및 분석'];
    return ['서론', ...main, '결론', '참고문헌'].map(t => newOutlineItem(t));
  }
  return ({ essay: ['도입', '주요 경험·생각', '핵심 메시지', '마무리·성찰'],
    fiction: ['세계관·배경', '등장인물', '주요 사건', '갈등', '전개', '결말'],
    script: ['장면 1 · 장소 / 인물 / 행동 / 대사 / 전환'],
    poetry: ['중심 정서', '핵심 이미지', '표현 방식', '주요 구절', '전체 구성'], free: [] }[settings.writingKind]).map(t => newOutlineItem(t));
}
export function outlineDescendants(items: OutlineItem[], id: string): Set<string> {
  const ids = new Set([id]);
  let size = 0;
  while (size !== ids.size) { size = ids.size; items.forEach(i => { if (i.parentId && ids.has(i.parentId)) ids.add(i.id); }); }
  return ids;
}
export function moveOutline(items: OutlineItem[], id: string, direction: -1 | 1) {
  const item = items.find(i => i.id === id);
  if (!item) return items;
  const siblings = items.filter(i => i.parentId === item.parentId);
  const target = siblings[siblings.indexOf(item) + direction];
  if (!target) return items;
  const aIds = outlineDescendants(items, id), bIds = outlineDescendants(items, target.id);
  const a = items.filter(i => aIds.has(i.id)), b = items.filter(i => bIds.has(i.id));
  const result: OutlineItem[] = [];
  items.forEach(i => { if (i.id === id) result.push(...b); else if (i.id === target.id) result.push(...a); else if (!aIds.has(i.id) && !bIds.has(i.id)) result.push(i); });
  return result;
}
export function manuscriptText(w: Pick<DocumentWorkspace, 'title' | 'subtitle' | 'outline' | 'freeBody'>) {
  return [w.title ? `# ${w.title}` : '', w.subtitle, w.freeBody, ...w.outline.map(i => `## ${i.title}\n\n${i.body}`)].filter(Boolean).join('\n\n');
}
export function manuscriptCount(w: DocumentWorkspace) { return [...[w.freeBody, ...w.outline.map(i => i.body)].join('')].length; }
export function manuscriptFingerprint(w: DocumentWorkspace) {
  return JSON.stringify([w.title, w.subtitle, w.selectedIdeaId, w.freeBody, w.outline.map(i => [i.id, i.parentId, i.title, i.body, i.evidenceIds, i.resourceIds]),
    w.resources.filter(r => r.used || w.outline.some(i => i.resourceIds.includes(r.id))).map(r => [r.id, r.title, r.source, r.author, r.date, r.url]), w.evidence.map(e => [e.id, e.content, e.resourceId, e.quote])]);
}
export function snapshot(w: DocumentWorkspace, label: string): ManuscriptVersion {
  return { id: workspaceId(), label, createdAt: new Date().toISOString(), title: w.title, subtitle: w.subtitle,
    outline: structuredClone(w.outline), freeBody: w.freeBody };
}
export function restoreVersion(w: DocumentWorkspace, version: ManuscriptVersion): DocumentWorkspace {
  return { ...w, title: version.title, subtitle: version.subtitle, outline: structuredClone(version.outline), freeBody: version.freeBody,
    versions: [...w.versions, snapshot(w, '복원 직전 원고')], finalVersionId: null };
}
export function citationDraft(r: ResearchResource, style: string, index = 1) {
  const missing = [!r.author && '작성자·기관', !r.date && '발행일', !r.source && '출처명'].filter(Boolean);
  const author = r.author || '[작성자 확인 필요]', date = r.date || '[발행일 확인 필요]';
  const text = style === 'IEEE' ? `[${index}] ${author}, “${r.title},” ${r.source}, ${date}. ${r.url}`
    : style === 'MLA' ? `${author}. “${r.title}.” ${r.source}, ${date}, ${r.url}.`
    : `${author}. (${date}). ${r.title}. ${r.source}. ${r.url}`;
  return { text: text.trim(), missing };
}
export function stageValidation(w: DocumentWorkspace, template: ProjectTemplate, stage: ProjectStageId, selectedExists: boolean) {
  if (stage === 'extraction' && !selectedExists) return '목록에 등록한 주제·소재를 최종 선택해 주세요.';
  if (stage === 'selection' && template === 'report_research' && !w.resources.some(r => r.title.trim() && (r.content.trim() || r.url.trim()))) return '제목과 본문 또는 URL이 있는 조사 자료를 등록해 주세요.';
  const outlineStage = template === 'report_research' ? 'mvp' : 'selection';
  if (stage === outlineStage && !w.outline.some(i => i.title.trim())) return '목차·개요 항목을 하나 이상 작성해 주세요.';
  if ((stage === 'draft' || stage === 'result' || stage === 'revision') && !manuscriptCount(w)) return '원고를 먼저 작성해 주세요. AI 실행은 필수가 아닙니다.';
  if (stage === 'presentation' && !w.slides.some(s => s.title.trim() && s.content.trim())) return '발표 슬라이드의 제목과 내용을 작성해 주세요.';
  return '';
}
