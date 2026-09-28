import type { Idea } from '../types/idea';
import type { MindMapNode } from '../types/mind-map';

export type ExportNode = {
  id: string;
  title: string;
  summary: string;
  details: { label: string; values: string[] }[];
  children: ExportNode[];
};

export type MindMapExportPayload = { title: string; roots: ExportNode[] };

const fields = [
  ['problem', '문제'],
  ['targetusers', '타깃 사용자'],
  ['solution', '해결 방식'],
  ['corefeatures', '핵심 기능'],
  ['keywords', '키워드'],
] as const;

/** Exports the complete hierarchy, including descendants hidden by a view's collapse state. */
export function createMindMapExportPayload(title: string, nodes: MindMapNode[], ideas: Idea[]): MindMapExportPayload {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const byIdeaId = new Map(ideas.map((idea) => [idea.id, idea]));
  const children = new Map<string, MindMapNode[]>();
  for (const node of nodes) {
    if (!node.parentnodeid || !byId.has(node.parentnodeid)) continue;
    const siblings = children.get(node.parentnodeid) ?? [];
    siblings.push(node);
    children.set(node.parentnodeid, siblings);
  }
  const sort = (items: MindMapNode[]) => [...items].sort((a, b) => a.sortorder - b.sortorder || a.title.localeCompare(b.title));
  const visit = (node: MindMapNode, ancestors: Set<string>): ExportNode => {
    const idea = node.ideaid ? byIdeaId.get(node.ideaid) : undefined;
    const details = idea ? fields.flatMap(([key, label]) => {
      const raw = idea[key];
      const values = (Array.isArray(raw) ? raw : [raw]).map((value) => typeof value === 'string' ? value.trim() : '').filter(Boolean);
      return values.length ? [{ label, values }] : [];
    }) : [];
    const next = new Set(ancestors);
    next.add(node.id);
    return {
      id: node.id,
      title: (idea?.title || node.title).trim() || '제목 없음',
      summary: (node.nodetype === 'idea_field' ? node.summary : idea?.summary || node.summary).trim(),
      details,
      children: sort(children.get(node.id) ?? []).filter((child) => !next.has(child.id)).map((child) => visit(child, next)),
    };
  };
  const roots = sort(nodes.filter((node) => !node.parentnodeid || !byId.has(node.parentnodeid)));
  return { title: title.trim() || roots.find((node) => node.nodetype === 'root')?.title || '마인드맵', roots: roots.map((node) => visit(node, new Set())) };
}

function contentLines(node: ExportNode, prefix: string) {
  return [
    ...(node.summary ? node.summary.split(/\r?\n/).map((line) => line.trim().replace(/^[•-]\s*/, '')).filter(Boolean).map((line) => `${prefix}${line}`) : []),
    ...node.details.flatMap(({ label, values }) => values.map((value) => `${prefix}${label}: ${value}`)),
  ];
}

export function mindMapToMarkdown(payload: MindMapExportPayload) {
  const lines = [`# ${payload.title}`];
  const walk = (node: ExportNode, depth: number) => {
    if (depth === 0 && node.title === payload.title) {
      lines.push(...contentLines(node, '- '));
    } else if (depth <= 1) {
      lines.push('', `${'#'.repeat(Math.min(depth + 1, 6))} ${node.title}`, ...contentLines(node, '- '));
    } else {
      const indent = '  '.repeat(depth - 2);
      lines.push(`${indent}- ${node.title}`, ...contentLines(node, `${indent}  - `));
    }
    node.children.forEach((child) => walk(child, depth + 1));
  };
  payload.roots.forEach((root) => walk(root, 0));
  return `${lines.join('\n').trimEnd()}\n`;
}

export function mindMapToOutline(payload: MindMapExportPayload) {
  const lines = [`PPT 슬라이드 목차: ${payload.title}`];
  let slide = 0;
  const walk = (node: ExportNode, depth: number) => {
    if (depth === 1 || (depth === 0 && node.title !== payload.title)) lines.push('', `${++slide}. ${node.title}`);
    else if (depth > 1) lines.push(`${'  '.repeat(depth - 2)}- ${node.title}`);
    lines.push(...contentLines(node, `${'  '.repeat(Math.max(0, depth - 1))}  • `));
    node.children.forEach((child) => walk(child, depth + 1));
  };
  payload.roots.forEach((root) => walk(root, 0));
  if (!slide) lines.push('', '1. 시작 / 주제 소개');
  return lines.join('\n').trimEnd();
}

export function mindMapToScript(payload: MindMapExportPayload) {
  const lines = [`발표 대본 뼈대: ${payload.title}`, '', `도입: 안녕하세요. ${payload.title}에 대해 발표하겠습니다.`];
  let section = 0;
  const walk = (node: ExportNode, depth: number) => {
    if (depth === 1 || (depth === 0 && node.title !== payload.title)) lines.push('', `${++section}. ${node.title}`, `전환: 다음은 ${node.title}입니다.`);
    else if (depth > 1) lines.push(`${'  '.repeat(depth - 2)}- ${node.title}: 설명할 내용`);
    lines.push(...contentLines(node, `${'  '.repeat(Math.max(0, depth - 1))}  • `));
    node.children.forEach((child) => walk(child, depth + 1));
  };
  payload.roots.forEach((root) => walk(root, 0));
  lines.push('', '마무리: 핵심 내용을 요약하고 질문을 받겠습니다.');
  return lines.join('\n');
}

export function mindMapToStructuredText(payload: MindMapExportPayload) {
  const lines = [payload.title];
  const walk = (node: ExportNode, depth: number) => {
    if (depth > 0 || node.title !== payload.title) lines.push(`${'  '.repeat(depth)}${node.title}`);
    lines.push(...contentLines(node, `${'  '.repeat(depth + 1)}• `));
    node.children.forEach((child) => walk(child, depth + 1));
  };
  payload.roots.forEach((root) => walk(root, 0));
  return lines.join('\n');
}

export function mindMapMarkdownFileName(title: string) {
  const cleaned = title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 80).replace(/[. ]+$/g, '');
  return `${cleaned || 'mind-map'}.md`;
}

export async function saveMindMapMarkdown(
  payload: MindMapExportPayload,
  save: (content: string, fileName: string, mimeType: string) => Promise<unknown>,
) {
  try {
    await save(mindMapToMarkdown(payload), mindMapMarkdownFileName(payload.title), 'text/markdown');
    return { saved: true as const };
  } catch (error) {
    return { saved: false as const, error: error instanceof Error ? error.message : '저장할 수 없습니다.' };
  }
}

/** Returns only nodes visible after collapsed ancestors have been removed. */
export function getExpandedMindMapNodes(nodes: MindMapNode[], collapsedIds: ReadonlySet<string>) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes.filter((node) => {
    const seen = new Set<string>([node.id]);
    let parentId = node.parentnodeid;
    while (parentId) {
      if (collapsedIds.has(parentId) || seen.has(parentId)) return false;
      seen.add(parentId);
      parentId = byId.get(parentId)?.parentnodeid ?? null;
    }
    return true;
  });
}
