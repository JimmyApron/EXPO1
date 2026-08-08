import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeFinalIdeaAnalysis } from '../supabase/functions/_shared/final-idea-analysis.ts';

const ideas = [
  { ideaId: 'idea-1', title: '첫 번째', content: '내용 1', category: '기획', status: 'approved' },
  { ideaId: 'idea-2', title: '두 번째', content: '내용 2', category: '개발', status: 'approved' },
];

const completeResult = {
  analyses: ideas.map((idea, index) => ({
    ideaId: idea.ideaId,
    title: idea.title,
    summary: `${idea.title}의 구체적인 요약`,
    strengths: [`장점 ${index + 1}`],
    risks: [`위험 ${index + 1}`],
    improvements: [`개선 ${index + 1}`],
    feasibility: index === 0 ? '높음' : '보통',
    projectFit: '높음',
  })),
  overall: {
    comparison: '두 아이디어의 사용자와 구현 범위를 비교한 내용',
    recommendedIdeaIds: ['idea-1'],
    recommendationReason: '기간 안에 핵심 기능을 검증하기 쉽기 때문',
    combinationSuggestion: '두 번째 아이디어의 장점을 보조 기능으로 결합',
  },
  notice: '모델이 임의로 쓴 안내 문구',
};

test('complete AI analysis is normalized without replacing its content', () => {
  const result = normalizeFinalIdeaAnalysis(completeResult, ideas, '고정 안내');

  assert.equal(result?.analyses[0].summary, '첫 번째의 구체적인 요약');
  assert.deepEqual(result?.analyses[1].risks, ['위험 2']);
  assert.deepEqual(result?.overall.recommendedIdeaIds, ['idea-1']);
  assert.equal(result?.notice, '고정 안내');
});

test('empty tool input is rejected instead of becoming generic analysis', () => {
  assert.equal(normalizeFinalIdeaAnalysis({}, ideas, '고정 안내'), null);
});

test('missing candidate analysis and empty fields are rejected', () => {
  assert.equal(
    normalizeFinalIdeaAnalysis({ ...completeResult, analyses: completeResult.analyses.slice(0, 1) }, ideas, '고정 안내'),
    null,
  );

  const analyses = completeResult.analyses.map((analysis, index) =>
    index === 0 ? { ...analysis, strengths: [] } : analysis,
  );
  assert.equal(normalizeFinalIdeaAnalysis({ ...completeResult, analyses }, ideas, '고정 안내'), null);
});

test('recommendations must point to an input idea', () => {
  const overall = { ...completeResult.overall, recommendedIdeaIds: ['unknown'] };
  assert.equal(normalizeFinalIdeaAnalysis({ ...completeResult, overall }, ideas, '고정 안내'), null);
});
