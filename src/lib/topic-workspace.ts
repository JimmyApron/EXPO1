import type { Idea, IdeaInput } from '../types/idea.ts';
import type { ProjectTemplate } from '../types/project.ts';
import { normalizeProjectTemplate } from './project-stages.ts';

export const WRITING_KINDS = [
  { id: 'essay', label: '에세이·수필' }, { id: 'fiction', label: '소설·이야기' },
  { id: 'script', label: '대본·시나리오' }, { id: 'poetry', label: '시·문학' },
  { id: 'free', label: '자유 글쓰기' },
] as const;
export const REPORT_KINDS = ['조사형', '비교·분석형', '문헌연구형', '실험·관찰형', '기타'] as const;
export type WritingKind = typeof WRITING_KINDS[number]['id'];
export type ProjectSettings = {
  reportKind: string; writingKind: WritingKind; targetLength: number | null;
  lengthUnit: 'characters' | 'pages'; citationStyle: string; customCitation: string;
  requirements: string; audience: string; purpose: string; tone: string; requiredElements: string;
};
export function normalizeProjectSettings(value?: unknown): ProjectSettings {
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const str = (key: string, fallback = '') => typeof v[key] === 'string' ? v[key] as string : fallback;
  return {
    reportKind: REPORT_KINDS.includes(v.reportKind as typeof REPORT_KINDS[number]) ? str('reportKind') : '조사형',
    writingKind: WRITING_KINDS.some(k => k.id === v.writingKind) ? v.writingKind as WritingKind : 'essay',
    targetLength: typeof v.targetLength === 'number' && Number.isFinite(v.targetLength) && v.targetLength > 0 ? v.targetLength : null,
    lengthUnit: v.lengthUnit === 'pages' ? 'pages' : 'characters',
    citationStyle: ['APA', 'MLA', 'IEEE', '직접 설정', '지정 없음'].includes(str('citationStyle')) ? str('citationStyle') : '지정 없음',
    customCitation: str('customCitation'), requirements: str('requirements'), audience: str('audience'),
    purpose: str('purpose'), tone: str('tone'), requiredElements: str('requiredElements'),
  };
}
export type TopicDetails = { purpose: string; questions: string; scope: string; message: string; mood: string; development: string };
export function normalizeTopicDetails(value?: unknown): TopicDetails {
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(['purpose', 'questions', 'scope', 'message', 'mood', 'development'].map(key => [key, typeof v[key] === 'string' ? v[key] : ''])) as TopicDetails;
}
export function getTopicLabels(template?: string | null) {
  switch (normalizeProjectTemplate(template)) {
    case 'report_research': return { item: '조사 주제', list: '조사 주제 목록', map: '조사 마인드맵', title: '조사 주제', description: '주제 설명' };
    case 'writing_creative': return { item: '소재', list: '소재 목록', map: '창작 마인드맵', title: '소재 제목', description: '소재 설명' };
    default: return { item: '아이디어', list: '아이디어 목록', map: '마인드맵', title: '아이디어 제목', description: '아이디어 내용' };
  }
}
export function getTopicFields(template: ProjectTemplate): { key: keyof TopicDetails; label: string }[] {
  return template === 'report_research'
    ? [{ key: 'purpose', label: '조사 목적' }, { key: 'questions', label: '핵심 질문' }, { key: 'scope', label: '조사 범위' }]
    : template === 'writing_creative'
      ? [{ key: 'message', label: '핵심 메시지' }, { key: 'mood', label: '분위기' }, { key: 'development', label: '전개 아이디어' }]
      : [];
}
export function getTopicBranches(template: ProjectTemplate, kind: WritingKind = 'essay') {
  if (template === 'report_research') return ['조사 배경', '핵심 질문', '주요 키워드', '조사 범위', '관련 자료·근거'];
  if (template === 'service_app') return ['문제', '대상 사용자', '해결 방법'];
  return {
    fiction: ['등장인물', '배경', '주요 사건', '갈등', '전개', '결말'],
    essay: ['핵심 메시지', '경험', '생각', '사례', '마무리'],
    script: ['인물', '장소', '장면', '사건', '대사'],
    poetry: ['중심 정서', '이미지', '표현', '주요 구절'], free: [],
  }[kind];
}
export function topicSearchText(idea: Idea) {
  return [idea.title, idea.content, idea.summary, idea.problem, idea.solution, ...idea.keywords,
    ...idea.corefeatures, ...idea.targetusers, ...Object.values(normalizeTopicDetails(idea.details))].join(' ');
}
export function topicIdeaInput(idea: Idea): IdeaInput {
  return { ...idea, details: normalizeTopicDetails(idea.details) };
}
