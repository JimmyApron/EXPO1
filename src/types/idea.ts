export const IdeaStatuses = ['thought', 'research', 'approved', 'selected'] as const;

export type IdeaStatus = (typeof IdeaStatuses)[number];

export const DefaultIdeaStatus: IdeaStatus = 'thought';

export const IdeaStatusLabels: Record<IdeaStatus, string> = {
  thought: '떠오른 생각',
  research: '조사 필요',
  approved: '검토 완료',
  selected: '최종 사용',
};

export const IdeaCategories = ['planning', 'design', 'develop', 'research'] as const;

export type IdeaCategory = (typeof IdeaCategories)[number];

export const DefaultIdeaCategory: IdeaCategory = 'planning';

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

export const IdeaCategoryLabels: Record<IdeaCategory, string> = {
  planning: '기획',
  design: '디자인',
  develop: '개발',
  research: '자료조사',
};

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

  if (status === '떠오른 생각' || status === '?좎삤瑜??앷컖') {
    return 'thought';
  }

  if (status === '조사 필요' || status === '議곗궗 ?꾩슂') {
    return 'research';
  }

  if (status === '쓸 만함' || status === '검토 완료' || status === '??留뚰븿') {
    return 'approved';
  }

  if (status === '최종 사용' || status === '理쒖쥌 ?ъ슜') {
    return 'selected';
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
