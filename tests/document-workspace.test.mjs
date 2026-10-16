import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyWorkspace, normalizeWorkspace, newOutlineItem, moveOutline, restoreVersion, snapshot, manuscriptFingerprint, stageValidation, citationDraft } from '../src/lib/document-workspace.ts';
import { getTopicBranches, getTopicFields, getTopicLabels, normalizeProjectSettings, normalizeTopicDetails, topicSearchText } from '../src/lib/topic-workspace.ts';
import { workspaceDocumentHtml, workspaceExportText } from '../src/lib/workspace-export.ts';
import { createMindMapExportPayload, mindMapToMarkdown } from '../src/lib/mind-map-export.ts';

test('all templates reuse topic cards with distinct labels and fields', () => {
  assert.equal(getTopicLabels('report_research').list, '조사 주제 목록');
  assert.equal(getTopicLabels('writing_creative').map, '창작 마인드맵');
  assert.equal(getTopicLabels('service_app').list, '아이디어 목록');
  assert.equal(getTopicLabels('unknown').map, '마인드맵');
  assert.deepEqual(getTopicFields('report_research').map(f => f.key), ['purpose', 'questions', 'scope']);
  assert.deepEqual(getTopicFields('writing_creative').map(f => f.key), ['message', 'mood', 'development']);
  assert.equal(normalizeTopicDetails({ message: '보존', mood: 42 }).message, '보존');
  assert.equal(normalizeTopicDetails({ mood: 42 }).mood, '');
});
test('genre defaults cover the brief and free writing starts without fixed branches', () => {
  assert.deepEqual(getTopicBranches('report_research'), ['조사 배경', '핵심 질문', '주요 키워드', '조사 범위', '관련 자료·근거']);
  assert.deepEqual(getTopicBranches('writing_creative', 'fiction'), ['등장인물', '배경', '주요 사건', '갈등', '전개', '결말']);
  assert.deepEqual(getTopicBranches('writing_creative', 'script'), ['인물', '장소', '장면', '사건', '대사']);
  assert.deepEqual(getTopicBranches('writing_creative', 'poetry'), ['중심 정서', '이미지', '표현', '주요 구절']);
  assert.deepEqual(getTopicBranches('writing_creative', 'free'), []);
  assert.equal(normalizeProjectSettings({ targetLength: -1, writingKind: 'invalid' }).targetLength, null);
  assert.equal(normalizeProjectSettings({ targetLength: Infinity }).targetLength, null);
  assert.equal(normalizeProjectSettings({ writingKind: 'invalid' }).writingKind, 'essay');
});
test('moving a section moves its whole subtree while bodies stay attached to IDs', () => {
  const items = [newOutlineItem('첫 장', null, 'a'), newOutlineItem('하위 장', 'a', 'child'), newOutlineItem('둘째 장', null, 'b')];
  items[0].body = '첫 장 원고'; items[1].body = '하위 원고'; items[2].body = '둘째 원고';
  const moved = moveOutline(items, 'a', 1);
  assert.deepEqual(moved.map(i => i.id), ['b', 'a', 'child']);
  assert.equal(moved.find(i => i.id === 'child').body, '하위 원고');
  assert.deepEqual(items.map(i => i.id), ['a', 'child', 'b']);
  assert.deepEqual(moveOutline(moved, 'a', -1).map(i => i.id), ['a', 'child', 'b']);
});
test('restoring an older version archives current text and keeps version copies independent', () => {
  const w = emptyWorkspace('원고'); w.freeBody = '처음 쓴 원고'; w.outline = [newOutlineItem('장')]; w.outline[0].body = '원본 장';
  const old = snapshot(w, '초안'); w.freeBody = '현재 원고'; w.outline[0].body = '수정 장';
  assert.equal(old.outline[0].body, '원본 장');
  const restored = restoreVersion(w, old);
  assert.equal(restored.freeBody, '처음 쓴 원고');
  assert.equal(restored.versions.at(-1).freeBody, '현재 원고');
  restored.outline[0].body = '복원 후 편집';
  assert.equal(old.outline[0].body, '원본 장');
  assert.equal(restored.finalVersionId, null);
});
test('manual writing can complete without AI but empty work cannot complete', () => {
  const w = emptyWorkspace();
  assert.ok(stageValidation(w, 'report_research', 'extraction', false));
  assert.equal(stageValidation(w, 'report_research', 'extraction', true), '');
  assert.ok(stageValidation(w, 'report_research', 'selection', true));
  w.resources.push({ title: '등록한 자료', url: 'https://example.com', content: '' });
  assert.equal(stageValidation(w, 'report_research', 'selection', true), '');
  w.freeBody = '직접 작성한 글';
  assert.equal(stageValidation(w, 'writing_creative', 'revision', true), '');
  assert.equal(stageValidation(w, 'writing_creative', 'result', true), '');
  assert.equal(w.feedback.length, 0);
});
test('final fingerprints ignore collapse state but detect text and source links', () => {
  const w = emptyWorkspace('제목'); w.outline = [newOutlineItem('장')];
  const before = manuscriptFingerprint(w); w.outline[0].collapsed = true;
  assert.equal(manuscriptFingerprint(w), before);
  w.outline[0].body = '새 원고'; assert.notEqual(manuscriptFingerprint(w), before);
});
test('exports preserve Unicode and only registered citations while escaping executable HTML', () => {
  const w = emptyWorkspace('한글 과제'); w.freeBody = '**굵은 글**\n<script>alert(1)</script>';
  w.resources = [{ id: 'r', title: '실제 등록한 자료', author: '', source: '', date: '', url: 'https://example.com', used: true }];
  const text = workspaceExportText(w, normalizeProjectSettings(), true);
  assert.ok(text.includes('실제 등록한 자료')); assert.ok(text.includes('[작성자 확인 필요]'));
  const html = workspaceDocumentHtml(text, w.title);
  assert.ok(html.includes('<strong>굵은 글</strong>')); assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(html.includes('<script>'), false);
  assert.deepEqual(citationDraft(w.resources[0], 'APA').missing, ['작성자·기관', '발행일', '출처명']);
});
test('new search fields participate without changing original idea fields', () => {
  const idea = { title: '제목', content: '설명', summary: '', problem: '', solution: '', corefeatures: [], targetusers: [], keywords: ['탐색'], details: { message: '숨은 메시지' } };
  assert.ok(topicSearchText(idea).includes('숨은 메시지'));
  assert.ok(topicSearchText(idea).includes('탐색'));
  assert.equal(normalizeWorkspace(null, '이전 과제').title, '이전 과제');
});
test('research and creative map exports include their own fields and source description', () => {
  const idea = { id: 'i', title: '소재', content: '원래 설명', keywords: ['주제'], details: normalizeTopicDetails({ message: '전하고 싶은 말', mood: '차분함' }) };
  const nodes = [{ id: 'root', title: '창작', nodetype: 'root', parentnodeid: null, sortorder: 0, summary: '' }, { id: 'n', title: '소재', nodetype: 'idea', ideaid: 'i', parentnodeid: 'root', sortorder: 0, summary: '오래된 설명' }];
  const text = mindMapToMarkdown(createMindMapExportPayload('창작', nodes, [idea], 'writing_creative'));
  assert.ok(text.includes('핵심 메시지: 전하고 싶은 말')); assert.ok(text.includes('분위기: 차분함'));
  assert.ok(text.includes('원래 설명')); assert.equal(text.includes('오래된 설명'), false);
});
