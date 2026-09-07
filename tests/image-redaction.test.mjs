import assert from 'node:assert/strict';
import test from 'node:test';

import { redactionPixels, redactionRectangle, suggestedRedactions } from '../src/lib/image-redaction.ts';

test('redaction rectangles normalize reverse corner selection and clamp to the image', () => {
  assert.deepEqual(redactionRectangle({ x: 0.8, y: 1.2 }, { x: -0.1, y: 0.2 }), {
    x: 0,
    y: 0.2,
    width: 0.8,
    height: 0.8,
  });
  assert.equal(redactionRectangle({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }), null);
});

test('suggested and custom masks map to bounded image pixels', () => {
  assert.equal(suggestedRedactions.length, 2);
  assert.deepEqual(redactionPixels({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 }, 1000, 2000), {
    x: 100,
    y: 400,
    width: 300,
    height: 800,
  });
});
