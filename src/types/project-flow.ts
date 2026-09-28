import type { ProjectConditions } from '@/types/candidate-idea';
import type { FinalIdeaAnalysisResult } from '@/types/final-analysis';
import type { BlindIdeaAnalysisCache } from '@/types/idea-evaluation';
import type { MvpPlan } from '@/types/mvp-plan';
import type { PresentationData } from '@/types/presentation';

export type CompleteProjectConditions = Required<ProjectConditions>;

export type ProjectFlow = {
  id: string;
  projectid: string;
  userid: string;
  durationweeks: number;
  teamsize: number;
  skilllevel: string;
  budget: number;
  evaluationcriteria: string[];
  selectedideaid: string | null;
  coachresult: FinalIdeaAnalysisResult | null;
  blindanalysis: BlindIdeaAnalysisCache | null;
  evaluationround: number;
  mvpplan: MvpPlan | null;
  presentationdata: PresentationData | null;
  createdat: string;
  updatedat: string;
};
