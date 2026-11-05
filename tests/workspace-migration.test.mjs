// Run with the temporary PGlite package described in docs/typed-workspaces.md.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../.expo/workspace-verification/node_modules/@electric-sql/pglite/dist/index.js';

const owner = '10000000-0000-0000-0000-000000000001', teammate = '10000000-0000-0000-0000-000000000002', outsider = '10000000-0000-0000-0000-000000000003';
const project = '20000000-0000-0000-0000-000000000001', otherProject = '20000000-0000-0000-0000-000000000002', service = '20000000-0000-0000-0000-000000000003';
const idea = '30000000-0000-0000-0000-000000000001', otherIdea = '30000000-0000-0000-0000-000000000002';

test('migration executes with RLS, revision conflicts, generic map sync and original service preservation', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to authenticated; grant execute on function auth.uid() to authenticated;
      create table public.projects(id uuid primary key, userid uuid references auth.users, roomid uuid, title text, description text default '', updatedat timestamptz default now(), template text default 'service_app');
      create table public.roommembers(roomid uuid, userid uuid);
      grant select on public.roommembers to authenticated;
      alter table public.projects enable row level security;
      create policy project_access on public.projects to authenticated using (userid = auth.uid() or exists(select 1 from public.roommembers r where r.roomid = projects.roomid and r.userid = auth.uid()));
      grant select, update on public.projects to authenticated;
      create table public.ideas(id uuid primary key default gen_random_uuid(), projectid uuid references public.projects on delete cascade, userid uuid references auth.users, title text, content text default '', parentnodeid uuid, side text, x int, y int, summary text default '', problem text default '', targetusers text[] default '{}', solution text default '', corefeatures text[] default '{}', keywords text[] default '{}', createdat timestamptz default now());
      alter table public.ideas enable row level security;
      create policy idea_access on public.ideas to authenticated using (exists(select 1 from public.projects p where p.id = projectid));
      grant select, insert, update, delete on public.ideas to authenticated;
      create table public.project_stage_progress(projectid uuid references public.projects, template text, stageid text, content text default '', iscompleted boolean default false, updatedat timestamptz default now(), primary key(projectid,template,stageid));
      alter table public.project_stage_progress enable row level security;
      create policy stage_access on public.project_stage_progress to authenticated using(exists(select 1 from public.projects p where p.id = projectid));
      grant select,insert,update on public.project_stage_progress to authenticated;
    `);
    for (const name of ['20260807230000_add_project_mind_maps.sql', '20260808000000_add_mind_map_idea_fields.sql', '20260916100000_allow_manual_field_node_reclassification.sql']) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
    }
    await db.exec(`insert into auth.users values ('${owner}'),('${teammate}'),('${outsider}');
      insert into public.projects(id,userid,roomid,title,template) values('${project}','${owner}','40000000-0000-0000-0000-000000000001','보고서','report_research'),('${otherProject}','${outsider}',null,'다른 과제','report_research'),('${service}','${owner}',null,'기존 서비스','service_app');
      insert into public.roommembers values('40000000-0000-0000-0000-000000000001','${teammate}');
      insert into public.ideas(id,projectid,userid,title,content,problem) values('${idea}','${project}','${owner}','조사 주제','조사 설명','기존 필드 보존'),('${otherIdea}','${otherProject}','${outsider}','다른 주제','다른 설명','');
      insert into public.mindmaps(projectid,userid,title) values('${service}','${owner}','기존 서비스 맵');
      insert into public.mind_map_nodes(mindmapid,userid,nodetype,title) select id,'${owner}','root','기존 서비스 맵' from public.mindmaps where projectid='${service}';`);
    const before = (await db.query(`select row_to_json(n) as row from public.mind_map_nodes n join public.mindmaps m on m.id = n.mindmapid where m.projectid = $1`, [service])).rows;
    await db.exec(await readFile(new URL('../supabase/migrations/20261017020000_typed_workspaces_shared_topics.sql', import.meta.url), 'utf8'));
    const after = (await db.query(`select row_to_json(n) as row from public.mind_map_nodes n join public.mindmaps m on m.id = n.mindmapid where m.projectid = $1`, [service])).rows;
    assert.deepEqual(after, before, 'service nodes must be unchanged by migration');

    async function login(id) { await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${id}';`); }
    await login(owner);
    const data = { selectedIdeaId: idea, title: '보고서', outline: [{ id: 'a', title: '첫 항목', body: '초안', collapsed: false }], freeBody: '', resources: [], evidence: [] };
    const save = (revision, value = data) => db.query('select * from public.save_project_workspace($1,$2,$3,$4::jsonb)', [project, 'report_research', revision, JSON.stringify(value)]);
    const saved = await save(0); assert.equal(saved.rows[0].revision, 1);
    await assert.rejects(save(0), /먼저 저장/);
    assert.equal((await db.query('select data from public.project_workspaces')).rows[0].data.outline[0].body, '초안');
    await db.exec(`insert into public.project_stage_progress(projectid,template,stageid,iscompleted) values('${project}','report_research','result',true);`);
    const edited = structuredClone(data); edited.outline[0].body = '수정 원고';
    assert.equal((await save(1, edited)).rows[0].revision, 2);
    assert.equal((await db.query('select iscompleted from public.project_stage_progress')).rows[0].iscompleted, false, 'editing first outline body invalidates completed manuscript');
    await db.exec(`update public.project_stage_progress set iscompleted = true;`);
    edited.outline[0].collapsed = true;
    await save(2, edited);
    assert.equal((await db.query('select iscompleted from public.project_stage_progress')).rows[0].iscompleted, true, 'collapse alone must not invalidate work');

    const sync = target => db.query('select public.sync_topic_map($1,$2::uuid[],$3,$4::text[],$5::uuid)', [project, [idea], '조사 주제', ['조사 배경', '핵심 질문'], target ?? null]);
    await sync(); await sync();
    const map = (await db.query('select * from public.mindmaps where projectid=$1', [project])).rows[0];
    assert.equal((await db.query("select * from public.mind_map_nodes where mindmapid=$1 and nodetype='idea'", [map.id])).rows.length, 1, 'repeat sync must not duplicate cards');
    const branches = (await db.query("select * from public.mind_map_nodes where mindmapid=$1 and nodetype='branch' order by sortorder", [map.id])).rows;
    await sync(branches[1].id);
    assert.equal((await db.query("select parentnodeid from public.mind_map_nodes where mindmapid=$1 and nodetype='idea'", [map.id])).rows[0].parentnodeid, branches[1].id);
    await db.query('update public.ideas set title=$1,content=$2 where id=$3', ['수정된 조사 주제', '변경된 설명', idea]);
    assert.equal((await db.query("select title from public.mind_map_nodes where mindmapid=$1 and nodetype='idea'", [map.id])).rows[0].title, '수정된 조사 주제');
    await db.query('delete from public.mind_map_nodes where id=$1', [branches[1].id]);
    assert.equal((await db.query('select id from public.ideas where id=$1', [idea])).rows.length, 1, 'branch deletion must preserve the actual card');
    await sync();
    assert.equal((await db.query("select * from public.mind_map_nodes where mindmapid=$1 and title='핵심 질문'", [map.id])).rows.length, 0, 'deleted default branches must not reappear');
    await assert.rejects(db.query("insert into public.mind_map_nodes(mindmapid,userid,parentnodeid,ideaid,nodetype,title) values($1,$2,$3,$4,'idea','잘못된 연결')", [map.id, owner, branches[0].id, otherIdea]), /같은 과제/);
    await login(teammate);
    assert.equal((await db.query('select * from public.project_workspaces')).rows.length, 1, 'team members can read shared work');
    await save(3, edited);
    await login(outsider);
    assert.equal((await db.query('select * from public.project_workspaces')).rows.length, 0, 'outsiders cannot see shared work');
    await assert.rejects(save(4, edited), /접근 권한/);
    await login(owner);
    await db.query('delete from public.ideas where id=$1', [idea]);
    assert.equal((await db.query('select data from public.project_workspaces')).rows[0].data.selectedIdeaId, null);
    assert.equal((await db.query('select id from public.mind_map_nodes where ideaid=$1', [idea])).rows.length, 0, 'card deletion cascades all placements');
  } finally { await db.close(); }
});
