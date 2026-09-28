import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCoachInputFingerprint,
  isCoachAnalysisStale,
  isMvpPlanCurrent,
  isPresentationCurrent,
} from '../src/lib/project-flow.ts';
import {
  getNextProjectWorkflowStep,
  getProjectProgressLabel,
  resolveProjectWorkspaceLocation,
} from '../src/lib/project-workspace.ts';

const conditions = {
  durationWeeks: 6,
  teamSize: 4,
  skillLevel: '초급~중급',
  budget: 100000,
  evaluationCriteria: ['창의성', '구현 가능성'],
};

function makeIdea(id, title) {
  return {
    id,
    projectid: 'project',
    userid: 'user',
    title,
    content: `${title} 내용`,
    status: 'approved',
    category: 'planning',
    isfavorite: false,
    legacystructural: false,
    parentnodeid: null,
    x: null,
    y: null,
    side: null,
    sourceid: null,
    summary: `${title} 요약`,
    problem: '',
    targetusers: [],
    solution: '',
    keywords: [],
    corefeatures: [],
    createdat: '',
    updatedat: '',
  };
}

test('coach fingerprint is order-independent and changes with meaningful inputs', () => {
  const first = makeIdea('a', '첫 아이디어');
  const second = makeIdea('b', '둘째 아이디어');
  const fingerprint = createCoachInputFingerprint([first, second], conditions);

  assert.equal(fingerprint, createCoachInputFingerprint([second, first], conditions));
  assert.notEqual(fingerprint, createCoachInputFingerprint([first], conditions));
  assert.notEqual(fingerprint, createCoachInputFingerprint([{ ...first, problem: '새 문제' }, second], conditions));
  assert.notEqual(fingerprint, createCoachInputFingerprint([first, second], { ...conditions, budget: 200000 }));
  assert.equal(isCoachAnalysisStale({ inputFingerprint: fingerprint }, fingerprint), false);
  assert.equal(isCoachAnalysisStale({ inputFingerprint: 'old' }, fingerprint), true);
  assert.equal(isCoachAnalysisStale({}, fingerprint), true);
  assert.equal(isCoachAnalysisStale(null, fingerprint), false);
});

test('MVP and presentation remain tied to the idea they were generated from', () => {
  const oldPlan = { ideaId: 'old' };
  const currentPlan = { ideaId: 'current' };
  const oldPresentation = { ideaId: 'old' };
  const currentPresentation = { ideaId: 'current' };

  assert.equal(isMvpPlanCurrent(oldPlan, 'current'), false);
  assert.equal(isMvpPlanCurrent(currentPlan, 'current'), true);
  assert.equal(isPresentationCurrent(oldPresentation, 'current', currentPlan), false);
  assert.equal(isPresentationCurrent(currentPresentation, 'current', currentPlan), true);
  assert.equal(isPresentationCurrent(currentPresentation, 'current', oldPlan), false);
});

test('project workspace keeps old ideaTab links compatible with the new information architecture', () => {
  assert.deepEqual(resolveProjectWorkspaceLocation({}), { section: 'home', step: 'extraction' });
  assert.deepEqual(resolveProjectWorkspaceLocation({ ideaTab: 'list' }), { section: 'ideas', step: 'extraction' });
  assert.deepEqual(resolveProjectWorkspaceLocation({ ideaTab: 'mindmap' }), { section: 'mindmap', step: 'extraction' });
  assert.deepEqual(resolveProjectWorkspaceLocation({ ideaTab: 'coach' }), { section: 'home', step: 'selection' });
  assert.deepEqual(resolveProjectWorkspaceLocation({ ideaTab: 'mvp' }), { section: 'home', step: 'mvp' });
  assert.deepEqual(resolveProjectWorkspaceLocation({ ideaTab: 'presentation' }), { section: 'home', step: 'presentation' });
  assert.deepEqual(
    resolveProjectWorkspaceLocation({ projectView: 'home', flowStep: 'presentation', ideaTab: 'coach' }),
    { section: 'home', step: 'presentation' },
  );
});

test('project home recommends the first unfinished workflow step', () => {
  const empty = { hasIdeas: false, hasSelectedIdea: false, hasCurrentMvp: false, hasCurrentPresentation: false };
  const selecting = { ...empty, hasIdeas: true };
  const planning = { ...selecting, hasSelectedIdea: true };
  const presenting = { ...planning, hasCurrentMvp: true };
  const complete = { ...presenting, hasCurrentPresentation: true };

  assert.equal(getNextProjectWorkflowStep(empty), 'extraction');
  assert.equal(getNextProjectWorkflowStep(selecting), 'selection');
  assert.equal(getNextProjectWorkflowStep(planning), 'mvp');
  assert.equal(getNextProjectWorkflowStep(presenting), 'presentation');
  assert.equal(getNextProjectWorkflowStep(complete), 'presentation');
  assert.equal(getProjectProgressLabel(complete), '최종 결과물 완성');
});
