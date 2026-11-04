import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMindMapExportPayload,
  getExpandedMindMapNodes,
  mindMapMarkdownFileName,
  mindMapToFigmaPrompt,
  mindMapToMarkdown,
  mindMapToOutline,
  mindMapToScript,
  saveMindMapMarkdown,
} from '../src/lib/mind-map-export.ts';

const node = (id, parentnodeid, title, sortorder = 0, extra = {}) => ({
  id, parentnodeid, title, sortorder, nodetype: parentnodeid ? 'branch' : 'root',
  ideaid: null, summary: '', ...extra,
});

test('exports use distinct formats while keeping source details in Markdown', () => {
  const nodes = [
    node('root', null, '우리 프로젝트'),
    node('branch', 'root', '문제와 해결', 0),
    node('idea', 'branch', '노트 앱', 0, { nodetype: 'idea', ideaid: 'a', summary: '수업 내용을 정리' }),
    node('detail', 'idea', '음성 입력', 0, { nodetype: 'branch' }),
  ];
  const ideas = [{ id: 'a', title: 'AI 노트', summary: '수업 내용을 정리', problem: '필기가 어렵다', targetusers: ['학생'], solution: '음성 자동 정리', corefeatures: ['녹음', '요약'], keywords: ['AI', '학습'] }];
  const payload = createMindMapExportPayload('우리 프로젝트', nodes, ideas);
  const markdown = mindMapToMarkdown(payload);
  const outline = mindMapToOutline(payload);
  const script = mindMapToScript(payload);
  const figma = mindMapToFigmaPrompt(payload);
  assert.match(markdown, /^# 우리 프로젝트/m);
  assert.match(markdown, /^## 문제와 해결/m);
  assert.match(markdown, /^- AI 노트/m);
  for (const value of ['문제: 필기가 어렵다', '타깃 사용자: 학생', '해결 방식: 음성 자동 정리', '핵심 기능: 녹음', '핵심 기능: 요약', '키워드: AI', '음성 입력']) {
    assert.ok(markdown.includes(value), value);
  }
  assert.match(outline, /1\. 시작 \/ 주제 소개/);
  assert.match(outline, /2\. AI 노트/);
  assert.match(outline, /문제: 필기가 어렵다/);
  assert.doesNotMatch(outline, /키워드: AI/);
  assert.match(script, /도입:.*우리 프로젝트/);
  assert.match(script, /이 아이디어가 다루는 문제는 “필기가 어렵다”입니다/);
  assert.doesNotMatch(script, /설명할 내용$/m);
  assert.match(figma, /Figma에서 편집 가능한 마인드맵/);
  assert.match(figma, /노드 구조:/);
  assert.match(figma, /음성 입력/);
  assert.doesNotMatch(figma, /키워드: AI/);
});

test('an idea shown in three field branches exports each field once', () => {
  const nodes = [
    node('root', null, '축제'),
    node('problem', 'root', '문제', 0, { branchfield: 'problem' }),
    node('target', 'root', '대상 사용자', 1, { branchfield: 'targetusers' }),
    node('solution', 'root', '해결 방법', 2, { branchfield: 'solution' }),
    node('a-problem', 'problem', '대기시간 앱', 0, { nodetype: 'idea_field', ideaid: 'a', ideafield: 'problem', summary: '줄을 선 뒤에야 품절을 알게 됨' }),
    node('a-target', 'target', '대기시간 앱', 0, { nodetype: 'idea_field', ideaid: 'a', ideafield: 'targetusers', summary: '축제 참여 학생' }),
    node('a-solution', 'solution', '대기시간 앱', 0, { nodetype: 'idea_field', ideaid: 'a', ideafield: 'solution', summary: '대기시간과 남은 메뉴 표시' }),
  ];
  const ideas = [{ id: 'a', title: '대기시간 앱', problem: '줄을 선 뒤에야 품절을 알게 됨', targetusers: ['축제 참여 학생'], solution: '대기시간과 남은 메뉴 표시', corefeatures: ['대기시간 표시'], keywords: ['축제'] }];
  const payload = createMindMapExportPayload('축제', nodes, ideas);
  const markdown = mindMapToMarkdown(payload);
  const outline = mindMapToOutline(payload);
  const script = mindMapToScript(payload);
  assert.equal(markdown.split('줄을 선 뒤에야 품절을 알게 됨').length - 1, 1);
  assert.equal(markdown.split('축제 참여 학생').length - 1, 1);
  assert.equal(markdown.split('대기시간과 남은 메뉴 표시').length - 1, 1);
  assert.equal(markdown.split('핵심 기능: 대기시간 표시').length - 1, 1);
  assert.equal(outline.split('2. 대기시간 앱').length - 1, 1);
  assert.equal(script.split('이 아이디어가 다루는 문제는').length - 1, 1);
  assert.match(mindMapToFigmaPrompt(payload), /같은 이름의 아이디어가 여러 가지에 있어도/);
});

test('collapse filters map descendants, while export retains them', () => {
  const nodes = [node('root', null, '제목'), node('branch', 'root', '장'), node('child', 'branch', '내용'), node('deep', 'child', '깊은 내용')];
  assert.deepEqual(getExpandedMindMapNodes(nodes, new Set(['branch'])).map((item) => item.id), ['root', 'branch']);
  assert.deepEqual(getExpandedMindMapNodes(nodes, new Set()).map((item) => item.id), nodes.map((item) => item.id));
  assert.ok(mindMapToMarkdown(createMindMapExportPayload('제목', nodes, [])).includes('깊은 내용'));
  assert.doesNotThrow(() => createMindMapExportPayload('빈 지도', [], []));
  assert.match(mindMapToOutline(createMindMapExportPayload('루트', [node('root', null, '루트')], [])), /시작 \/ 주제 소개/);
});

test('Markdown filename is safe and failed save preserves the copy fallback', async () => {
  assert.equal(mindMapMarkdownFileName('  주제:/ 발표?  '), '주제__ 발표_.md');
  assert.equal(mindMapMarkdownFileName(' . '), 'mind-map.md');
  const payload = createMindMapExportPayload('주제:/ 발표?', [node('root', null, '주제:/ 발표?')], []);
  let savedName = '';
  const saved = await saveMindMapMarkdown(payload, async (content, fileName, mimeType) => {
    savedName = fileName;
    assert.equal(mimeType, 'text/markdown');
    assert.match(content, /^# 주제:\/ 발표\?/);
  });
  assert.equal(saved.saved, true);
  assert.equal(savedName, '주제__ 발표_.md');
  const failed = await saveMindMapMarkdown(payload, async () => { throw new Error('공유 불가'); });
  assert.deepEqual(failed, { saved: false, error: '공유 불가' });
  assert.ok(mindMapToMarkdown(payload).length > 0);
});
