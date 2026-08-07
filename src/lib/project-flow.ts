import type { ProjectConditions } from '@/types/candidate-idea';
import type { FinalIdeaAnalysisResult } from '@/types/final-analysis';
import type { Idea } from '@/types/idea';
import type { MvpPlan } from '@/types/mvp-plan';
import type { PresentationData } from '@/types/presentation';

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cleanList(values?: string[]) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

export function createCoachInputFingerprint(ideas: Idea[], conditions: ProjectConditions) {
  const snapshot = {
    conditions: {
      budget: conditions.budget,
      durationWeeks: conditions.durationWeeks,
      evaluationCriteria: cleanList(conditions.evaluationCriteria),
      skillLevel: conditions.skillLevel?.trim() ?? '',
      teamSize: conditions.teamSize,
    },
    ideas: ideas
      .map((idea) => ({
        content: idea.content.trim(),
        coreFeatures: cleanList(idea.corefeatures),
        id: idea.id,
        keywords: cleanList(idea.keywords),
        problem: idea.problem.trim(),
        solution: idea.solution.trim(),
        summary: idea.summary.trim(),
        targetUsers: cleanList(idea.targetusers),
        title: idea.title.trim(),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };

  return `v1-${hashText(JSON.stringify(snapshot))}`;
}

export function isCoachAnalysisStale(
  analysis: FinalIdeaAnalysisResult | null | undefined,
  currentFingerprint: string,
) {
  return Boolean(analysis?.inputFingerprint && analysis.inputFingerprint !== currentFingerprint);
}

export function isMvpPlanCurrent(plan: MvpPlan | null | undefined, selectedIdeaId: string | null | undefined) {
  return Boolean(plan && selectedIdeaId && plan.ideaId === selectedIdeaId);
}

export function isPresentationCurrent(
  presentation: PresentationData | null | undefined,
  selectedIdeaId: string | null | undefined,
  mvpPlan: MvpPlan | null | undefined,
) {
  if (!presentation || !selectedIdeaId || !isMvpPlanCurrent(mvpPlan, selectedIdeaId)) return false;
  return !presentation.ideaId || presentation.ideaId === selectedIdeaId;
}
