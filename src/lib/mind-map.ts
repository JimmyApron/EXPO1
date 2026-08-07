import type { Idea } from '@/types/idea';
import type { IdeaField, MindMapIdeaDetailsInput, MindMapNode } from '@/types/mind-map';

export const ideaFieldDefinitions: readonly {
  field: IdeaField;
  branchTitle: string;
  summary: string;
}[] = [
  { field: 'problem', branchTitle: '문제', summary: '아이디어가 해결하려는 문제' },
  { field: 'targetusers', branchTitle: '대상 사용자', summary: '아이디어의 대상 사용자' },
  { field: 'solution', branchTitle: '해결 방법', summary: '아이디어가 제안하는 해결 방법' },
  { field: 'corefeatures', branchTitle: '핵심 기능', summary: '아이디어의 핵심 기능' },
  { field: 'keywords', branchTitle: '키워드', summary: '아이디어의 핵심 키워드' },
];

export const defaultMindMapBranches = ideaFieldDefinitions.map((definition) => definition.branchTitle);

export const listIdeaFields: readonly IdeaField[] = ['targetusers', 'corefeatures', 'keywords'];

export type IdeaFieldNodeInput = {
  ideaid: string;
  ideafield: IdeaField;
  branchTitle: string;
  title: string;
  summary: string;
};

function cleanText(value: string) {
  return value.trim();
}

function cleanList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function formatList(values: string[]) {
  return cleanList(values).map((value) => `• ${value}`).join('\n');
}

export function getIdeaFieldLabel(field: IdeaField) {
  return ideaFieldDefinitions.find((definition) => definition.field === field)?.branchTitle ?? field;
}

export function isListIdeaField(field: IdeaField) {
  return listIdeaFields.includes(field);
}

/** Converts the line-based list editor into the array format stored by ideas. */
export function parseIdeaFieldLines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

/** Returns the editable text for a structured field without display-only bullets. */
export function getIdeaFieldDraftValue(idea: Idea, field: IdeaField) {
  if (field === 'targetusers' || field === 'corefeatures' || field === 'keywords') {
    return cleanList(idea[field]).join('\n');
  }
  return cleanText(idea[field]);
}

/** Applies one focused field editor value to the real structured idea field. */
export function applyIdeaFieldDraft(
  input: MindMapIdeaDetailsInput,
  field: IdeaField,
  value: string,
): MindMapIdeaDetailsInput {
  if (field === 'targetusers' || field === 'corefeatures' || field === 'keywords') {
    return { ...input, [field]: parseIdeaFieldLines(value) };
  }
  return { ...input, [field]: cleanText(value) };
}

export function validateMindMapIdeaField(input: MindMapIdeaDetailsInput, field: IdeaField) {
  const value = input[field];
  const isEmpty = Array.isArray(value) ? cleanList(value).length === 0 : cleanText(value).length === 0;
  return isEmpty ? `${getIdeaFieldLabel(field)} 내용을 입력해 주세요.` : '';
}

/** Resolves the branch that controls an add action opened on a branch or one of its children. */
export function getMindMapNodeBranch(node: MindMapNode, nodes: MindMapNode[]) {
  if (node.nodetype === 'branch') return node;
  if (!node.parentnodeid) return null;
  return nodes.find((candidate) => candidate.id === node.parentnodeid && candidate.nodetype === 'branch') ?? null;
}

export function getMindMapNodeIdeaField(node: MindMapNode, nodes: MindMapNode[]) {
  return getMindMapNodeBranch(node, nodes)?.branchfield ?? null;
}

/** Deterministically expands one idea into at most one node per populated structured field. */
export function createIdeaFieldNodes(idea: Idea): IdeaFieldNodeInput[] {
  const values: Record<IdeaField, string> = {
    problem: cleanText(idea.problem),
    targetusers: formatList(idea.targetusers),
    solution: cleanText(idea.solution),
    corefeatures: formatList(idea.corefeatures),
    keywords: formatList(idea.keywords),
  };

  return ideaFieldDefinitions.flatMap((definition) => {
    const summary = values[definition.field];
    return summary
      ? [{
          ideaid: idea.id,
          ideafield: definition.field,
          branchTitle: definition.branchTitle,
          title: idea.title,
          summary,
        }]
      : [];
  });
}

function getBranchOrder(branch: MindMapNode) {
  const fixedIndex = branch.branchfield
    ? ideaFieldDefinitions.findIndex((definition) => definition.field === branch.branchfield)
    : -1;
  return fixedIndex >= 0 ? fixedIndex : ideaFieldDefinitions.length + branch.sortorder;
}

/** Lays out each branch according to the height of its complete child list. */
export function layoutMindMapNodes(nodes: MindMapNode[]) {
  const root = nodes.find((node) => node.nodetype === 'root');
  if (!root) return nodes;

  const branches = nodes
    .filter((node) => node.nodetype === 'branch')
    .sort((left, right) => getBranchOrder(left) - getBranchOrder(right) || left.title.localeCompare(right.title));
  const childGap = 150;
  const nodeHeight = 104;
  const subtreeGap = 80;
  const branchMinimumHeight = 220;
  const branchLayouts = branches.map((branch) => {
    const children = nodes
      .filter((node) => (node.nodetype === 'idea' || node.nodetype === 'idea_field') && node.parentnodeid === branch.id)
      .sort((left, right) => left.sortorder - right.sortorder || left.title.localeCompare(right.title));
    const childrenHeight = children.length > 0 ? (children.length - 1) * childGap + nodeHeight : nodeHeight;
    return { branch, children, height: Math.max(branchMinimumHeight, childrenHeight) };
  });
  const totalHeight = branchLayouts.reduce((sum, layout) => sum + layout.height, 0)
    + Math.max(0, branchLayouts.length - 1) * subtreeGap;
  const positions = new Map<string, { x: number; y: number; sortorder: number }>();
  positions.set(root.id, { x: 0, y: 0, sortorder: 0 });

  let nextTop = -totalHeight / 2;
  branchLayouts.forEach(({ branch, children, height }, branchIndex) => {
    const branchY = nextTop + height / 2;
    positions.set(branch.id, { x: 360, y: branchY, sortorder: branchIndex });
    const childStartY = branchY - ((children.length - 1) * childGap) / 2;
    children.forEach((child, childIndex) => {
      positions.set(child.id, { x: 720, y: childStartY + childIndex * childGap, sortorder: childIndex });
    });
    nextTop += height + subtreeGap;
  });

  return nodes.map((node) => ({ ...node, ...(positions.get(node.id) ?? {}) }));
}
