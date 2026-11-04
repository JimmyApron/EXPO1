import type { Idea } from '../types/idea';
import type { MindMapNode } from '../types/mind-map';
import { getTopicFields, normalizeTopicDetails } from './topic-workspace.ts';
import type { ProjectTemplate } from '../types/project';

export type ExportNode = {
  id: string;
  title: string;
  summary: string;
  details: { label: string; values: string[] }[];
  ideaId: string | null;
  ideaField: MindMapNode['ideafield'];
  nodeType: MindMapNode['nodetype'];
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
export function createMindMapExportPayload(title: string, nodes: MindMapNode[], ideas: Idea[], template: ProjectTemplate = 'service_app'): MindMapExportPayload {
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
    const details = idea && template !== 'service_app' ? [
      ...getTopicFields(template).flatMap(field => {
        const value = normalizeTopicDetails(idea.details)[field.key].trim();
        return value ? [{ label: field.label, values: [value] }] : [];
      }),
      ...(idea.keywords.length ? [{ label: '키워드', values: idea.keywords }] : []),
    ] : idea ? fields.flatMap(([key, label]) => {
      const raw = idea[key];
      const values = (Array.isArray(raw) ? raw : [raw]).map((value) => typeof value === 'string' ? value.trim() : '').filter(Boolean);
      return values.length ? [{ label, values }] : [];
    }) : [];
    const next = new Set(ancestors);
    next.add(node.id);
    return {
      id: node.id,
      title: (idea?.title || node.title).trim() || '제목 없음',
      summary: (template !== 'service_app' && idea ? idea.content : node.nodetype === 'idea_field' ? node.summary : idea?.summary || node.summary).trim(),
      details,
      ideaId: node.ideaid,
      ideaField: node.ideafield,
      nodeType: node.nodetype,
      children: sort(children.get(node.id) ?? []).filter((child) => !next.has(child.id)).map((child) => visit(child, next)),
    };
  };
  const roots = sort(nodes.filter((node) => !node.parentnodeid || !byId.has(node.parentnodeid)));
  return { title: title.trim() || roots.find((node) => node.nodetype === 'root')?.title || '마인드맵', roots: roots.map((node) => visit(node, new Set())) };
}

function contentLines(node: ExportNode, prefix: string) {
  const summaries = node.summary.split(/\r?\n/).map((line) => line.trim().replace(/^[•-]\s*/, '')).filter(Boolean);
  const details = node.nodeType === 'idea_field' ? [] : node.details.flatMap(({ label, values }) =>
    values.filter((value) => !summaries.includes(value)).map((value) => `${label}: ${value}`));
  return [...summaries, ...details].map((line) => `${prefix}${line}`);
}

type IdeaCard = {
  id: string;
  title: string;
  summary: string;
  details: ExportNode['details'];
  fieldSummaries: Map<string, string[]>;
  notes: string[];
};

function collectIdeaCards(payload: MindMapExportPayload) {
  const cards: IdeaCard[] = [];
  const byId = new Map<string, IdeaCard>();
  const visit = (node: ExportNode, parentIdeaId?: string) => {
    let currentIdeaId = parentIdeaId;
    if (node.ideaId) {
      currentIdeaId = node.ideaId;
      let card = byId.get(node.ideaId);
      if (!card) {
        card = { id: node.ideaId, title: node.title, summary: '', details: node.details, fieldSummaries: new Map(), notes: [] };
        byId.set(node.ideaId, card);
        cards.push(card);
      }
      const label = fields.find(([key]) => key === node.ideaField)?.[1];
      if (node.nodeType === 'idea_field' && label) {
        const values = node.summary.split(/\r?\n/).map((line) => line.trim().replace(/^[•-]\s*/, '')).filter(Boolean);
        if (values.length) card.fieldSummaries.set(label, values);
      } else if (node.summary && !card.summary) {
        card.summary = node.summary;
      }
    } else if (parentIdeaId && node.nodeType !== 'root') {
      const note = [node.title, node.summary].filter(Boolean).join(': ');
      if (note) byId.get(parentIdeaId)?.notes.push(note);
    }
    node.children.forEach((child) => visit(child, currentIdeaId));
  };
  payload.roots.forEach((root) => visit(root));
  return cards;
}

