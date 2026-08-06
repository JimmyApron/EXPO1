export type MvpIdea = {
  id: string;
  title: string;
  description: string;
  targetUsers: string;
};

export type MvpFeature = {
  name: string;
  description: string;
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
