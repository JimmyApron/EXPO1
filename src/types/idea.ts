export const IdeaStatuses = ['떠오른 생각', '조사 필요', '쓸 만함', '최종 사용'] as const;

export type IdeaStatus = (typeof IdeaStatuses)[number];

export type Idea = {
  id: string;
  projectid: string;
  userid: string;
  title: string;
  content: string;
  status: IdeaStatus;
  createdat: string;
  updatedat: string;
};

export type IdeaInput = {
  title: string;
  content: string;
  status: IdeaStatus;
};
