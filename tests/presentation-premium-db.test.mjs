import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../.expo/workspace-verification/node_modules/@electric-sql/pglite/dist/index.js';

const user = '10000000-0000-0000-0000-000000000001';
const project = '20000000-0000-0000-0000-000000000001';
const idea = '30000000-0000-0000-0000-000000000001';
const otherIdea = '30000000-0000-0000-0000-000000000002';
const core = (theme, title = '원본') => ({ presentationTitle: title,
  settings: { title, pageCount: 1, theme },
  slides: [{ slideNumber: 1, title, bulletPoints: ['내용'], speakerScript: '대본' }],
  expectedQna: [], businessPlanDraft: '', finalReport: '' });
const saveFlow = (db, data) => db.query('update public.projectflows set presentationdata=$1::jsonb where projectid=$2', [JSON.stringify(data), project]);

test('premium themes require a live entitlement, while persisted premium versions survive expiry', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table public.projects(id uuid primary key, userid uuid, roomid uuid);
      create table public.watt_entitlements(user_id uuid,room_id uuid,state text,ends_at timestamptz,product_id text);
      create table public.projectflows(projectid uuid primary key,presentationdata jsonb);
      create table public.project_workspaces(projectid uuid,template text,data jsonb);
      create function public.watt_can_access_project(p_project_id uuid,p_user_id uuid)
      returns boolean language sql stable security definer as $$
        select p_user_id=auth.uid() and exists(select 1 from public.projects where id=p_project_id and userid=p_user_id) $$;
      grant select on public.projects to authenticated;
      grant select,insert,update on public.projectflows,public.project_workspaces to authenticated;
    `);
    await db.query('insert into public.projects(id,userid) values($1,$2)', [project, user]);
    const migration = await readFile(new URL('../supabase/migrations/20261022120000_watt_premium_presentations.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(`set request.jwt.claim.sub = '${user}'; set role authenticated;`);

    await assert.rejects(db.query('insert into public.projectflows(projectid,presentationdata) values($1,$2::jsonb)',
      [project, JSON.stringify({ ...core('modern-dark'), ideaId: idea, versionHistory: [] })]), /premium_presentation_subscription_required/);
    await db.exec('reset role');
    await db.query("insert into public.watt_entitlements(user_id,state,ends_at,product_id) values($1,'active',now()+interval '1 day','personal_30')", [user]);
    await db.exec('set role authenticated');
    await db.query('insert into public.projectflows(projectid,presentationdata) values($1,$2::jsonb)',
      [project, JSON.stringify({ ...core('modern-dark'), ideaId: idea, versionHistory: [] })]);
    await db.exec('reset role');
    await db.query("update public.watt_entitlements set ends_at=now()-interval '1 day'");
    await db.exec('set role authenticated');

    await saveFlow(db, { ...core('modern-dark', '편집'), ideaId: idea, versionHistory: [] });
    await assert.rejects(saveFlow(db, { ...core('business', '편집'), ideaId: idea, versionHistory: [] }), /premium_presentation_subscription_required/);
    await assert.rejects(saveFlow(db, { ...core('modern-dark', '새 아이디어'), ideaId: otherIdea, versionHistory: [] }), /premium_presentation_subscription_required/);
    const approved = core('modern-dark', '편집');
    const history = [{ id: 'v1', snapshot: approved }];
    await saveFlow(db, { ...core('minimal-light'), ideaId: idea, versionHistory: history });
    await assert.rejects(saveFlow(db, { ...core('minimal-light'), ideaId: idea,
      versionHistory: [...history, { id: 'forged', snapshot: core('business') }] }), /premium_presentation_history_immutable/);
    await saveFlow(db, { ...approved, ideaId: idea, versionHistory: history });
    const restored = await db.query("select presentationdata #>> '{settings,theme}' as theme from public.projectflows where projectid=$1", [project]);
    assert.equal(restored.rows[0].theme, 'modern-dark');

    await db.query('insert into public.project_workspaces(projectid,template,data) values($1,$2,$3::jsonb)',
      [project, 'report_research', JSON.stringify({ presentation: { theme: 'minimal-light' }, selectedIdeaId: idea, slides: [] })]);
    await assert.rejects(db.query('update public.project_workspaces set data=$1::jsonb where projectid=$2',
      [JSON.stringify({ presentation: { theme: 'business' }, selectedIdeaId: idea, slides: [] }), project]), /premium_presentation_subscription_required/);
    await db.exec('reset role');
    await db.query("update public.watt_entitlements set ends_at=now()+interval '1 day'");
    await db.exec('set role authenticated');
    await db.query('update public.project_workspaces set data=$1::jsonb where projectid=$2',
      [JSON.stringify({ presentation: { theme: 'business' }, selectedIdeaId: idea, slides: [] }), project]);
    await db.exec('reset role');
    await db.query("update public.watt_entitlements set ends_at=now()-interval '1 day'");
    await db.exec('set role authenticated');
    await db.query('update public.project_workspaces set data=$1::jsonb where projectid=$2',
      [JSON.stringify({ presentation: { theme: 'business' }, selectedIdeaId: idea, slides: [{ title: '편집' }] }), project]);
    await assert.rejects(db.query('update public.project_workspaces set data=$1::jsonb where projectid=$2',
      [JSON.stringify({ presentation: { theme: 'business' }, selectedIdeaId: otherIdea, slides: [] }), project]), /premium_presentation_subscription_required/);
  } finally { await db.close(); }
});
