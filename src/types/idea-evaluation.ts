export type EvaluationChoice = 'pass' | 'pick';

export type IdeaAnalysis = {
  id: string;
  anonymousLabel: string;
  problem: string;
  solution: string;
  advantages: [string, string];
  risk: string;
  difficulty: '쉬움' | '보통' | '어려움';
};

export type BlindIdeaAiAnalysis = {
  ideaId: string;
  advantages: [string, string];
  risk: string;
  difficulty: IdeaAnalysis['difficulty'];
};

export type IdeaEvaluation = {
  ideaId: string;
  userId: string;
  choice: EvaluationChoice;
  createdAt: string;
  locked: true;
};

export type StoredIdeaEvaluation = IdeaEvaluation & {
  id: string;
  projectId: string;
};

export type IdeaResultForComparison = {
  currentParticipantCount: number;
  ideaId: string;
  anonymousLabel: string;
  pickCount: number;
  participantCount: number;
  passRate: number;
  aiAdvantages: string[];
  aiRisk: string;
  difficulty: string;
};
