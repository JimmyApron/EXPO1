import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { createPptx } from '../src/utils/export/createPptx.ts';
import { formatForKakao, formatForNotion, presentationPages, reportHtml } from '../src/utils/export/exportFormats.ts';

const data = {
  projectTitle: 'Watt',
  idea: { id: 'sample', title: 'AI 회의 아이디어 정리 서비스', summary: '회의를 실행 계획으로', problem: '정리되지 않는 회의', solution: 'AI로 정리', targetUsers: ['대학생'], coreFeatures: ['텍스트 입력', '아이디어 추출'], keywords: [] },
  mvpPlan: { essentialFeatures: ['입력'], laterFeatures: ['OCR'], screens: [], schedule: ['1주차: 설계'], requiredApis: ['AI API'] },
  aiAnalysis: { strengths: ['시간 절약'], risks: ['분석 오류'], difficulty: '보통' },
  teamRoles: ['개발: 구현'], presentationOrder: ['문제', '해결'],
};

test('Kakao text stays short with long generated input', () => {
  const text = formatForKakao({ ...data, idea: { ...data.idea, problem: '긴 문제'.repeat(1000), coreFeatures: Array(30).fill('기능'.repeat(100)) } });
  assert.ok(text.length < 1200);
  assert.match(text, /아이디어명: AI 회의/);
  assert.match(text, /난이도: 보통/);
  assert.equal((text.match(/^- /gm) ?? []).length, 4);
});

test('Notion contains MVP, schedule, APIs, roles and missing analysis labels', () => {
  const text = formatForNotion(data);
  for (const value of ['# 최종 아이디어 정리', '필수 기능:', '추후 기능:', '1주차: 설계', 'AI API', '개발: 구현']) assert.ok(text.includes(value));
  assert.ok(formatForNotion({ ...data, aiAnalysis: undefined }).includes('분석 전'));
});

test('PDF escapes generated HTML and preserves the report', () => {
  const html = reportHtml({ ...data, idea: { ...data.idea, problem: '<script>alert(1)</script>' }, presentation: { finalReport: '기대 효과: 시간 절약' } });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('기대 효과: 시간 절약'));
});

test('PDF creates separate business-plan and final-report documents', () => {
  const presentation = { businessPlanDraft: '사업 계획 전용 내용', finalReport: '최종 보고 전용 내용' };
  const businessPlan = reportHtml({ ...data, presentation }, 'business-plan');
  const finalReport = reportHtml({ ...data, presentation }, 'final-report');
  assert.ok(businessPlan.includes('사업 계획 전용 내용'));
  assert.ok(!businessPlan.includes('최종 보고 전용 내용'));
  assert.ok(finalReport.includes('최종 보고 전용 내용'));
  assert.ok(!finalReport.includes('사업 계획 전용 내용'));
});

test('Continuation slides preserve Unicode and speaker notes', () => {
  const content = '한글😀'.repeat(400);
  const pages = presentationPages({ ...data, presentation: { slides: [{ title: '슬라이드', bulletPoints: [content], speakerScript: '발표 대본' }] } });
  assert.ok(pages.length > 1);
  assert.equal(pages.map((page) => page.content).join(''), content);
  assert.equal(pages[0].notes, '발표 대본');
  assert.equal(pages[1].notes, '');
});

test('PPTX is a valid ZIP with Korean slide text and speaker notes', async () => {
  const bytes = await createPptx({ ...data, presentation: { slides: [{ title: '발표 제목', bulletPoints: ['한글 내용'], speakerScript: '발표 대본' }] } });
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  assert.ok(zip.file('[Content_Types].xml'));
  assert.ok(zip.file('ppt/presentation.xml'));
  assert.match(await zip.file('ppt/slides/slide1.xml').async('string'), /한글 내용/);
  assert.match(await zip.file('ppt/notesSlides/notesSlide1.xml').async('string'), /발표 대본/);
  const fallback = await JSZip.loadAsync(await createPptx(data));
  assert.ok(Object.keys(fallback.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length >= 10);
});
