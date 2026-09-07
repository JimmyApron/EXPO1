import assert from 'node:assert/strict';
import test from 'node:test';

import { applyPresentationRewrite, documentBlocks, isRewriteTarget } from '../supabase/functions/_shared/presentation-rewrite.ts';

const presentation = {
  ideaId: 'idea-1',
  presentationTitle: '원본 발표',
  slides: [
    { slideNumber: 1, title: '문제', bulletPoints: ['원본 문제'], speakerScript: '원본 문제 대본' },
    { slideNumber: 2, title: '해결', bulletPoints: ['원본 해결'], speakerScript: '원본 해결 대본' },
  ],
  expectedQna: [{ question: '질문', answer: '답변' }],
  businessPlanDraft: '# 사업계획서\n\n서문\n\n## 문제\n기존 문제\n\n## 해결\n기존 해결',
  finalReport: '# 보고서\n\n## 결과\n기존 결과',
};

test('slide rewrite changes only the targeted slide', () => {
  const next = applyPresentationRewrite(presentation, { kind: 'slide', index: 1 }, {
    title: '개선된 해결', bulletPoints: ['개선점'], speakerScript: '개선된 대본',
  });
  assert.equal(next.slides[0], presentation.slides[0]);
  assert.notEqual(next.slides[1], presentation.slides[1]);
  assert.equal(next.expectedQna, presentation.expectedQna);
  assert.equal(next.businessPlanDraft, presentation.businessPlanDraft);
  assert.equal(next.finalReport, presentation.finalReport);
});

test('document rewrite replaces only the selected block and validates exact boundaries', () => {
  const blocks = documentBlocks(presentation.businessPlanDraft);
  const target = { kind: 'document', field: 'businessPlanDraft', ...blocks[1] };
  assert.equal(isRewriteTarget(target, presentation), true);
  assert.equal(isRewriteTarget({ ...target, end: target.end - 1 }, presentation), false);
  const next = applyPresentationRewrite(presentation, target, { text: '## 문제\n개선된 문제' });
  assert.match(next.businessPlanDraft, /개선된 문제/);
  assert.match(next.businessPlanDraft, /## 해결\n기존 해결/);
  assert.equal(next.slides, presentation.slides);
  assert.equal(next.expectedQna, presentation.expectedQna);
  assert.equal(next.finalReport, presentation.finalReport);
});
