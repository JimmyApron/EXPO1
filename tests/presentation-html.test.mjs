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

test('native PDF HTML keeps every slide visible without the interactive viewer', () => {
  const html = createPresentationHtml({
    presentationTitle: '발표', settings: { title: '발표', pageCount: 12, theme: 'minimal-light' },
    slides: Array.from({ length: 12 }, (_, index) => ({ slideNumber: index + 1, title: `슬라이드 ${index + 1}`, bulletPoints: ['내용'], speakerScript: '대본' })),
    expectedQna: [], businessPlanDraft: '', finalReport: '',
  }, { printOnly: true });
  assert.equal((html.match(/<section class="slide">/g) ?? []).length, 12);
  assert.match(html, /\.slide\{width:13\.333in;height:7\.5in;aspect-ratio:auto;margin:0;box-shadow:none;break-after:page/);
  assert.doesNotMatch(html, /presentation-mode|slide-stage|deck-controls|<script>/);
});
