import assert from 'node:assert/strict';
import test from 'node:test';
import { createPresentationHtml } from '../src/utils/export/presentationHtml.ts';

test('HTML presentation exports one print page for each saved slide', () => {
  const html = createPresentationHtml({
    presentationTitle: '데모 <자료>', settings: { title: '데모', pageCount: 3, theme: 'modern-dark' },
    slides: [1, 2, 3].map((slideNumber) => ({ slideNumber, title: `제목 ${slideNumber}`, bulletPoints: ['핵심 내용'], speakerScript: '발표 대본' })),
    expectedQna: [], businessPlanDraft: '', finalReport: '',
  });
  assert.equal((html.match(/<section class="slide">/g) ?? []).length, 3);
  assert.match(html, /@page\{size:13\.333in 7\.5in/);
  assert.match(html, /<nav class="deck-controls"/);
  assert.match(html, /id="deck-back" aria-label="발표 화면에서 돌아가기"/);
  assert.match(html, /class="deck-viewport"/);
  assert.match(html, /\.presentation-mode \.slide-stage \.slide\.is-active\{display:flex\}/);
  assert.match(html, /\.presentation-mode \.slide-stage \.slide\{display:flex!important/);
  assert.match(html, /데모 &lt;자료&gt;/);
  assert.match(html, /#111827/);
  assert.doesNotMatch(html, /max-width:12ch/);
});
