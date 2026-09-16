import type { CandidateIdea, PresentationData, SampleMvpPlan } from './presentation';

export type ExportData = {
  projectTitle: string;
  idea: CandidateIdea;
  mvpPlan: SampleMvpPlan;
  aiAnalysis?: { strengths: string[]; risks: string[]; difficulty: string };
  teamRoles: string[];
  presentationOrder: string[];
  expectedEffects?: string;
  presentation?: PresentationData | null;
};
