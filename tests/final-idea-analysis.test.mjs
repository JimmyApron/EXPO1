import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { normalizeFinalIdeaAnalysis } from '../supabase/functions/_shared/final-idea-analysis.ts';

test('final idea analysis instructions keep internal IDs out of narrative text', async () => {
  const source = await readFile(new URL('../supabase/functions/analyze-final-ideas/index.ts', import.meta.url), 'utf8');
  assert.match(source, /Use ideaId values only in the structured analyses\.ideaId and overall\.recommendedIdeaIds fields/);
  assert.match(source, /Refer to ideas by their title only/);
  assert.match(source, /strengths와 risks는 중요도가 높은 순서대로 정확히 3개씩 작성하세요/);
  assert.match(source, /40자 이내의 짧은 음슴체/);
});

const ideas = [
  { ideaId: 'idea-1', title: '첫 번째', content: '내용 1', category: '기획', status: 'approved' },
  { ideaId: 'idea-2', title: '두 번째', content: '내용 2', category: '개발', status: 'approved' },
];

const completeResult = {
  analyses: ideas.map((idea, index) => ({
    ideaId: idea.ideaId,
    title: idea.title,
    summary: `${idea.title}의 구체적인 요약`,
    strengths: [`장점 ${index + 1}`, '사용자 가치가 명확함', '기간 내 검증이 쉬움'],
    risks: [`위험 ${index + 1}`, '초기 사용자 확보 어려움', '운영 비용 증가 가능성 있음'],
    improvements: [`개선 ${index + 1}`],
    feasibility: index === 0 ? '높음' : '보통',
    projectFit: '높음',
  })),
  overall: {
    comparison: '두 아이디어의 사용자와 구현 범위를 비교한 내용',
    recommendedIdeaIds: ['idea-1'],
    recommendationReason: '기간 안에 핵심 기능을 검증하기 쉽기 때문',
    combinationSuggestion: '두 번째 아이디어의 장점을 보조 기능으로 결합',
  },
  notice: '모델이 임의로 쓴 안내 문구',
};

test('complete AI analysis is normalized without replacing its content', () => {
  const result = normalizeFinalIdeaAnalysis(completeResult, ideas, '고정 안내');

  assert.equal(result?.analyses[0].summary, '첫 번째의 구체적인 요약');
  assert.deepEqual(result?.analyses[1].risks, ['위험 2', '초기 사용자 확보 어려움', '운영 비용 증가 가능성 있음']);
  assert.deepEqual(result?.overall.recommendedIdeaIds, ['idea-1']);
  assert.equal(result?.notice, '고정 안내');
});

test('internal idea IDs are replaced with titles in visible analysis text', () => {
  const ideasWithIds = [
    { ideaId: 'cbedfb52-0000-0000-0000-000000000000', title: '메뉴 사전 예약 시스템', content: '내용 1', category: '기획', status: 'approved' },
    { ideaId: '62d6487e-0000-0000-0000-000000000000', title: '부스 운영 대시보드', content: '내용 2', category: '개발', status: 'approved' },
  ];
  const result = normalizeFinalIdeaAnalysis({
    ...completeResult,
    analyses: ideasWithIds.map((idea) => ({
      ...completeResult.analyses[0],
      ideaId: idea.ideaId,
      title: idea.title,
      summary: `${idea.ideaId.slice(0, 8)}(${idea.title})는 구현하기 쉽습니다.`,
    })),
    overall: {
      ...completeResult.overall,
      recommendedIdeaIds: [ideasWithIds[0].ideaId],
      recommendationReason: 'cbedfb52는 사용자 편의성이 높습니다.',
      comparison: '62d6487e와 cbedfb52를 비교했습니다.',
      combinationSuggestion: 'cbedfb52(예약)와 62d6487e를 결합합니다.',
    },
  }, ideasWithIds, '고정 안내');

  const visibleText = [
    result?.analyses[0].summary,
    result?.overall.recommendationReason,
    result?.overall.comparison,
    result?.overall.combinationSuggestion,
  ].join(' ');
  assert.doesNotMatch(visibleText, /cbedfb52|62d6487e/i);
  assert.match(visibleText, /메뉴 사전 예약 시스템/);
  assert.match(visibleText, /부스 운영 대시보드/);
});

test('empty tool input is rejected instead of becoming generic analysis', () => {
  assert.equal(normalizeFinalIdeaAnalysis({}, ideas, '고정 안내'), null);
});

test('missing candidate analysis and empty fields are rejected', () => {
  assert.equal(
    normalizeFinalIdeaAnalysis({ ...completeResult, analyses: completeResult.analyses.slice(0, 1) }, ideas, '고정 안내'),
    null,
  );

  const analyses = completeResult.analyses.map((analysis, index) =>
    index === 0 ? { ...analysis, strengths: [] } : analysis,
  );
  assert.equal(normalizeFinalIdeaAnalysis({ ...completeResult, analyses }, ideas, '고정 안내'), null);
});

test('strengths and risks must each contain exactly three items', () => {
  const analyses = completeResult.analyses.map((analysis, index) =>
    index === 0 ? { ...analysis, risks: analysis.risks.slice(0, 2) } : analysis,
  );
  assert.equal(normalizeFinalIdeaAnalysis({ ...completeResult, analyses }, ideas, '고정 안내'), null);
});

test('recommendations must point to an input idea', () => {
  const overall = { ...completeResult.overall, recommendedIdeaIds: ['unknown'] };
  assert.equal(normalizeFinalIdeaAnalysis({ ...completeResult, overall }, ideas, '고정 안내'), null);
});
