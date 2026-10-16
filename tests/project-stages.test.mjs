import assert from 'node:assert/strict';
import test from 'node:test';
import { getProjectStages, getStageProgress, getValidStageId, normalizeProjectTemplate } from '../src/lib/project-stages.ts';
import { getProjectStageSummary } from '../src/lib/project-progress.ts';
import { changeFavoriteWithRollback, sortProjectsWithFavorites } from '../src/lib/project-favorites.ts';

test('each template has its own ordered stages and presentation is optional', () => {
  assert.deepEqual(getProjectStages('service_app', true).map((stage) => stage.label),
    ['아이디어 도출', '비교·선정', 'MVP 기획', '발표자료']);
  assert.deepEqual(getProjectStages('report_research', false).map((stage) => stage.label),
    ['주제 선정', '자료 조사·정리', '목차 구성', '보고서 작성', '검토·제출']);
  assert.deepEqual(getProjectStages('writing_creative', false).map((stage) => stage.label),
    ['주제·소재 정하기', '개요·표현 방향', '초안 작성', 'AI 피드백·수정', '최종 결과물']);
  assert.equal(getProjectStages('writing_creative', true).length, 6);
  assert.equal(normalizeProjectTemplate(null), 'service_app');
  assert.equal(getProjectStages(undefined, undefined).length, 4);
});

test('stage completion uses only valid stages and repairs stale navigation', () => {
  const stages = getProjectStages('service_app', false);
  const progress = getStageProgress(stages, { extraction: true, selection: true, presentation: true });
  assert.equal(progress.completedStageCount, 2);
  assert.equal(progress.totalStageCount, 3);
  assert.equal(progress.currentStage.id, 'mvp');
  assert.equal(progress.percent, 67);
  assert.equal(getValidStageId(stages, 'presentation'), 'extraction');
});

test('service progress follows existing work and removes presentation from denominator', () => {
  const project = { template: 'service_app', haspresentation: false };
  const summary = getProjectStageSummary(project, 3, 1, {
    selectedideaid: 'idea-1', mvpplan: null, presentationdata: null,
  });
  assert.equal(summary.completedStageCount, 2);
  assert.equal(summary.totalStageCount, 3);
  assert.equal(summary.currentStage.label, 'MVP 기획');
});

test('template progress does not reuse another template or invalid stage', () => {
  const record = (template, stageid) => ({ projectid: 'project', template, stageid, content: '내용', iscompleted: true, updatedat: '' });
  const summary = getProjectStageSummary({ template: 'writing_creative', haspresentation: false }, 0, 0, null,
    [record('report_research', 'extraction'), record('writing_creative', 'draft'), record('writing_creative', 'presentation')]);
  assert.equal(summary.completedStageCount, 1);
  assert.equal(summary.totalStageCount, 5);
  assert.equal(summary.currentStage.label, '주제·소재 정하기');
});

test('favorites sort first, preserve deadline order, and filter to favorites', () => {
  const projects = [
    { id: 'a', deadline: '2026-10-20', updatedat: '1', createdat: '1' },
    { id: 'b', deadline: '2026-10-18', updatedat: '2', createdat: '2' },
    { id: 'c', deadline: '2026-10-19', updatedat: '3', createdat: '3' },
  ];
  const favoriteIds = new Set(['a', 'c']);
  assert.deepEqual(sortProjectsWithFavorites(projects, favoriteIds, 'deadline').map((project) => project.id), ['c', 'a', 'b']);
  assert.deepEqual(sortProjectsWithFavorites(projects, favoriteIds, 'deadline', true).map((project) => project.id), ['c', 'a']);
  assert.deepEqual(sortProjectsWithFavorites(projects, new Set(), 'deadline', true), []);
  assert.equal(projects[0].id, 'a');
});

test('favorite creation and removal roll back their UI state when storage fails', async () => {
  let visible = new Set();
  const show = (ids) => { visible = ids; };
  const added = await changeFavoriteWithRollback(visible, 'p', show, async (shouldAdd) => {
    assert.equal(shouldAdd, true);
    return {};
  });
  assert.deepEqual(added, {});
  assert.equal(visible.has('p'), true);
  const failed = await changeFavoriteWithRollback(visible, 'p', show, async (shouldAdd) => {
    assert.equal(shouldAdd, false);
    assert.equal(visible.has('p'), false);
    return { error: '저장 실패' };
  });
  assert.equal(failed.error, '저장 실패');
  assert.equal(visible.has('p'), true);
  const removed = await changeFavoriteWithRollback(visible, 'p', show, async () => ({}));
  assert.deepEqual(removed, {});
  assert.equal(visible.has('p'), false);
});
