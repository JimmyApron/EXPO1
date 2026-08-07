import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyIdeaFieldDraft,
  createIdeaFieldNodes,
  getIdeaFieldDraftValue,
  getMindMapNodeIdeaField,
  layoutMindMapNodes,
  validateMindMapIdeaField,
} from '../src/lib/mind-map.ts';

function makeIdea(overrides = {}) {
  return {
    id: 'idea-a',
    projectid: 'project',
    userid: 'user',
    title: 'A',
    content: '',
    status: 'thought',
    category: 'planning',
    isfavorite: false,
    legacystructural: false,
    parentnodeid: null,
    x: null,
    y: null,
    side: null,
    sourceid: null,
    summary: '전체 요약은 필드 노드에 사용하지 않는다',
    problem: '',
    targetusers: [],
    solution: '',
    keywords: [],
    corefeatures: [],
    createdat: '',
    updatedat: '',
    ...overrides,
  };
}

test('populated structured fields create exactly one field node each', () => {
  const nodes = createIdeaFieldNodes(makeIdea({
    problem: '학생들이 과제 일정을 자주 놓친다',
    targetusers: ['중학생', '고등학생'],
    solution: 'AI가 과제 일정을 자동으로 정리해준다',
    corefeatures: ['과제 OCR', '마감 알림', '일정 추천'],
    keywords: ['AI', '학습', '일정 관리'],
  }));

  assert.deepEqual(nodes.map((node) => node.ideafield), ['problem', 'targetusers', 'solution', 'corefeatures', 'keywords']);
  assert.equal(nodes[0].summary, '학생들이 과제 일정을 자주 놓친다');
  assert.equal(nodes[1].summary, '• 중학생\n• 고등학생');
  assert.equal(nodes[3].summary, '• 과제 OCR\n• 마감 알림\n• 일정 추천');
  assert.ok(nodes.every((node) => !node.summary.includes('전체 요약')));
});

test('empty fields are omitted and repeated conversion is deterministic', () => {
  const idea = makeIdea({ problem: '문제', solution: '해결' });
  const first = createIdeaFieldNodes(idea);
  const second = createIdeaFieldNodes(idea);

  assert.deepEqual(first, second);
  assert.deepEqual(first.map((node) => `${node.ideaid}:${node.ideafield}`), ['idea-a:problem', 'idea-a:solution']);
  assert.equal(new Set(first.map((node) => `${node.ideaid}:${node.ideafield}`)).size, first.length);
});

test('focused field drafts map to their real scalar and line-based array fields', () => {
  const emptyInput = {
    title: '아이디어',
    summary: '',
    problem: '',
    targetusers: [],
    solution: '',
    corefeatures: [],
    keywords: [],
  };
  const withProblem = applyIdeaFieldDraft(emptyInput, 'problem', '  일정이 복잡하다  ');
  const withUsers = applyIdeaFieldDraft(emptyInput, 'targetusers', '학생\n\n 교사 \n학생');
  const withSolution = applyIdeaFieldDraft(emptyInput, 'solution', '  일정을 자동 정리한다  ');
  const withFeatures = applyIdeaFieldDraft(emptyInput, 'corefeatures', 'OCR\n알림');
  const withKeywords = applyIdeaFieldDraft(emptyInput, 'keywords', 'AI\n일정 관리');

  assert.equal(withProblem.problem, '일정이 복잡하다');
  assert.deepEqual(withUsers.targetusers, ['학생', '교사', '학생']);
  assert.equal(withSolution.solution, '일정을 자동 정리한다');
  assert.deepEqual(withFeatures.corefeatures, ['OCR', '알림']);
  assert.deepEqual(withKeywords.keywords, ['AI', '일정 관리']);
  assert.equal(withUsers.summary, '');
  assert.equal(validateMindMapIdeaField(emptyInput, 'targetusers'), '대상 사용자 내용을 입력해 주세요.');
  assert.equal(validateMindMapIdeaField(withUsers, 'targetusers'), '');
  assert.equal(getIdeaFieldDraftValue(makeIdea({ corefeatures: ['OCR', '알림'] }), 'corefeatures'), 'OCR\n알림');
});

test('add context follows the fixed branch for both branches and their idea nodes', () => {
  const base = { mindmapid: 'map', userid: 'user', ideafield: null, ideaid: null, title: '', summary: '', x: 0, y: 0, sortorder: 0, createdat: '', updatedat: '' };
  const branch = { ...base, id: 'users', parentnodeid: 'root', branchfield: 'targetusers', nodetype: 'branch' };
  const child = { ...base, id: 'users-child', parentnodeid: branch.id, branchfield: null, ideafield: 'targetusers', ideaid: 'idea-a', nodetype: 'idea_field' };
  const customBranch = { ...base, id: 'custom', parentnodeid: 'root', branchfield: null, nodetype: 'branch' };

  assert.equal(getMindMapNodeIdeaField(branch, [branch, child, customBranch]), 'targetusers');
  assert.equal(getMindMapNodeIdeaField(child, [branch, child, customBranch]), 'targetusers');
  assert.equal(getMindMapNodeIdeaField(customBranch, [branch, child, customBranch]), null);
});

test('layout reserves non-overlapping vertical space for branch subtrees', () => {
  const base = { mindmapid: 'map', userid: 'user', ideafield: null, ideaid: null, title: '', summary: '', x: 0, y: 0, sortorder: 0, createdat: '', updatedat: '' };
  const root = { ...base, id: 'root', parentnodeid: null, branchfield: null, nodetype: 'root' };
  const problem = { ...base, id: 'problem', parentnodeid: 'root', branchfield: 'problem', nodetype: 'branch', title: '문제' };
  const users = { ...base, id: 'users', parentnodeid: 'root', branchfield: 'targetusers', nodetype: 'branch', title: '대상 사용자' };
  const children = Array.from({ length: 8 }, (_, index) => ({
    ...base,
    id: `problem-${index}`,
    parentnodeid: 'problem',
    branchfield: null,
    ideaid: `idea-${index}`,
    ideafield: 'problem',
    nodetype: 'idea_field',
    title: `아이디어 ${index}`,
    sortorder: index,
  }));
  const userChild = { ...base, id: 'users-0', parentnodeid: 'users', branchfield: null, ideaid: 'idea-0', ideafield: 'targetusers', nodetype: 'idea_field' };
  const laidOut = layoutMindMapNodes([root, problem, users, ...children, userChild]);
  const problemYs = laidOut.filter((node) => node.parentnodeid === 'problem').map((node) => node.y);
  const userYs = laidOut.filter((node) => node.parentnodeid === 'users').map((node) => node.y);

  assert.ok(Math.max(...problemYs) + 104 / 2 < Math.min(...userYs) - 104 / 2);
});
