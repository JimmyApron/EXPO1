import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateIdeaResults, createIdeaResultData } from '../src/lib/idea-evaluation.ts';

const analyses = [
  {
    id: 'idea-a',
    anonymousLabel: '익명 아이디어 A',
    problem: '문제 A',
    solution: '해결 A',
    advantages: ['장점 1', '장점 2'],
    risk: '위험 A',
    difficulty: '보통',
  },
  {
    id: 'idea-b',
    anonymousLabel: '익명 아이디어 B',
    problem: '문제 B',
    solution: '해결 B',
    advantages: ['장점 3', '장점 4'],
    risk: '위험 B',
    difficulty: '쉬움',
  },
];

test('blind evaluation results count unique participants and rounded pass rate', () => {
  const results = calculateIdeaResults(analyses, [
    { ideaId: 'idea-a', userId: 'user-1', choice: 'pick', createdAt: '2026-08-22T00:00:00.000Z', locked: true },
    { ideaId: 'idea-a', userId: 'user-2', choice: 'pick', createdAt: '2026-08-22T00:00:00.000Z', locked: true },
    { ideaId: 'idea-a', userId: 'user-3', choice: 'pass', createdAt: '2026-08-22T00:00:00.000Z', locked: true },
  ], 3);

  assert.deepEqual(results[0], {
    currentParticipantCount: 3,
    ideaId: 'idea-a',
    anonymousLabel: '익명 아이디어 A',
    pickCount: 2,
    participantCount: 3,
    passRate: 67,
    aiAdvantages: ['장점 1', '장점 2'],
    aiRisk: '위험 A',
    difficulty: '보통',
  });
  assert.equal(results[1].participantCount, 0);
  assert.equal(results[1].passRate, 0);
});

test('result cards preserve blind analysis and add AI ranks only after comparison', () => {
  const voteResults = calculateIdeaResults(analyses, [
    { ideaId: 'idea-a', userId: 'user-1', choice: 'pick', createdAt: '', locked: true },
    { ideaId: 'idea-b', userId: 'user-1', choice: 'pass', createdAt: '', locked: true },
  ], 1);
  const beforeRecommendation = createIdeaResultData(voteResults);
  const afterRecommendation = createIdeaResultData(voteResults, {
    analyses: [
      { ideaId: 'idea-a', title: 'A', summary: 'A', strengths: ['A'], risks: ['A'], improvements: ['A'], feasibility: '보통', projectFit: '보통' },
      { ideaId: 'idea-b', title: 'B', summary: 'B', strengths: ['B'], risks: ['B'], improvements: ['B'], feasibility: '높음', projectFit: '높음' },
    ],
    overall: {
      comparison: '비교',
      recommendedIdeaIds: ['idea-b'],
      recommendationReason: '추천 이유',
      combinationSuggestion: '조합 제안',
    },
    notice: '참고',
  });

  assert.equal(beforeRecommendation.ideas[0].aiRank, null);
  assert.deepEqual(afterRecommendation.ideas.map((idea) => [idea.label, idea.aiRank]), [
    ['아이디어 A', 2],
    ['아이디어 B', 1],
  ]);
  assert.deepEqual(afterRecommendation.ideas[0].aiAdvantages, analyses[0].advantages);
  assert.equal(afterRecommendation.ideas[0].passRate, 100);
});
