export type ProjectSection = 'home' | 'ideas' | 'mindmap';
export type ProjectWorkflowStep = 'extraction' | 'selection' | 'mvp' | 'presentation';

export type ProjectWorkspaceLocation = {
  section: ProjectSection;
  step: ProjectWorkflowStep;
};

type WorkspaceParams = {
  projectView?: string | string[];
  flowStep?: string | string[];
  ideaTab?: string | string[];
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function isProjectSection(value?: string): value is ProjectSection {
  return value === 'home' || value === 'ideas' || value === 'mindmap';
}

function isProjectWorkflowStep(value?: string): value is ProjectWorkflowStep {
  return value === 'extraction' || value === 'selection' || value === 'mvp' || value === 'presentation';
}

export function resolveProjectWorkspaceLocation({ projectView, flowStep, ideaTab }: WorkspaceParams): ProjectWorkspaceLocation {
  const requestedSection = firstParam(projectView);
  const requestedStep = firstParam(flowStep);
  const legacyTab = firstParam(ideaTab)?.toLocaleLowerCase();

  if (isProjectSection(requestedSection)) {
    return {
      section: requestedSection,
      step: isProjectWorkflowStep(requestedStep) ? requestedStep : 'extraction',
    };
  }

  if (legacyTab === 'list' || legacyTab === 'ideas') return { section: 'ideas', step: 'extraction' };
  if (legacyTab === 'mindmap' || legacyTab === 'mind-map') return { section: 'mindmap', step: 'extraction' };
  if (legacyTab === 'coach' || legacyTab === 'final' || legacyTab === 'selection') {
    return { section: 'home', step: 'selection' };
  }
  if (legacyTab === 'mvp') return { section: 'home', step: 'mvp' };
  if (legacyTab === 'presentation') return { section: 'home', step: 'presentation' };
  if (legacyTab === 'extraction' || legacyTab === 'extract') return { section: 'home', step: 'extraction' };

  return {
    section: 'home',
    step: isProjectWorkflowStep(requestedStep) ? requestedStep : 'extraction',
  };
}

export type ProjectWorkflowState = {
  hasIdeas: boolean;
  hasSelectedIdea: boolean;
  hasCurrentMvp: boolean;
  hasCurrentPresentation: boolean;
};

export function getNextProjectWorkflowStep(state: ProjectWorkflowState): ProjectWorkflowStep {
  if (!state.hasIdeas) return 'extraction';
  if (!state.hasSelectedIdea) return 'selection';
  if (!state.hasCurrentMvp) return 'mvp';
  return 'presentation';
}

export function getProjectProgressLabel(state: ProjectWorkflowState) {
  if (state.hasCurrentPresentation) return '최종 결과물 완성';
  if (state.hasCurrentMvp) return '발표자료 준비 중';
  if (state.hasSelectedIdea) return 'MVP 기획 중';
  if (state.hasIdeas) return 'AI 비교·선정 중';
  return '아이디어 추출 중';
}
