import { normalizeProjectTemplate } from './project-stages.ts';
import { normalizeProjectSettings } from './topic-workspace.ts';
import type { Project } from '../types/project';

export const PROJECT_SELECT = 'id, userid, roomid, title, description, deadline, template, haspresentation, settings, createdat, updatedat';
export const LEGACY_PROJECT_SELECT = 'id, userid, roomid, title, description, deadline, createdat, updatedat';
export const TEMPLATE_PROJECT_SELECT = 'id, userid, roomid, title, description, deadline, template, haspresentation, createdat, updatedat';

export function isMissingProjectSettings(error: DatabaseError) {
  return Boolean(error && (error.code === '42703' || error.code === 'PGRST204') && /\bsettings\b/i.test(error.message));
}

type DatabaseError = { code?: string; message: string } | null;

export function isMissingProjectTemplateColumn(error: DatabaseError) {
  return Boolean(error && (error.code === '42703' || error.code === 'PGRST204')
    && /(?:projects\.)?(?:template|haspresentation|settings)/i.test(error.message));
}

export function isMissingProjectFeatureTable(error: DatabaseError, table: 'project_favorites' | 'project_stage_progress') {
  return Boolean(error && (error.code === '42P01' || error.code === 'PGRST205'
      || error.code === '42703' || error.code === 'PGRST204')
    && error.message.includes(table));
}

export function normalizeProjectRow(row: Record<string, unknown>): Project {
  return {
    ...row,
    template: normalizeProjectTemplate(typeof row.template === 'string' ? row.template : null),
    haspresentation: typeof row.haspresentation === 'boolean' ? row.haspresentation : true,
    settings: normalizeProjectSettings(row.settings),
  } as Project;
}
