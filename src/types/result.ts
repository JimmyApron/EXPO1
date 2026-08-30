export type ResultUserRole = 'leader' | 'member';

export type MvpSummary = {
  core: string;
  essentialFeatures: string[];
  laterFeatures: string[];
  schedule: string[];
  requiredApis: string[];
};

export type IdeaResult = {
  id: string;
  title: string;
  passCount: number;
  participantCount: number;
  passRate: number;
  aiRank: number;
  aiStrength: string;
  aiRisk: string;
  difficulty: string;
  mvpSummary: MvpSummary;
};

export type IdeaResultData = {
  currentParticipantCount: number;
  teamSize: number;
  currentUserEvaluatedAll: boolean;
  currentUserRole: ResultUserRole;
  ideas: IdeaResult[];
};
