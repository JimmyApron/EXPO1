export interface ProjectConditions {
  durationWeeks: number;
  teamSize: number;
  skillLevel: string;
  budget: number;
  evaluationCriteria: string[];
}

export interface CandidateIdea {
  id: string;
  title: string;
  summary: string;
  problem: string;
  targetUsers: string[];
  solution: string;
  keywords: string[];
  coreFeatures: string[];
}

export interface SampleMvpPlan {
  essentialFeatures: string[];
  laterFeatures: string[];
  screens: string[];
  schedule: string[];
  requiredApis: string[];
}

export interface PresentationData {
  presentationTitle: string;
  slides: {
    slideNumber: number;
    title: string;
    bulletPoints: string[];
    speakerScript: string;
  }[];
  expectedQna: {
    question: string;
    answer: string;
  }[];
  businessPlanDraft: string;
  finalReport: string;
}

export type PresentationSlideType = 'title' | 'bullet' | 'code' | 'image';

export type PresentationSlide = {
  id: string;
  type: PresentationSlideType;
  title: string;
  content: string;
  accent?: string;
};

export type Presentation = {
  id: string;
  title: string;
  description: string;
  slides: PresentationSlide[];
  createdAt: string;
  updatedAt: string;
};

export type PresentationInput = {
  title: string;
  description: string;
  slides: PresentationSlide[];
};

export type PresentationSummary = {
  id: string;
  title: string;
  slideCount: number;
  updatedAt: string;
};
