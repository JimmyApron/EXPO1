import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeMvpPlan } from '../supabase/functions/_shared/mvp-plan.ts';

const idea = { id: 'idea-1', title: '축제 친구 찾기' };

test('MVP normalization accepts useful plans with optional later features and APIs', () => {
  const result = normalizeMvpPlan({
    ideaId: 'model-changed-this-id',
    ideaTitle: 'model changed this title',
    summary: '축제에서 친구와 다시 만나는 흐름을 검증함',
    mustHaveFeatures: [{ name: '모임 생성', description: '임시 위치 공유방을 만듦' }],
    laterFeatures: [],
    screens: [{ name: '지도', purpose: '친구 위치 확인', wireframe: ['상단 상태', '지도', '종료 버튼'] }],
    schedule: [{ period: '1주차', goal: '핵심 흐름 구현', tasks: ['모임 생성', '지도 연결'] }],
    teamRoles: [{ role: '개발', responsibilities: ['핵심 기능 구현'] }],
    apis: [],
    presentationOrder: ['문제', '해결', 'MVP'],
  }, idea);

  assert.equal(result?.ideaId, idea.id);
  assert.equal(result?.ideaTitle, idea.title);
  assert.deepEqual(result?.laterFeatures, []);
  assert.deepEqual(result?.apis, []);
});

test('MVP normalization cleans strings and common API method casing', () => {
  const result = normalizeMvpPlan({
    summary: '  요약  ',
    mustHaveFeatures: [{ name: ' 기능 ', description: ' 설명 ' }],
    laterFeatures: [{ name: '', description: '제외' }],
    screens: [{ name: ' 화면 ', purpose: ' 목적 ', wireframe: [' 블록 '] }],
    schedule: [{ period: ' 1주 ', goal: ' 목표 ', tasks: [' 작업 '] }],
    teamRoles: [{ role: ' 개발 ', responsibilities: [' 구현 '] }],
    apis: [{ name: ' 위치 ', purpose: ' 좌표 ', method: 'post' }],
    presentationOrder: [' 문제 정의 '],
  }, idea);

  assert.equal(result?.summary, '요약');
  assert.deepEqual(result?.apis, [{ name: '위치', purpose: '좌표', method: 'POST' }]);
  assert.deepEqual(result?.laterFeatures, []);
});

test('MVP normalization rejects responses missing a core section', () => {
  assert.equal(normalizeMvpPlan({ summary: '요약', mustHaveFeatures: [] }, idea), null);
});
