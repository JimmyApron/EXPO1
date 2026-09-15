export type MindMap = {
  id: string;
  projectid: string;
  userid: string;
  title: string;
  createdat: string;
  updatedat: string;
};

export const IdeaFields = ['problem', 'targetusers', 'solution', 'corefeatures', 'keywords'] as const;

export type IdeaField = (typeof IdeaFields)[number];

export type MindMapNodeType = 'root' | 'branch' | 'idea' | 'idea_field';

export type MindMapNode = {
  id: string;
  mindmapid: string;
  parentnodeid: string | null;
  ideaid: string | null;
  ideafield: IdeaField | null;
  branchfield: IdeaField | null;
  nodetype: MindMapNodeType;
  title: string;
  summary: string;
  x: number;
  y: number;
  sortorder: number;
  createdat: string;
  updatedat: string;
};

export type MindMapComposeOptions = {
  topic: string;
  replace?: boolean;
};

export type MindMapIdeaDetailsInput = {
  title: string;
  summary: string;
  problem: string;
  targetusers: string[];
  solution: string;
  corefeatures: string[];
  keywords: string[];
};
