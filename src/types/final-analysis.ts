export type FinalAnalysisLevel = '높음' | '보통' | '낮음';

export type FinalIdeaAnalysisInput = {
  ideaId: string;
  title: string;
  content: string;
  category: string;
  status: string;
};

export type FinalIdeaAnalysis = {
  ideaId: string;
  title: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  feasibility: FinalAnalysisLevel;
  projectFit: FinalAnalysisLevel;
};

export type FinalIdeaAnalysisResult = {
  analyses: FinalIdeaAnalysis[];
  overall: {
    comparison: string;
    recommendedIdeaIds: string[];
    recommendationReason: string;
    combinationSuggestion: string;
  };
  notice: string;
};
