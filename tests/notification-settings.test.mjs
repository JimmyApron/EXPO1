import assert from 'node:assert/strict';
import test from 'node:test';

import { allNotificationTogglePatch, notificationsAreEnabled } from '../src/lib/notification-settings.ts';

const categories = [
  'deadline', 'ideareview', 'finalselection', 'stalledidea', 'feedback', 'likesurge',
  'team_evaluation', 'team_reminder', 'team_feedback', 'team_changes', 'team_room',
];

test('the master switch changes every personal and team notification category', () => {
  const off = allNotificationTogglePatch(false);
  const on = allNotificationTogglePatch(true);
  assert.deepEqual(Object.keys(off).sort(), [...categories, 'push_enabled'].sort());
  assert.ok(categories.every((key) => off[key] === false && on[key] === true));
  assert.equal(off.push_enabled, false);
  assert.equal(on.push_enabled, true);
  assert.equal(notificationsAreEnabled(off), false);
  assert.equal(notificationsAreEnabled(on), true);
});

test('in-app notifications can stay on when native push registration is unavailable', () => {
  const settings = allNotificationTogglePatch(true, false);
  assert.equal(settings.push_enabled, false);
  assert.equal(notificationsAreEnabled(settings), true);
});

test('enabling one category turns the master switch back on', () => {
  const settings = { ...allNotificationTogglePatch(false), deadline: true };
  assert.equal(notificationsAreEnabled(settings), true);
  assert.ok(categories.filter((key) => key !== 'deadline').every((key) => settings[key] === false));
});
