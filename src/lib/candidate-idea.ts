import type { CandidateIdea, CandidateIdeasPayload, ExtractCandidateIdeasResponse } from '@/types/candidate-idea';
import type { IdeaInput } from '@/types/idea';

export const maxCandidateIdeas = 8;
export const maxCandidateTextLength = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength = 4_000) {
  return typeof value === 'string' ? value.trim().replace(/\r\n/g, '\n').slice(0, maxLength) : '';
}

function duplicateKey(value: string) {
  return value.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

export function normalizeStringArray(value: unknown, maxItems = 12) {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,]/) : [];
  const seen = new Set<string>();

  return source
    .map((item) => cleanString(item, 160))
    .filter((item) => {
      const key = item.toLocaleLowerCase();
      if (!item || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
}

export function normalizeCandidateIdea(value: unknown, index: number): CandidateIdea | null {
  if (!isRecord(value)) {
    return null;
  }

  const title = cleanString(value.title, 160);
  if (!title) {
    return null;
  }

  const suppliedId = cleanString(value.id, 32);

  return {
    id: /^idea-\d{3}$/.test(suppliedId) ? suppliedId : `idea-${String(index + 1).padStart(3, '0')}`,
    title,
    summary: cleanString(value.summary),
    problem: cleanString(value.problem),
    targetUsers: normalizeStringArray(value.targetUsers),
    solution: cleanString(value.solution),
    keywords: normalizeStringArray(value.keywords),
    coreFeatures: normalizeStringArray(value.coreFeatures),
  };
}

export function normalizeCandidateIdeas(value: unknown): CandidateIdea[] {
  const source = isRecord(value) && Array.isArray(value.candidateIdeas) ? value.candidateIdeas : value;
  if (!Array.isArray(source)) {
    return [];
  }

  const seenTitles = new Set<string>();
  const seenDetails = new Set<string>();
  const usedIds = new Set<string>();
  const normalized: CandidateIdea[] = [];

  source.slice(0, maxCandidateIdeas * 2).forEach((item, index) => {
    const candidate = normalizeCandidateIdea(item, index);
    if (!candidate) {
      return;
    }

    const titleKey = duplicateKey(candidate.title);
    const detailKey = duplicateKey(`${candidate.summary}\n${candidate.problem}\n${candidate.solution}`);
    if (seenTitles.has(titleKey) || (detailKey && seenDetails.has(detailKey))) {
      return;
    }

    seenTitles.add(titleKey);
    if (detailKey) {
      seenDetails.add(detailKey);
    }
    let id = candidate.id;
    if (usedIds.has(id)) {
      let nextIdNumber = normalized.length + 1;
      do {
        id = `idea-${String(nextIdNumber).padStart(3, '0')}`;
        nextIdNumber += 1;
      } while (usedIds.has(id));
    }
    usedIds.add(id);
    normalized.push({ ...candidate, id });
  });

  return normalized.slice(0, maxCandidateIdeas);
}

export function normalizeExtractCandidateIdeasResponse(value: unknown): ExtractCandidateIdeasResponse | null {
  if (!isRecord(value) || !Array.isArray(value.candidateIdeas)) {
    return null;
  }

  return {
    extractedText: cleanString(value.extractedText, maxCandidateTextLength),
    candidateIdeas: normalizeCandidateIdeas(value.candidateIdeas),
  };
}

export function validateCandidateIdea(candidate: CandidateIdea) {
  const normalized = normalizeCandidateIdea(candidate, 0);
  if (!normalized || !normalized.title) {
    return '아이디어 제목을 입력해 주세요.';
  }
  return '';
}

function bulletList(items: string[]) {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- 없음';
}

export function candidateIdeaToIdeaInput(candidate: CandidateIdea): IdeaInput {
  const normalized = normalizeCandidateIdea(candidate, 0);
  if (!normalized) {
    throw new Error('저장할 후보 아이디어의 제목이 비어 있습니다.');
  }

  return {
    title: normalized.title,
    content: [
      '요약',
      normalized.summary || '없음',
      '',
      '문제',
      normalized.problem || '없음',
      '',
      '대상 사용자',
      bulletList(normalized.targetUsers),
      '',
      '해결 방법',
      normalized.solution || '없음',
      '',
      '핵심 기능',
      bulletList(normalized.coreFeatures),
      '',
      '키워드',
      bulletList(normalized.keywords),
    ].join('\n'),
    status: 'thought',
    category: 'planning',
    sourceid: normalized.id,
    summary: normalized.summary,
    problem: normalized.problem,
    targetusers: normalized.targetUsers,
    solution: normalized.solution,
    keywords: normalized.keywords,
    corefeatures: normalized.coreFeatures,
  };
}

export function toCandidateIdeasPayload(ideas: CandidateIdea[]): CandidateIdeasPayload {
  return { candidateIdeas: normalizeCandidateIdeas(ideas) };
}
