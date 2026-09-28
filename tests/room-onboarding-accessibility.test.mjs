import assert from 'node:assert/strict';
import test from 'node:test';
import { createKakaoReminderMessage, truncateAssignmentTitle, KAKAO_COPY_SUCCESS } from '../src/utils/share/kakaoReminderMessage.ts';
import { scaledTypography } from '../src/utils/fontSize.ts';
import { experienceStorageKey, parseExperience, readExperience } from '../src/utils/onboardingStorage.ts';

test('titles trim, preserve 24 characters, truncate 25 and handle empty and Unicode', () => {
  for (const letter of ['a', '가', '😀']) {
    assert.equal(truncateAssignmentTitle(` ${letter.repeat(24)} `), letter.repeat(24));
    assert.equal(truncateAssignmentTitle(letter.repeat(25)), `${letter.repeat(23)}…`);
  }
  for (const value of [undefined, null, '', '   ']) assert.equal(truncateAssignmentTitle(value), '이름 없는 과제');
});
test('copy text exactly matches the requested format and ignores identity fields', () => {
  const message = createKakaoReminderMessage({ assignmentTitle: '과제', completedCount: 2, totalCount: 4, dueDate: '2026-10-01', senderName: 'PRIVATE_NAME', userId: 'PRIVATE_ID', link: 'https://private.example' });
  assert.equal(message, `┌────────────────────┐
│  ✦ 과제 참여 알림 ✦  │
└────────────────────┘

ฅ( ̳• ·̫ • ̳ฅ) ♡

「 과제 」
현재 평가 진행률은
✨ 2 / 4명 완료 ✨

아직 참여 전인 조원분들,
잠깐만 들러서 평가 부탁드려요! ᐢ.  ̫ .ᐢ

🗓 마감: 2026-10-01`);
  assert.doesNotMatch(message, /PRIVATE|https:/);
  assert.equal(KAKAO_COPY_SUCCESS, '카카오톡을 열어 단톡방에 붙여넣어 주세요.');
});
test('missing deadline and completion counts are reflected', () => {
  for (const completedCount of [0, 3, 4]) {
    const message = createKakaoReminderMessage({ completedCount, totalCount: 4 });
    assert.ok(message.includes(`✨ ${completedCount} / 4명 완료 ✨`));
    assert.ok(message.endsWith('🗓 마감: 미정'));
  }
});
test('small text never falls below 14 and large text scales with adequate line height', () => {
  for (const size of [9, 12, 14, 16, 30]) {
    assert.ok(scaledTypography(size, size, 'small').fontSize >= 14);
    const large = scaledTypography(size, size, 'large');
    assert.ok(large.fontSize >= size);
    assert.ok(large.lineHeight >= large.fontSize * 1.4);
  }
});

test('first visit, completion and invalid preference values have safe defaults', () => {
  assert.deepEqual(parseExperience(null), { completed: false, fontSize: 'default' });
  assert.deepEqual(parseExperience('{"completed":true,"fontSize":"large"}'), { completed: true, fontSize: 'large' });
  assert.deepEqual(parseExperience('{"completed":"true","fontSize":"huge"}'), { completed: false, fontSize: 'default' });
  assert.deepEqual(parseExperience('null'), { completed: false, fontSize: 'default' });
  assert.notEqual(experienceStorageKey('A'), experienceStorageKey('B'));
});

test('storage failures and corrupt data resolve safely instead of blocking entry', async () => {
  for (const getItem of [async () => { throw new Error('offline'); }, async () => '{invalid']) {
    const result = await readExperience({ getItem }, 'A');
    assert.equal(result.failed, true);
    assert.deepEqual(result.preferences, { completed: false, fontSize: 'default' });
  }
  const result = await readExperience({ getItem: async key => key === experienceStorageKey('A') ? '{"completed":true}' : null }, 'A');
  assert.equal(result.failed, false);
  assert.equal(result.preferences.completed, true);
});
