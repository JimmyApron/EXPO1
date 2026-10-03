export type TeamExperienceLevel = '초급' | '중급' | '고급' | '잘 모르겠어요';

const teamExperienceMap: [RegExp, TeamExperienceLevel][] = [
  [/고급/i, '고급'],
  [/중급/i, '중급'],
  [/초급/i, '초급'],
  [/모르겠|모르겠어요|모르겠음/i, '잘 모르겠어요'],
];

export function normalizeTeamExperience(value?: string | null): TeamExperienceLevel {
  const normalized = (value ?? '').trim();

  if (!normalized) return '중급';

  const exact = normalized.replace(/기술\s*수준|팀의\s*개발\s*경험/gi, '').trim();
  if (exact === '잘 모르겠어요' || normalized === '잘 모르겠어요') return '잘 모르겠어요';
  if (/^unknown$/i.test(exact) || /^not sure$/i.test(exact) || /^unknown$/i.test(normalized) || /^not sure$/i.test(normalized)) {
    return '중급';
  }

  for (const [pattern, level] of teamExperienceMap) {
    if (pattern.test(exact) || pattern.test(normalized)) return level;
  }

  if (normalized.includes('~')) {
    if (normalized.includes('초급') && normalized.includes('중급')) return '중급';
    if (normalized.includes('중급') && normalized.includes('고급')) return '고급';
    if (normalized.includes('초급') && normalized.includes('고급')) return '중급';
  }

  return '중급';
}

export function formatMvpDuration(weeks: number): string {
  if (!Number.isFinite(weeks) || weeks <= 0) return '1주';

  if (weeks < 1) {
    return `${Math.max(0.1, Math.round(weeks * 10) / 10)}주`;
  }

  const roundedWeeks = Math.round(weeks * 2) / 2;
  return `${roundedWeeks % 1 === 0 ? roundedWeeks.toFixed(0) : roundedWeeks.toFixed(1)}주`;
}

export function extractKeywordsFromText(value: string): string[] {
  const originalTokens = (value ?? '')
    .replace(/[^가-힣a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const frequency = new Map<string, number>();
  for (const token of originalTokens) {
    const normalized = token.toUpperCase() === 'AI' ? 'AI' : token.toLowerCase();
    if (normalized.length < 2 && normalized !== 'AI') continue;
    const next = (frequency.get(normalized) ?? 0) + 1;
    frequency.set(normalized, next);
  }

  const ranked = [...frequency.entries()]
    .filter(([token]) => {
      const value = token.toLowerCase();
      if (value === 'ai') return true;
      return !['and', 'the', 'with', 'for', 'that', 'this', 'into', 'from', 'about', 'using', 'feature', '기능', '프로젝트', '서비스', '시스템', '아이디어'].includes(value);
    })
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([token]) => token);

  return [...new Set(ranked.map((token) => token.trim()).filter(Boolean))].slice(0, 8);
}

export function mergeKeywordLists(autoKeywords: string[], manualKeywords: string[]): string[] {
  const normalizedManual = (manualKeywords ?? [])
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const merged: string[] = [];

  for (const keyword of [...normalizedManual, ...(autoKeywords ?? [])]) {
    const cleaned = keyword.trim();
    if (!cleaned || seen.has(cleaned.toLowerCase())) continue;
    seen.add(cleaned.toLowerCase());
    merged.push(cleaned);
  }

  return merged;
}
