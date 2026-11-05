export type ProjectTemplate = 'service_app' | 'report_research' | 'writing_creative';

export type Project = {
  id: string;
  userid: string;
  roomid?: string | null;
  title: string;
  description: string;
  deadline: string | null;
  template: ProjectTemplate;
  haspresentation: boolean;
  settings?: import('../lib/topic-workspace').ProjectSettings;
  createdat: string;
  updatedat: string;
};

export type ProjectInput = {
  title: string;
  description: string;
  deadline: string;
  template: ProjectTemplate;
  hasPresentation: boolean;
  settings?: import('../lib/topic-workspace').ProjectSettings;
};
