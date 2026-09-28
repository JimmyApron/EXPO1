export type IdeaDraftAnalysisLevel = '높음' | '보통' | '낮음';

export type IdeaDraftAnalysisInput = {
  analysisMode: 'draft_clarity' | 'problem_solution';
  title: string;
  content: string;
  category: string;
  status: string;
  summary: string;
  problem: string;
  targetUsers: string[];
  solution: string;
  keywords: string[];
  coreFeatures: string[];
};

export type IdeaDraftAnalysisResult = {
  summary: string;
  titleFeedback: string;
  contentFeedback: string;
  strengths: string[];
  improvements: string[];
  nextQuestions: string[];
  readiness: IdeaDraftAnalysisLevel;
  notice: string;
};
