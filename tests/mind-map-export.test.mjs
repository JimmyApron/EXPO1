import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMindMapExportPayload,
  getExpandedMindMapNodes,
  mindMapMarkdownFileName,
  mindMapToMarkdown,
  mindMapToOutline,
  mindMapToScript,
  mindMapToStructuredText,
  saveMindMapMarkdown,
} from '../src/lib/mind-map-export.ts';

const node = (id, parentnodeid, title, sortorder = 0, extra = {}) => ({
  id, parentnodeid, title, sortorder, nodetype: parentnodeid ? 'branch' : 'root',
  ideaid: null, summary: '', ...extra,
});

test('Markdown, script, outline and Figma text retain hierarchy and all idea details', () => {
  const nodes = [
    node('root', null, '우리 프로젝트'),
    node('branch', 'root', '문제와 해결', 0),
    node('idea', 'branch', '노트 앱', 0, { nodetype: 'idea', ideaid: 'a', summary: '수업 내용을 정리' }),
    node('detail', 'idea', '음성 입력', 0, { nodetype: 'branch' }),
  ];
  const ideas = [{ id: 'a', title: 'AI 노트', summary: '수업 내용을 정리', problem: '필기가 어렵다', targetusers: ['학생'], solution: '음성 자동 정리', corefeatures: ['녹음', '요약'], keywords: ['AI', '학습'] }];
  const payload = createMindMapExportPayload('우리 프로젝트', nodes, ideas);
  const markdown = mindMapToMarkdown(payload);
  assert.match(markdown, /^# 우리 프로젝트/m);
  assert.match(markdown, /^## 문제와 해결/m);
  assert.match(markdown, /^- AI 노트/m);
  for (const value of ['문제: 필기가 어렵다', '타깃 사용자: 학생', '해결 방식: 음성 자동 정리', '핵심 기능: 녹음', '핵심 기능: 요약', '키워드: AI', '음성 입력']) {
    assert.ok(markdown.includes(value), value);
    assert.ok(mindMapToScript(payload).includes(value), value);
    assert.ok(mindMapToOutline(payload).includes(value), value);
    assert.ok(mindMapToStructuredText(payload).includes(value), value);
  }
  assert.match(mindMapToOutline(payload), /1\. 문제와 해결/);
  assert.match(mindMapToScript(payload), /도입:.*우리 프로젝트/);
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
