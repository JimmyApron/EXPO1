import assert from 'node:assert/strict';
import test from 'node:test';
import { createPresentationHtml } from '../src/utils/export/presentationHtml.ts';
import { isPremiumPresentationTheme, presentationThemes } from '../src/lib/presentation-themes.ts';

const source = {
  presentationTitle: '원본 발표',
  slides: [1, 2, 3].map(slideNumber => ({ slideNumber, title: `제목 ${slideNumber}`,
    bulletPoints: [`내용 ${slideNumber}`, '추가 설명'], speakerScript: '발표 대본' })),
  expectedQna: [], businessPlanDraft: '', finalReport: '',
};

test('only the two named premium theme IDs require a subscription', () => {
  assert.deepEqual(presentationThemes.filter(item => item.premium).map(item => item.id), ['modern-dark', 'business']);
  assert.deepEqual(presentationThemes.filter(item => !item.premium).map(item => item.id), ['minimal-light', 'soft-color']);
  for (const item of presentationThemes) assert.equal(isPremiumPresentationTheme(item.id), item.premium);
});

test('changing design preserves all slide text and page count in HTML export', () => {
  const pages = presentationThemes.map(item => createPresentationHtml({ ...source,
    settings: { title: source.presentationTitle, pageCount: 3, theme: item.id } }));
  for (const html of pages) {
    assert.equal((html.match(/<section class="slide">/g) ?? []).length, 3);
    for (const slide of source.slides) {
      assert.match(html, new RegExp(slide.title));
      assert.match(html, new RegExp(slide.bulletPoints[0]));
    }
  }
  assert.match(pages[2], /letter-spacing:-\.025em/);
  assert.match(pages[3], /linear-gradient\(90deg/);
});
