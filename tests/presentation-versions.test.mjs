import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPresentationCandidate, changedPresentationSections } from '../src/lib/presentation-versions.ts';

const original = {
  ideaId: 'idea-1', currentVersionId: 'v1', presentationTitle: '원본',
  slides: [{ slideNumber: 1, title: '문제', bulletPoints: ['기존'], speakerScript: '기존 대본' }],
  expectedQna: [{ question: '왜?', answer: '근거' }],
  businessPlanDraft: '기존 사업계획서', finalReport: '기존 보고서', versionHistory: [],
};

test('new presentation archives all prior content for durable restoration', () => {
  const next = { ...original, presentationTitle: '새 발표', slides: [{ ...original.slides[0], bulletPoints: ['변경'] }] };
  const applied = applyPresentationCandidate(original, next, '간결하게');
  assert.equal(applied.presentationTitle, '새 발표');
  assert.equal(applied.previousVersionId, 'v1');
  assert.deepEqual(applied.versionHistory?.[0].snapshot?.slides, original.slides);
  assert.equal(applied.versionHistory?.[0].snapshot?.finalReport, original.finalReport);
  assert.equal(applied.versionHistory?.[0].instruction, '간결하게');
  assert.deepEqual(original.versionHistory, []);
});

test('comparison reports changed slides and documents without modifying either version', () => {
  const next = { ...original, slides: [{ ...original.slides[0], speakerScript: '새 대본' }], finalReport: '새 보고서' };
  assert.deepEqual(changedPresentationSections(original, next), ['1번 슬라이드: 문제', '최종 보고서']);
  assert.equal(original.slides[0].speakerScript, '기존 대본');
});
