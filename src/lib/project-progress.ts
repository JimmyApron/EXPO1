import { getProjectWorkflowState } from './project-workspace.ts';
import { getProjectStages, getStageProgress, normalizeProjectTemplate } from './project-stages.ts';
import type { ProjectStageRecord } from '../hooks/use-project-stage-progress.ts';
import type { Project } from '../types/project.ts';
import type { MvpPlan } from '../types/mvp-plan.ts';
import type { PresentationData } from '../types/presentation.ts';

export function getProjectStageSummary(
  project: Pick<Project, 'template' | 'haspresentation'>,
  ideaCount: number,
  selectedIdeaCount: number,
  flow?: { selectedideaid: string | null; mvpplan: MvpPlan | null; presentationdata: PresentationData | null } | null,
  records: ProjectStageRecord[] = [],
) {
  const stages = getProjectStages(project.template, project.haspresentation);
  const completed = normalizeProjectTemplate(project.template) === 'service_app'
    ? (() => {
        const state = getProjectWorkflowState(ideaCount, selectedIdeaCount, flow);
        return { extraction: state.hasIdeas, selection: state.hasSelectedIdea,
          mvp: state.hasCurrentMvp, presentation: state.hasCurrentPresentation };
      })()
    : Object.fromEntries(records.filter((record) => record.template === normalizeProjectTemplate(project.template))
        .map((record) => [record.stageid, record.iscompleted]));
  return { stages, completed, ...getStageProgress(stages, completed) };
}
