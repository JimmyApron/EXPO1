export type IdeaDraftAnalysisLevel = '높음' | '보통' | '낮음';

export type IdeaDraftAnalysisInput = {
  title: string;
  content: string;
  category: string;
  status: string;
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
