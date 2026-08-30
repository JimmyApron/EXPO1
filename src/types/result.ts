export type MvpSummary = {
  core: string;
  essentialFeatures: string[];
  laterFeatures: string[];
  schedule: string[];
  requiredApis: string[];
};

export type IdeaResult = {
  id: string;
  label: string;
  passCount: number;
  participantCount: number;
  passRate: number;
  aiRank: number | null;
  aiAdvantages: string[];
  aiRisk: string;
  difficulty: string;
};

export type IdeaResultData = {
  currentParticipantCount: number;
  ideas: IdeaResult[];
};
