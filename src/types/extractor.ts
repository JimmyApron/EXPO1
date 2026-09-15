export interface ExtractedIdea {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
  details: {
    problem: string;
    targetUsers: string[];
    solution: string;
  };
}