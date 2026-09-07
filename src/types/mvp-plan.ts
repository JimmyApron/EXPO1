export type MvpIdea = {
  id: string;
  title: string;
  description: string;
  targetUsers: string;
  problem: string;
  solution: string;
  coreFeatures: string[];
};

export type MvpEffort = {
  difficulty: '초급' | '중급' | '고급';
  requiredSkills: string[];
  estimatedWeeks: number;
  beginnerComment: string;
};

export type MvpFeature = {
  name: string;
  description: string;
  /** Older saved plans have no effort assessment. */
  effort?: MvpEffort;
};

export type MvpScreen = {
  name: string;
  purpose: string;
  wireframe: string[];
};

export type MvpScheduleItem = {
  period: string;
  goal: string;
  tasks: string[];
};

export type MvpRole = {
  role: string;
  responsibilities: string[];
};

export type MvpApi = {
  name: string;
  purpose: string;
  method: string;
  effort?: MvpEffort;
};

export type MvpPlan = {
  ideaId: string;
  ideaTitle: string;
  summary: string;
  mustHaveFeatures: MvpFeature[];
  laterFeatures: MvpFeature[];
  screens: MvpScreen[];
  schedule: MvpScheduleItem[];
  teamRoles: MvpRole[];
  apis: MvpApi[];
  presentationOrder: string[];
};
