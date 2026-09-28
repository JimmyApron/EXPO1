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

function similarityTokens(value: string) {
  return new Set(
    value
      .toLocaleLowerCase()
      .split(/[\s\p{P}\p{S}]+/gu)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2),
  );
}

function overlapRatio(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  left.forEach((item) => {
    if (right.has(item)) overlap += 1;
  });
  return overlap / Math.min(left.size, right.size);
}

function uniqueText(parts: string[], maxLength = 4_000) {
  const seen = new Set<string>();
  return parts
    .map((item) => item.trim())
    .filter((item) => {
      const key = duplicateKey(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join('\n')
    .slice(0, maxLength);
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

export function findCandidateDuplicateReferences(candidates: CandidateIdea[]) {
  const references: Record<string, string> = {};

  candidates.forEach((candidate, index) => {
    const titleKey = duplicateKey(candidate.title);
    const titleTokens = similarityTokens(candidate.title);
    const keywordTokens = new Set(candidate.keywords.map(duplicateKey).filter(Boolean));
    const detailKey = duplicateKey(`${candidate.problem}\n${candidate.solution}`);

    for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
      const previous = candidates[previousIndex];
      const previousTitleKey = duplicateKey(previous.title);
      const sameOrContainedTitle = titleKey.length >= 6 && previousTitleKey.length >= 6
        && (titleKey === previousTitleKey || titleKey.includes(previousTitleKey) || previousTitleKey.includes(titleKey));
      const similarTitle = overlapRatio(titleTokens, similarityTokens(previous.title)) >= 0.67;
      const similarKeywords = keywordTokens.size >= 2
        && overlapRatio(keywordTokens, new Set(previous.keywords.map(duplicateKey).filter(Boolean))) >= 0.67;
      const previousDetailKey = duplicateKey(`${previous.problem}\n${previous.solution}`);
      const sameDetails = detailKey.length >= 20 && detailKey === previousDetailKey;

      if (sameOrContainedTitle || similarTitle || similarKeywords || sameDetails) {
        references[candidate.id] = previous.title;
        break;
      }
    }
  });

  return references;
}

export function mergeCandidateIdeas(candidates: CandidateIdea[]): CandidateIdea | null {
  if (candidates.length < 2) return null;
  const [primary] = candidates;

  return {
    ...primary,
    summary: uniqueText(candidates.map((candidate) => candidate.summary)),
    problem: uniqueText(candidates.map((candidate) => candidate.problem)),
    targetUsers: normalizeStringArray(candidates.flatMap((candidate) => candidate.targetUsers)),
    solution: uniqueText(candidates.map((candidate) => candidate.solution)),
    keywords: normalizeStringArray(candidates.flatMap((candidate) => candidate.keywords)),
    coreFeatures: normalizeStringArray(candidates.flatMap((candidate) => candidate.coreFeatures)),
  };
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