function cardDetails(card: IdeaCard) {
  const details = card.details.map(({ label, values }) => ({ label, values: card.fieldSummaries.get(label) ?? values }));
  for (const [label, values] of card.fieldSummaries) {
    if (!details.some((detail) => detail.label === label)) details.push({ label, values });
  }
  return details;
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
  const supplements = collectIdeaCards(payload)
    .map((card) => ({ card, details: card.details.filter(({ label }) => card.fieldSummaries.size > 0 && !card.fieldSummaries.has(label)) }))
    .filter(({ details }) => details.length > 0);
  if (supplements.length) {
    lines.push('', '## 아이디어 추가 정보');
    for (const { card, details } of supplements) {
      lines.push('', `### ${card.title}`, ...details.flatMap(({ label, values }) => values.map((value) => `- ${label}: ${value}`)));
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export function mindMapToOutline(payload: MindMapExportPayload) {
  const lines = [`PPT 슬라이드 목차: ${payload.title}`, '', `1. 시작 / 주제 소개 — ${payload.title}`];
  const cards = collectIdeaCards(payload);
  if (cards.length) {
    cards.forEach((card, index) => {
      lines.push('', `${index + 2}. ${card.title}`);
      const points = cardDetails(card).filter(({ label }) => label !== '키워드').slice(0, 4);
      if (card.summary && !points.some(({ values }) => values.includes(card.summary))) lines.push(`  • 핵심 내용: ${card.summary}`);
      lines.push(...points.map(({ label, values }) => `  • ${label}: ${values.join(' / ')}`));
      lines.push(...card.notes.map((note) => `  • 추가 노드: ${note}`));
    });
  } else {
    const branches = payload.roots.flatMap((root) => root.title === payload.title ? root.children : [root]);
    branches.forEach((branch, index) => lines.push('', `${index + 2}. ${branch.title}`, ...contentLines(branch, '  • '),
      ...branch.children.map((child) => `  • ${child.title}${child.summary ? `: ${child.summary}` : ''}`)));
  }
  return lines.join('\n').trimEnd();
}

export function mindMapToScript(payload: MindMapExportPayload) {
  const lines = [`발표 대본 뼈대: ${payload.title}`, '', `도입: 안녕하세요. ${payload.title}에서 나온 내용을 소개하겠습니다.`];
  const cards = collectIdeaCards(payload);
  cards.forEach((card, index) => {
    lines.push('', `${index + 1}. ${card.title}`, `${index === 0 ? '먼저' : '다음으로'} ${card.title} 아이디어를 소개하겠습니다.`);
    const details = cardDetails(card);
    if (card.summary && !details.some(({ values }) => values.includes(card.summary))) lines.push(`핵심 내용은 “${card.summary}”입니다.`);
    for (const { label, values } of details.filter(({ label }) => label !== '키워드')) {
      const value = values.join(', ');
      if (label === '문제') lines.push(`이 아이디어가 다루는 문제는 “${value}”입니다.`);
      else if (label === '타깃 사용자') lines.push(`대상 사용자는 ${value}입니다.`);
      else if (label === '해결 방식') lines.push(`제안하는 해결 방식은 “${value}”입니다.`);
      else if (label === '핵심 기능') lines.push(`주요 기능은 ${value}입니다.`);
      else lines.push(`${label}: “${value}”`);
    }
    lines.push(...card.notes.map((note) => `추가로 설명할 내용: ${note}`));
  });
  if (!cards.length) {
    const branches = payload.roots.flatMap((root) => root.title === payload.title ? root.children : [root]);
    branches.forEach((branch, index) => {
      lines.push('', `${index + 1}. ${branch.title}`, `${branch.title}에 대해 말씀드리겠습니다.`);
      lines.push(...contentLines(branch, '말할 내용: '));
      lines.push(...branch.children.map((child) => `이어서 ${child.title}${child.summary ? `: ${child.summary}` : ''}`));
    });
    if (!branches.length) lines.push('', '마인드맵의 가지와 내용을 추가한 뒤 발표 내용을 채워 주세요.');
  }
  lines.push('', `마무리: 이상으로 ${payload.title}에 대한 소개를 마치겠습니다.`);
  return lines.join('\n');
}

export function mindMapToFigmaPrompt(payload: MindMapExportPayload) {
  const lines = [
    '다음 내용을 바탕으로 Figma에서 편집 가능한 마인드맵을 만들어 주세요.',
    `중심 노드: ${payload.title}`,
    '',
    '구성 규칙:',
    '- 아래 들여쓰기는 부모와 자식 노드의 관계입니다. 모든 노드를 연결선으로 이어 주세요.',
    '- 1차 가지마다 색을 구분하고, 긴 설명은 노드 아래 보조 텍스트로 배치해 주세요.',
    '- 같은 이름의 아이디어가 여러 가지에 있어도 각 가지의 설명을 유지해 주세요.',
    '- 제공되지 않은 사실이나 기능은 추가하지 마세요.',
    '',
    '노드 구조:',
  ];
  const walk = (node: ExportNode, depth: number) => {
    lines.push(`${'  '.repeat(depth)}- ${node.title}`);
    if (node.summary && node.nodeType !== 'root') lines.push(`${'  '.repeat(depth + 1)}설명: ${node.summary.replace(/\s*\n\s*/g, ' / ')}`);
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
