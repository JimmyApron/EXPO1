import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../.expo/workspace-verification/node_modules/@electric-sql/pglite/dist/index.js';

test('project RLS keeps personal owners and team members while blocking outsiders', async () => {
  const db = new PGlite();
  const owner = '10000000-0000-0000-0000-000000000001';
  const member = '10000000-0000-0000-0000-000000000002';
  const outsider = '10000000-0000-0000-0000-000000000003';
  const room = '20000000-0000-0000-0000-000000000001';
  const personal = '30000000-0000-0000-0000-000000000001';
  const team = '30000000-0000-0000-0000-000000000002';
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      grant usage on schema auth to authenticated;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select current_user::text$$;
      grant execute on all functions in schema auth to authenticated;
      create table public.rooms(id uuid primary key,ownerid uuid,name text);
      create table public.roommembers(id uuid primary key default gen_random_uuid(),roomid uuid,userid uuid);
      create function public.is_room_member(p_room uuid,p_user uuid) returns boolean language sql stable security definer
        as $$select exists(select 1 from public.roommembers where roomid=p_room and userid=p_user)$$;
      create table public.projects(id uuid primary key,userid uuid,roomid uuid,title text);
      create table public.projectflows(projectid uuid primary key,userid uuid,selectedideaid uuid,presentationdata jsonb);
      create table public.project_workspaces(projectid uuid,template text,data jsonb);
      create table public.ideas(id uuid primary key,projectid uuid,userid uuid,title text);
      create table public.ideacategories(id uuid primary key,projectid uuid,userid uuid);
      create table public.idealikes(id uuid primary key,ideaid uuid,userid uuid);
      create table public.feedbacks(id uuid primary key,ideaid uuid,userid uuid,isresolved boolean,updatedat timestamptz);
      create table public.project_evaluations(id uuid primary key,projectid uuid,evaluatorid uuid,ideaid uuid);
      create table public.project_evaluation_participants(id uuid primary key,projectid uuid,userid uuid);
      create table public.ideaevaluations(id uuid primary key,projectid uuid,userid uuid,ideaid uuid);
      grant select on public.roommembers,public.rooms to authenticated;
      grant select,insert,update,delete on public.ideaevaluations,public.project_evaluations,public.project_evaluation_participants to authenticated;
    `);
    const source = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
    await db.exec(await source('20261017030000_watt_entitlements_and_usage.sql'));
    await db.exec((await source('20261017120000_watt_auto_renewal_realtime.sql'))
      .replace(/create extension if not exists pg_cron[\s\S]*$/i, ''));
    await db.exec((await source('20261022100000_watt_text_usage_policy.sql'))
      .replace(/do \$\$\nbegin\n  if exists\(select 1 from cron\.job where jobname='watt-usage-recovery'\)[\s\S]*?end \$\$;/i, ''));
    await db.exec(await source('20261022110000_watt_api_security_rls.sql'));
    await db.exec(await source('20261022120000_watt_premium_presentations.sql'));
    await db.exec(await source('20261024100000_fix_projects_insert_returning_rls.sql'));
    await db.exec(await source('20261024110000_remove_watt_per_minute_limit.sql'));
    await db.query('insert into auth.users(id) values($1),($2),($3)', [owner, member, outsider]);
    await db.query('insert into public.rooms(id,ownerid,name) values($1,$2,$3)', [room, owner, '팀']);
    await db.query('insert into public.roommembers(roomid,userid) values($1,$2),($1,$3)', [room, owner, member]);
    await db.query('insert into public.projects(id,userid,roomid,title) values($1,$3,null,$5),($2,$3,$4,$5)', [personal, team, owner, room, '원본']);
    await db.query('insert into public.projectflows(projectid,userid) values($1,$3),($2,$3)', [personal, team, owner]);
    await db.query("select public.watt_activate($1,'personal_30',null,false)", [owner]);
    const reservation = await db.query('select public.watt_reserve_usage($1,$2,$3,$4,null,1,$5,false) as result',
      [owner, crypto.randomUUID(), 'analyze-idea-draft', personal, 'a'.repeat(64)]);
    assert.equal(reservation.rows[0].result.units, 0);
    await db.query('select public.watt_settle_usage($1,true,null,200,$2,$3::jsonb)',
      [reservation.rows[0].result.usage_id, '{"ok":true}', '[]']);
    for (let n = 0; n < 4; n++) {
      const next = await db.query('select public.watt_reserve_usage($1,$2,$3,$4,null,1,$5,false) as result',
        [owner, crypto.randomUUID(), 'analyze-idea-draft', personal, 'd'.repeat(64)]);
      assert.equal(next.rows[0].result.state, 'reserved');
      await db.query('select public.watt_settle_usage($1,true,null,200,$2,$3::jsonb)',
        [next.rows[0].result.usage_id, '{"ok":true}', '[]']);
    }
    await assert.rejects(db.query('select public.watt_reserve_usage($1,$2,$3,$4,null,1,$5,false)',
      [outsider, crypto.randomUUID(), 'analyze-idea-draft', personal, 'b'.repeat(64)]), /project_access_denied/);
    await db.exec(`set request.jwt.claim.sub='${owner}'; set role authenticated;`);
    await assert.rejects(db.query('select public.watt_reserve_usage($1,$2,$3,$4,null,1,$5,false)',
      [owner, crypto.randomUUID(), 'analyze-idea-draft', personal, 'c'.repeat(64)]), /permission denied/);
    assert.equal((await db.query('select count(*)::int as n from public.projects')).rows[0].n, 2);
    await db.query("update public.projects set title='소유자 수정' where id=$1", [personal]);
    assert.equal((await db.query('select title from public.projects where id=$1', [personal])).rows[0].title, '소유자 수정');
    const newPersonal = crypto.randomUUID();
    await db.query('insert into public.projects(id,userid,roomid,title) values($1,$2,null,$3) returning id', [newPersonal, owner, '새 개인 과제']);
    await db.exec(`reset role; set request.jwt.claim.sub='${member}'; set role authenticated;`);
    assert.equal((await db.query('select count(*)::int as n from public.projects')).rows[0].n, 1);
    const newTeam = crypto.randomUUID();
    await db.query('insert into public.projects(id,userid,roomid,title) values($1,$2,$3,$4) returning id', [newTeam, member, room, '새 팀 과제']);
    await db.query("update public.projectflows set presentationdata='{}'::jsonb where projectid=$1", [team]);
    assert.deepEqual((await db.query('select presentationdata from public.projectflows where projectid=$1', [team])).rows[0].presentationdata, {});
    await db.exec(`reset role; set request.jwt.claim.sub='${outsider}'; set role authenticated;`);
    assert.equal((await db.query('select count(*)::int as n from public.projects')).rows[0].n, 0);
    await assert.rejects(
      db.query('insert into public.projects(id,userid,roomid,title) values($1,$2,$3,$4) returning id',
        [crypto.randomUUID(), outsider, room, '무단 팀 과제']),
      /row-level security policy/,
    );
    assert.equal((await db.query("update public.projects set title='침입' where id=$1", [team])).affectedRows, 0);
    assert.equal((await db.query('select count(*)::int as n from public.projectflows')).rows[0].n, 0);
  } finally { await db.close(); }
});
