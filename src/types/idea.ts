export const IdeaStatuses = ['thought', 'research', 'approved', 'selected'] as const;

export type IdeaStatus = (typeof IdeaStatuses)[number];

export const DefaultIdeaStatus: IdeaStatus = 'thought';

export const IdeaStatusLabels: Record<IdeaStatus, string> = {
  thought: '떠오른 생각',
  research: '조사 필요',
  approved: '쓸 만함',
  selected: '최종 사용',
};

export const IdeaCategories = ['planning', 'design', 'develop', 'research'] as const;

export type IdeaCategory = (typeof IdeaCategories)[number];

export const DefaultIdeaCategory: IdeaCategory = 'planning';

export const IdeaCategoryLabels: Record<IdeaCategory, string> = {
  planning: '기획',
  design: '디자인',
  develop: '개발',
  research: '자료조사',
};

export const MindMapSides = [
  'left',
  'right',
  'top',
  'bottom',
  'topleft',
  'topright',
  'bottomleft',
  'bottomright',
  'center',
] as const;

export type MindMapSide = (typeof MindMapSides)[number];

export type Idea = {
  id: string;
  projectid: string;
  userid: string;
  title: string;
  content: string;
  status: IdeaStatus;
  category: IdeaCategory;
  isfavorite: boolean;
  parentnodeid: string | null;
  x: number | null;
  y: number | null;
  side: MindMapSide | null;
  createdat: string;
  updatedat: string;
};

export type IdeaInput = {
  title: string;
  content: string;
  status: IdeaStatus;
  category: IdeaCategory;
};

export type IdeaMindMapInput = {
  parentnodeid?: string | null;
  x?: number | null;
  y?: number | null;
  side?: MindMapSide | null;
};

export function normalizeIdeaStatus(status: unknown): IdeaStatus {
  if (IdeaStatuses.includes(status as IdeaStatus)) {
    return status as IdeaStatus;
  }

  return DefaultIdeaStatus;
}

export function normalizeIdeaCategory(category: unknown): IdeaCategory {
  if (IdeaCategories.includes(category as IdeaCategory)) {
    return category as IdeaCategory;
  }

  return DefaultIdeaCategory;
}

export function normalizeMindMapSide(side: unknown): MindMapSide | null {
  if (MindMapSides.includes(side as MindMapSide)) {
    return side as MindMapSide;
  }

  return null;
}
