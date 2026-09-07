type PresentationData = {
  ideaId?: string;
  presentationTitle: string;
  slides: { slideNumber: number; title: string; bulletPoints: string[]; speakerScript: string }[];
  expectedQna: { question: string; answer: string }[];
  businessPlanDraft: string;
  finalReport: string;
};

export type PresentationRewriteTarget =
  | { kind: 'slide'; index: number }
  | { kind: 'document'; field: 'businessPlanDraft' | 'finalReport'; start: number; end: number };

export type PresentationRewriteContent =
  | { title: string; bulletPoints: string[]; speakerScript: string }
  | { text: string };

export function documentBlocks(text: string) {
  const starts = [...text.matchAll(/^##\s+.+$/gm)].map((match) => match.index);
  if (starts[0] !== 0) starts.unshift(0);
  return starts.map((start, index) => ({ start, end: starts[index + 1] ?? text.length }))
    .filter(({ start, end }) => text.slice(start, end).trim());
}

export function isRewriteTarget(value: unknown, data: PresentationData): value is PresentationRewriteTarget {
  if (!value || typeof value !== 'object') return false;
  const target = value as Record<string, unknown>;
  if (target.kind === 'slide') {
    return Number.isInteger(target.index) && Number(target.index) >= 0 && Number(target.index) < data.slides.length;
  }
  if (target.kind !== 'document' || (target.field !== 'businessPlanDraft' && target.field !== 'finalReport')) return false;
  return documentBlocks(data[target.field]).some(({ start, end }) => target.start === start && target.end === end);
}

function nonemptyText(value: unknown, limit: number): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && value.length <= limit;
}

export function normalizePresentationRewrite(value: unknown, target: PresentationRewriteTarget): PresentationRewriteContent | null {
  if (!value || typeof value !== 'object') return null;
  const content = value as Record<string, unknown>;
  if (target.kind === 'document') {
    return nonemptyText(content.text, 12_000) ? { text: content.text } : null;
  }
  if (!nonemptyText(content.title, 300) || !nonemptyText(content.speakerScript, 6_000) ||
    !Array.isArray(content.bulletPoints) || !content.bulletPoints.length || content.bulletPoints.length > 12 ||
    !content.bulletPoints.every((point) => nonemptyText(point, 1_500))) return null;
  return { title: content.title, bulletPoints: content.bulletPoints as string[], speakerScript: content.speakerScript };
}

/** Only this function applies model output; identity and all untargeted content stay intact. */
export function applyPresentationRewrite(data: PresentationData, target: PresentationRewriteTarget, value: unknown): PresentationData {
  const content = normalizePresentationRewrite(value, target);
  if (!isRewriteTarget(target, data) || !content) throw new Error('부분 재작성 결과 또는 대상이 올바르지 않습니다.');
  if (target.kind === 'slide' && 'title' in content) {
    return { ...data, slides: data.slides.map((slide, index) => index === target.index ? { ...slide, ...content } : slide) };
  }
  if (target.kind === 'document' && 'text' in content) {
    const original = data[target.field];
    const replacement = content.text.trim() + (target.end < original.length ? '\n\n' : '');
    return { ...data, [target.field]: original.slice(0, target.start) + replacement + original.slice(target.end) };
  }
  throw new Error('부분 재작성 형식이 올바르지 않습니다.');
}

export const slideRewriteSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    title: { type: 'string' },
    bulletPoints: { type: 'array', items: { type: 'string' } },
    speakerScript: { type: 'string' },
  },
  required: ['title', 'bulletPoints', 'speakerScript'],
};

export const documentRewriteSchema = {
  type: 'object', additionalProperties: false,
  properties: { text: { type: 'string', description: '선택한 문서 블록만 마크다운으로 재작성. 제목 수준과 경계를 유지.' } },
  required: ['text'],
};
