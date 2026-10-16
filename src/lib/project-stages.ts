import type { ProjectTemplate } from '../types/project.ts';

export type ProjectStageId = 'extraction' | 'selection' | 'mvp' | 'draft' | 'revision' | 'result' | 'presentation';
export type ProjectStage = { id: ProjectStageId; label: string };

export const PROJECT_TEMPLATES: { id: ProjectTemplate; label: string }[] = [
  { id: 'service_app', label: '서비스·앱 기획' },
  { id: 'report_research', label: '보고서·조사' },
  { id: 'writing_creative', label: '글쓰기·창작' },
];

export function normalizeProjectTemplate(value?: string | null): ProjectTemplate {
  return PROJECT_TEMPLATES.find((item) => item.id === value)?.id ?? 'service_app';
}

export function getProjectStages(template?: string | null, hasPresentation = true): ProjectStage[] {
  const selected = normalizeProjectTemplate(template);
  const stages: ProjectStage[] = selected === 'service_app'
    ? [
        { id: 'extraction', label: '아이디어 도출' },
        { id: 'selection', label: '비교·선정' },
        { id: 'mvp', label: 'MVP 기획' },
      ]
    : selected === 'report_research'
      ? [
          { id: 'extraction', label: '주제 선정' },
          { id: 'selection', label: '자료·핵심 내용 정리' },
          { id: 'mvp', label: '목차 구성' },
          { id: 'result', label: '결과물 작성' },
        ]
      : [
          { id: 'extraction', label: '주제·소재 정하기' },
          { id: 'selection', label: '개요/표현 방향' },
          { id: 'draft', label: '초안 작성' },
          { id: 'revision', label: 'AI 피드백·수정' },
          { id: 'result', label: '최종 결과물' },
        ];
  return hasPresentation ? [...stages, { id: 'presentation', label: '발표자료' }] : stages;
}

export function getStageProgress(
  stages: ProjectStage[],
  completed: Partial<Record<ProjectStageId, boolean>>,
) {
  const completedStageCount = stages.filter((stage) => completed[stage.id] === true).length;
  const totalStageCount = stages.length;
  const currentStage = stages.find((stage) => !completed[stage.id]) ?? stages[stages.length - 1];
  return { currentStage, completedStageCount, totalStageCount,
    percent: totalStageCount ? Math.round(completedStageCount / totalStageCount * 100) : 0 };
}

export function getValidStageId(stages: ProjectStage[], requested?: string | null): ProjectStageId {
  return stages.find((stage) => stage.id === requested)?.id ?? stages[0].id;
}
