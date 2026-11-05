import assert from 'node:assert/strict';
import test from 'node:test';

import { isMissingProjectFeatureTable, isMissingProjectTemplateColumn, normalizeProjectRow } from '../src/lib/project-schema.ts';

test('old project rows get the original template defaults', () => {
  const project = normalizeProjectRow({ id: 'legacy', title: '기존 과제' });
  assert.equal(project.template, 'service_app');
  assert.equal(project.haspresentation, true);
});

test('only missing template columns trigger the legacy project query', () => {
  assert.equal(isMissingProjectTemplateColumn({ code: '42703', message: 'column projects.haspresentation does not exist' }), true);
  assert.equal(isMissingProjectTemplateColumn({ code: '42703', message: 'column projects.template does not exist' }), true);
  assert.equal(isMissingProjectTemplateColumn({ code: '42501', message: 'permission denied for projects' }), false);
});

test('missing favorite columns and stage tables are recognized without hiding other errors', () => {
  assert.equal(isMissingProjectFeatureTable({ code: '42703', message: 'column project_favorites.projectid does not exist' }, 'project_favorites'), true);
  assert.equal(isMissingProjectFeatureTable({ code: 'PGRST205', message: 'Could not find the table public.project_stage_progress in the schema cache' }, 'project_stage_progress'), true);
  assert.equal(isMissingProjectFeatureTable({ code: '42501', message: 'permission denied for project_favorites' }, 'project_favorites'), false);
});
