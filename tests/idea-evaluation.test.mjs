import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateIdeaResults } from '../src/lib/idea-evaluation.ts';

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
