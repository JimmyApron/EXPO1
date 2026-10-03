import assert from 'node:assert/strict';
import test from 'node:test';

import {
    extractKeywordsFromText,
    formatMvpDuration,
    mergeKeywordLists,
    normalizeTeamExperience,
} from '../src/lib/mvp.ts';

test('team experience normalization keeps legacy values compatible', () => {
  assert.equal(normalizeTeamExperience('초급~중급'), '중급');
  assert.equal(normalizeTeamExperience('기술 수준: 고급'), '고급');
  assert.equal(normalizeTeamExperience('잘 모르겠어요'), '잘 모르겠어요');
  assert.equal(normalizeTeamExperience('unknown'), '중급');
});

test('short MVP durations remain in week units', () => {
  assert.equal(formatMvpDuration(0.5), '0.5주');
  assert.equal(formatMvpDuration(0.7), '0.7주');
  assert.equal(formatMvpDuration(2), '2주');
});

test('keyword extraction preserves user edits and merges without duplication', () => {
  const autoKeywords = extractKeywordsFromText('AI 회의 정리 AI와 자동화 회의 아이디어를 정리한다.');
  const merged = mergeKeywordLists(autoKeywords, ['회의 정리', '사용자 수정', 'AI']);

  assert.ok(autoKeywords.includes('AI'));
  assert.ok(merged.includes('회의 정리'));
  assert.ok(merged.includes('사용자 수정'));
  assert.equal(new Set(merged).size, merged.length);
});
