export type CandidateIdea = {
  id: string;
  title: string;
  summary: string;
  problem: string;
  targetUsers: string[];
  solution: string;
  keywords: string[];
  coreFeatures: string[];
};

export type CandidateIdeasPayload = {
  candidateIdeas: CandidateIdea[];
};

export type CandidateIdeaImage = {
  uri: string;
  width: number;
  height: number;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  data: string;
};

export type ProjectConditions = {
  durationWeeks?: number;
  teamSize?: number;
  skillLevel?: string;
  budget?: number;
  evaluationCriteria?: string[];
};

export type ExtractCandidateIdeasRequest = {
  projectId: string;
  source:
    | { type: 'text'; text: string }
    | { type: 'image'; images: Omit<CandidateIdeaImage, 'uri' | 'width' | 'height'>[] };
  projectConditions?: ProjectConditions;
};

export type ExtractCandidateIdeasResponse = CandidateIdeasPayload & {
  extractedText: string;
};

export type CandidateIdeaSaveResult = {
  savedCandidateIds: string[];
  failures: { candidateId: string; title: string; message: string }[];
};
