import assert from 'node:assert/strict';
import test from 'node:test';

import { completedEvaluatorIds } from '../src/lib/team-evaluation-progress.ts';

test('a participant is complete only after evaluating every current candidate', () => {
  const completed = completedEvaluatorIds([
    { userid: 'a', ideaid: 'one' },
    { userid: 'a', ideaid: 'two' },
    { userid: 'b', ideaid: 'one' },
    { userid: 'c', ideaid: 'old-candidate' },
  ], ['one', 'two']);
  assert.deepEqual([...completed], ['a']);
});

test('duplicate votes do not make an incomplete participant complete', () => {
  const completed = completedEvaluatorIds([
    { userid: 'a', ideaid: 'one' },
    { userid: 'a', ideaid: 'one' },
  ], ['one', 'two']);
  assert.equal(completed.size, 0);
});
