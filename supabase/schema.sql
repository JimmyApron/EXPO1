create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key,
  email text not null,
  nickname text not null,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

alter table profiles disable row level security;

grant select, insert, update, delete on table profiles to authenticated;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  userid uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  deadline date,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

alter table projects
  add column if not exists description text not null default '',
  add column if not exists deadline date,
  add column if not exists createdat timestamptz not null default now(),
  add column if not exists updatedat timestamptz not null default now();

alter table projects disable row level security;

create index if not exists projectsuseridcreatedatidx
  on projects (userid, createdat desc);

grant select, insert, update, delete on table projects to authenticated;

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  userid uuid not null references auth.users(id) on delete cascade,
  title text not null,
  deadline date,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

alter table assignments disable row level security;

create index if not exists assignmentsuseridcreatedatidx
  on assignments (userid, createdat desc);

grant select, insert, update, delete on table assignments to authenticated;

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  ownerid uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  invitecode text not null unique,
  allowmemberinvite boolean not null default true,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

alter table rooms
  add column if not exists ownerid uuid references auth.users(id) on delete cascade,
  add column if not exists description text not null default '',
  add column if not exists invitecode text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  add column if not exists allowmemberinvite boolean not null default true,
  add column if not exists createdat timestamptz not null default now(),
  add column if not exists updatedat timestamptz not null default now();

alter table rooms
  alter column invitecode set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

alter table rooms disable row level security;

create unique index if not exists roomsinvitecodeidx
  on rooms (invitecode);

create index if not exists roomsowneridcreatedatidx
  on rooms (ownerid, createdat desc);

grant select, insert, update, delete on table rooms to authenticated;

create table if not exists roommembers (
  id uuid primary key default gen_random_uuid(),
  roomid uuid not null references rooms(id) on delete cascade,
  userid uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now(),
  constraint roommembersrolecheck check (role in ('owner', 'admin', 'member')),
  constraint roommembersroomiduseridkey unique (roomid, userid)
);

alter table roommembers disable row level security;

create index if not exists roommembersuserididx
  on roommembers (userid);

create index if not exists roommembersroomididx
  on roommembers (roomid);

grant select, insert, update, delete on table roommembers to authenticated;

create table if not exists roominvites (
  id uuid primary key default gen_random_uuid(),
  roomid uuid not null references rooms(id) on delete cascade,
  invitedemail text,
  invitedby uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  status text not null default 'pending',
  expiresat timestamptz,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now(),
  constraint roominvitesstatuscheck check (status in ('pending', 'accepted', 'declined', 'canceled'))
);

alter table roominvites disable row level security;

alter table roominvites
  alter column code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

create index if not exists roominvitesroomidcreatedatidx
  on roominvites (roomid, createdat desc);

create index if not exists roominvitescodeidx
  on roominvites (code);

grant select, insert, update, delete on table roominvites to authenticated;

create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),
  userid uuid not null references auth.users(id) on delete cascade,
  projectid uuid references projects(id) on delete cascade,
  title text not null,
  content text not null default '',
  status text not null default 'thought',
  category text not null default 'planning',
  isfavorite boolean not null default false,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now(),
  parentnodeid uuid null references ideas(id) on delete set null,
  x integer null,
  y integer null,
  side text null,
  assignmentid uuid null references assignments(id) on delete set null,
  author text null
);

alter table ideas
  add column if not exists content text not null default '',
  add column if not exists status text not null default 'thought',
  add column if not exists category text not null default 'planning',
  add column if not exists isfavorite boolean not null default false,
  add column if not exists createdat timestamptz not null default now(),
  add column if not exists updatedat timestamptz not null default now(),
  add column if not exists parentnodeid uuid null,
  add column if not exists x integer null,
  add column if not exists y integer null,
  add column if not exists side text null,
  add column if not exists assignmentid uuid null,
  add column if not exists author text null,
  add column if not exists sourceid text null,
  add column if not exists summary text not null default '',
  add column if not exists problem text not null default '',
  add column if not exists targetusers text[] not null default '{}',
  add column if not exists solution text not null default '',
  add column if not exists keywords text[] not null default '{}',
  add column if not exists corefeatures text[] not null default '{}';

alter table ideas
  alter column status set default 'thought',
  alter column category set default 'planning';

update ideas
set status = 'thought'
where status not in ('thought', 'research', 'approved', 'selected');

alter table ideas
  drop constraint if exists ideas_status_check;

alter table ideas
  drop constraint if exists ideas_category_check;

alter table ideas
  add constraint ideas_status_check
  check (status in ('thought', 'research', 'approved', 'selected'));

alter table ideas disable row level security;

create table if not exists ideacategories (
  id uuid primary key default gen_random_uuid(),
  userid uuid not null references auth.users(id) on delete cascade,
  projectid uuid not null references projects(id) on delete cascade,
  name text not null,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

alter table ideacategories
  add column if not exists userid uuid references auth.users(id) on delete cascade,
  add column if not exists projectid uuid references projects(id) on delete cascade,
  add column if not exists name text not null default '',
  add column if not exists createdat timestamptz not null default now(),
  add column if not exists updatedat timestamptz not null default now();

delete from ideacategories
where projectid is null
  or userid is null
  or btrim(name) = '';

alter table ideacategories
  alter column userid set not null,
  alter column projectid set not null,
  alter column name set not null,
  alter column name drop default,
  alter column createdat set not null,
  alter column updatedat set not null;

alter table ideacategories disable row level security;

create unique index if not exists ideacategoriesprojectidnameidx
  on ideacategories (projectid, lower(name));

create index if not exists ideacategoriesuseridprojectididx
  on ideacategories (userid, projectid);

grant select, insert, update, delete on table ideacategories to authenticated;

alter table projects
  add column if not exists roomid uuid null references rooms(id) on delete set null;

create index if not exists projectsroomidcreatedatidx
  on projects (roomid, createdat desc);

create index if not exists ideasprojectidcreatedatidx
  on ideas (projectid, createdat desc);

create index if not exists ideasuseridprojectididx
  on ideas (userid, projectid);

create index if not exists ideasprojectidcategoryidx
  on ideas (projectid, category);

create index if not exists ideasprojectidfavoriteidx
  on ideas (projectid, isfavorite)
  where isfavorite = true;

grant select, insert, update, delete on table ideas to authenticated;

create table if not exists idealikes (
  id uuid primary key default gen_random_uuid(),
  ideaid uuid not null references ideas(id) on delete cascade,
  userid uuid not null references auth.users(id) on delete cascade,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

alter table idealikes
  add column if not exists id uuid,
  add column if not exists ideaid uuid,
  add column if not exists userid uuid,
  add column if not exists createdat timestamptz not null default now(),
  add column if not exists updatedat timestamptz not null default now();

alter table idealikes
  alter column id set default gen_random_uuid(),
  alter column createdat set default now(),
  alter column updatedat set default now();

update idealikes
set id = gen_random_uuid()
where id is null;

update idealikes
set
  createdat = coalesce(createdat, now()),
  updatedat = coalesce(updatedat, createdat, now())
where createdat is null
  or updatedat is null;

update idealikes like_row
set id = gen_random_uuid()
from (
  select
    ctid,
    row_number() over (
      partition by id
      order by createdat asc, ctid asc
    ) as rownumber
  from idealikes
) duplicate_ids
where like_row.ctid = duplicate_ids.ctid
  and duplicate_ids.rownumber > 1;

delete from idealikes like_row
where like_row.ideaid is null
  or like_row.userid is null
  or not exists (
    select 1
    from ideas idea_row
    where idea_row.id = like_row.ideaid
  )
  or not exists (
    select 1
    from auth.users user_row
    where user_row.id = like_row.userid
  );

delete from idealikes like_row
using (
  select id
  from (
    select
      id,
      row_number() over (
        partition by ideaid, userid
        order by createdat asc, id asc
      ) as rownumber
    from idealikes
  ) ranked_likes
  where ranked_likes.rownumber > 1
) duplicate_likes
where like_row.id = duplicate_likes.id;

alter table idealikes
  alter column id set not null,
  alter column ideaid set not null,
  alter column userid set not null,
  alter column createdat set not null,
  alter column updatedat set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.idealikes'::regclass
      and contype = 'p'
  ) then
    alter table idealikes
      add constraint idealikes_pkey primary key (id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_attribute attribute_row
      on attribute_row.attrelid = constraint_row.conrelid
      and attribute_row.attnum = any(constraint_row.conkey)
    where constraint_row.conrelid = 'public.idealikes'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.ideas'::regclass
      and attribute_row.attname = 'ideaid'
  ) then
    alter table idealikes
      add constraint idealikesideaidfkey
      foreign key (ideaid) references ideas(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_attribute attribute_row
      on attribute_row.attrelid = constraint_row.conrelid
      and attribute_row.attnum = any(constraint_row.conkey)
    where constraint_row.conrelid = 'public.idealikes'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'auth.users'::regclass
      and attribute_row.attname = 'userid'
  ) then
    alter table idealikes
      add constraint idealikesuseridfkey
      foreign key (userid) references auth.users(id) on delete cascade;
  end if;
end $$;

alter table idealikes disable row level security;

create unique index if not exists idealikesideaiduseridkey
  on idealikes (ideaid, userid);

create index if not exists idealikesideaidcreatedatidx
  on idealikes (ideaid, createdat desc);

create index if not exists idealikesuseridcreatedatidx
  on idealikes (userid, createdat desc);

grant select, insert, update, delete on table idealikes to authenticated;

create table if not exists feedbacks (
  id uuid primary key default gen_random_uuid(),
  userid uuid not null references auth.users(id) on delete cascade,
  ideaid uuid not null references ideas(id) on delete cascade,
  comment text not null,
  isresolved boolean not null default false,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

alter table feedbacks
  add column if not exists comment text not null default '',
  add column if not exists isresolved boolean not null default false,
  add column if not exists createdat timestamptz not null default now(),
  add column if not exists updatedat timestamptz not null default now();

alter table feedbacks disable row level security;

create index if not exists feedbacksideaidcreatedatidx
  on feedbacks (ideaid, createdat desc);

create index if not exists feedbacksuseridcreatedatidx
  on feedbacks (userid, createdat desc);

grant select, insert, update, delete on table feedbacks to authenticated;

create table if not exists projectflows (
  id uuid primary key default gen_random_uuid(),
  projectid uuid not null unique references projects(id) on delete cascade,
  userid uuid not null references auth.users(id) on delete cascade,
  durationweeks integer not null default 6,
  teamsize integer not null default 4,
  skilllevel text not null default '초급~중급',
  budget integer not null default 100000,
  evaluationcriteria text[] not null default array['창의성', '구현 가능성', '사용자 편의성', '완성도'],
  selectedideaid uuid null references ideas(id) on delete set null,
  coachresult jsonb null,
  blindanalysis jsonb null,
  evaluationround integer not null default 1,
  mvpplan jsonb null,
  presentationdata jsonb null,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now(),
  constraint projectflowsdurationweekscheck check (durationweeks between 1 and 104),
  constraint projectflowsteamsizecheck check (teamsize between 1 and 100),
  constraint projectflowsbudgetcheck check (budget >= 0),
  constraint projectflowsevaluationroundcheck check (evaluationround >= 1)
);

alter table projectflows disable row level security;

create index if not exists projectflowsuseridupdatedatidx
  on projectflows (userid, updatedat desc);

grant select, insert, update, delete on table projectflows to authenticated;

-- Secure room management. Keep this section synchronized with
-- migrations/20260807153000_secure_room_management.sql.
-- Secure room management and keep rooms.ownerid in sync with the sole owner membership.

do $$
begin
  if exists (
    select 1
    from public.rooms as r
    left join public.roommembers as rm on rm.roomid = r.id
    group by r.id, r.ownerid
    having r.ownerid is null
      or count(*) filter (where rm.role = 'owner') <> 1
      or count(*) filter (where rm.role = 'owner' and rm.userid = r.ownerid) <> 1
  ) then
    raise exception using
      errcode = 'P0001',
      message = '방장 데이터가 올바르지 않아 마이그레이션을 적용할 수 없습니다. rooms.ownerid와 owner 멤버를 먼저 확인해 주세요.';
  end if;
end
$$;

-- Blind swipe evaluations. Keep names lowercase without underscores.
create table if not exists public.ideaevaluations (
  id uuid primary key default gen_random_uuid(),
  projectid uuid not null references public.projects(id) on delete cascade,
  ideaid uuid not null references public.ideas(id) on delete cascade,
  userid uuid not null references auth.users(id) on delete cascade,
  choice text not null check (choice in ('pass', 'pick')),
  evaluationround integer not null default 1 check (evaluationround >= 1),
  locked boolean not null default true check (locked),
  createdat timestamptz not null default now(),
  constraint ideaevaluationsprojectideaiduseridroundkey unique (projectid, ideaid, userid, evaluationround)
);

create index if not exists ideaevaluationsprojectidideaididx
  on public.ideaevaluations (projectid, evaluationround, ideaid);

alter table public.ideaevaluations enable row level security;

create policy "ideaevaluations_select_project_members"
  on public.ideaevaluations for select to authenticated using (true);

create policy "ideaevaluations_insert_self"
  on public.ideaevaluations for insert to authenticated with check (userid = auth.uid());

create or replace function public.reject_idea_evaluation_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  raise exception using errcode = 'P0001', message = 'Submitted blind evaluations are locked.';
end;
$$;

create trigger ideaevaluationsimmutable
  before update or delete on public.ideaevaluations
  for each row execute function public.reject_idea_evaluation_change();

grant select, insert on table public.ideaevaluations to authenticated;

create or replace function public.restart_blind_evaluation(target_project_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not exists (
    select 1
    from public.projects as p
    where p.id = target_project_id
      and (
        p.userid = actor_id
        or (p.roomid is not null and public.is_room_member(p.roomid, actor_id))
      )
  ) then
    raise exception using errcode = '42501', message = '프로젝트 멤버만 블라인드 평가를 다시 시작할 수 있습니다.';
  end if;

  update public.ideas
  set status = 'approved', updatedat = now()
  where projectid = target_project_id and status = 'selected';

  update public.projectflows
  set selectedideaid = null,
      coachresult = null,
      blindanalysis = null,
      evaluationround = evaluationround + 1,
      updatedat = now()
  where projectid = target_project_id;
end;
$$;

revoke all on function public.restart_blind_evaluation(uuid) from public, anon;
grant execute on function public.restart_blind_evaluation(uuid) to authenticated;

-- Deleting an idea changes the candidate set, so any stored AI comparison is stale.
create or replace function public.invalidate_coach_result_after_idea_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.projectflows
  set coachresult = null,
      blindanalysis = null,
      updatedat = now()
  where projectid = old.projectid;

  return old;
end;
$$;

drop trigger if exists ideasinvalidatecoachresultafterdelete on public.ideas;
create trigger ideasinvalidatecoachresultafterdelete
  after delete on public.ideas
  for each row execute function public.invalidate_coach_result_after_idea_delete();

create table if not exists public.project_evaluations (
  id uuid primary key default gen_random_uuid(),
  projectid uuid not null references public.projects(id) on delete cascade,
  ideaid uuid not null references public.ideas(id) on delete cascade,
  evaluatorid uuid not null references auth.users(id) on delete cascade,
  scores jsonb not null default '{}'::jsonb,
  submittedat timestamptz not null default now(),
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now(),
  constraint project_evaluations_project_idea_evaluator_key unique (projectid, ideaid, evaluatorid)
);

create index if not exists project_evaluations_project_idea_idx on public.project_evaluations (projectid, ideaid);
alter table public.project_evaluations enable row level security;
drop policy if exists project_evaluations_select on public.project_evaluations;
create policy project_evaluations_select on public.project_evaluations for select to authenticated using (evaluatorid = auth.uid());
drop policy if exists project_evaluations_insert on public.project_evaluations;
create policy project_evaluations_insert on public.project_evaluations for insert to authenticated with check (evaluatorid = auth.uid() and exists (select 1 from public.projects p where p.id = projectid and (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))) and exists (select 1 from public.ideas i where i.id = ideaid and i.projectid = projectid));
drop policy if exists project_evaluations_update on public.project_evaluations;
create policy project_evaluations_update on public.project_evaluations for update to authenticated using (evaluatorid = auth.uid()) with check (evaluatorid = auth.uid());
grant select, insert, update on public.project_evaluations to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_evaluations') then
    alter publication supabase_realtime add table public.project_evaluations;
  end if;
end
$$;

-- Project mind maps keep structural nodes separate from ideas.
alter table public.ideas add column if not exists legacystructural boolean not null default false;

update public.ideas
set legacystructural = true
where legacystructural = false and parentnodeid is null and side = 'center';

create table if not exists public.mindmaps (
  id uuid primary key default gen_random_uuid(),
  projectid uuid not null unique references public.projects(id) on delete cascade,
  userid uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

create table if not exists public.mind_map_nodes (
  id uuid primary key default gen_random_uuid(),
  mindmapid uuid not null references public.mindmaps(id) on delete cascade,
  userid uuid not null references auth.users(id) on delete cascade,
  parentnodeid uuid null references public.mind_map_nodes(id) on delete cascade,
  ideaid uuid null references public.ideas(id) on delete cascade,
  ideafield text null check (ideafield is null or ideafield in ('problem', 'targetusers', 'solution', 'corefeatures', 'keywords')),
  branchfield text null check (branchfield is null or branchfield in ('problem', 'targetusers', 'solution', 'corefeatures', 'keywords')),
  nodetype text not null check (nodetype in ('root', 'branch', 'idea', 'idea_field')),
  title text not null default '',
  summary text not null default '',
  x integer not null default 0,
  y integer not null default 0,
  sortorder integer not null default 0,
  ismanualposition boolean not null default false,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now(),
  constraint mind_map_nodes_idea_type_check check (
    (nodetype = 'root' and ideaid is null and ideafield is null and branchfield is null) or
    (nodetype = 'branch' and ideaid is null and ideafield is null) or
    (nodetype = 'idea' and ideaid is not null and ideafield is null and branchfield is null) or
    (nodetype = 'idea_field' and ideaid is not null and ideafield is not null and branchfield is null)
  )
);

create unique index if not exists mind_map_nodes_one_root_idx on public.mind_map_nodes (mindmapid) where nodetype = 'root';
create unique index if not exists mind_map_nodes_one_field_branch_idx on public.mind_map_nodes (mindmapid, branchfield);
create unique index if not exists mind_map_nodes_one_idea_field_idx on public.mind_map_nodes (mindmapid, ideaid, ideafield);
create index if not exists mind_map_nodes_parent_idx on public.mind_map_nodes (mindmapid, parentnodeid, sortorder);

alter table public.mindmaps enable row level security;
alter table public.mind_map_nodes enable row level security;

drop policy if exists mindmaps_select on public.mindmaps;
create policy mindmaps_select on public.mindmaps for select to authenticated using (exists (select 1 from public.projects p where p.id = projectid and (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));
drop policy if exists mindmaps_insert on public.mindmaps;
create policy mindmaps_insert on public.mindmaps for insert to authenticated with check (userid = auth.uid() and exists (select 1 from public.projects p where p.id = projectid and (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));
drop policy if exists mindmaps_update on public.mindmaps;
create policy mindmaps_update on public.mindmaps for update to authenticated using (exists (select 1 from public.projects p where p.id = projectid and (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid())))) with check (exists (select 1 from public.projects p where p.id = projectid and (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));
drop policy if exists mindmaps_delete on public.mindmaps;
create policy mindmaps_delete on public.mindmaps for delete to authenticated using (exists (select 1 from public.projects p where p.id = projectid and (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));

drop policy if exists mind_map_nodes_select on public.mind_map_nodes;
create policy mind_map_nodes_select on public.mind_map_nodes for select to authenticated using (exists (select 1 from public.mindmaps m where m.id = mindmapid));
drop policy if exists mind_map_nodes_insert on public.mind_map_nodes;
create policy mind_map_nodes_insert on public.mind_map_nodes for insert to authenticated with check (userid = auth.uid() and exists (select 1 from public.mindmaps m where m.id = mindmapid));
drop policy if exists mind_map_nodes_update on public.mind_map_nodes;
create policy mind_map_nodes_update on public.mind_map_nodes for update to authenticated using (exists (select 1 from public.mindmaps m where m.id = mindmapid)) with check (exists (select 1 from public.mindmaps m where m.id = mindmapid));
drop policy if exists mind_map_nodes_delete on public.mind_map_nodes;
create policy mind_map_nodes_delete on public.mind_map_nodes for delete to authenticated using (exists (select 1 from public.mindmaps m where m.id = mindmapid));

grant select, insert, update, delete on public.mindmaps, public.mind_map_nodes to authenticated;

alter table public.rooms alter column ownerid set not null;

create unique index if not exists roommembers_one_owner_per_room_idx
  on public.roommembers (roomid)
  where role = 'owner';

create table if not exists public.roombans (
  id uuid primary key default gen_random_uuid(),
  roomid uuid not null references public.rooms(id) on delete cascade,
  targetuserid uuid not null references auth.users(id) on delete cascade,
  bannedby uuid references auth.users(id) on delete set null,
  createdat timestamptz not null default now(),
  constraint roombans_roomid_targetuserid_key unique (roomid, targetuserid)
);

create index if not exists roombans_roomid_createdat_idx
  on public.roombans (roomid, createdat desc);

create or replace function public.is_room_member(p_roomid uuid, p_userid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.roommembers as rm
    where rm.roomid = p_roomid and rm.userid = p_userid
  );
$$;

create or replace function public.is_room_manager(p_roomid uuid, p_userid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.roommembers as rm
    where rm.roomid = p_roomid
      and rm.userid = p_userid
      and rm.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_room_owner(p_roomid uuid, p_userid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.rooms as r
    join public.roommembers as rm
      on rm.roomid = r.id and rm.userid = r.ownerid and rm.role = 'owner'
    where r.id = p_roomid and r.ownerid = p_userid
  );
$$;

create or replace function public.room_owner_is_consistent(p_roomid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.rooms as r
    where r.id = p_roomid
      and r.ownerid is not null
      and (
        select count(*)
        from public.roommembers as rm
        where rm.roomid = r.id and rm.role = 'owner'
      ) = 1
      and exists (
        select 1
        from public.roommembers as rm
        where rm.roomid = r.id and rm.userid = r.ownerid and rm.role = 'owner'
      )
  );
$$;

create or replace function public.enforce_room_owner_consistency()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_roomid uuid;
begin
  if tg_table_name = 'rooms' then
    v_roomid := coalesce(new.id, old.id);
  else
    v_roomid := coalesce(new.roomid, old.roomid);
  end if;

  if exists (select 1 from public.rooms as r where r.id = v_roomid)
    and not public.room_owner_is_consistent(v_roomid) then
    raise exception using
      errcode = 'P0001',
      message = '방장 정보가 올바르지 않습니다. rooms.ownerid와 owner 멤버는 정확히 한 명으로 일치해야 합니다.';
  end if;

  return null;
end;
$$;

drop trigger if exists rooms_owner_consistency_trigger on public.rooms;
create constraint trigger rooms_owner_consistency_trigger
after insert or update of ownerid on public.rooms
deferrable initially deferred
for each row execute function public.enforce_room_owner_consistency();

drop trigger if exists roommembers_owner_consistency_trigger on public.roommembers;
create constraint trigger roommembers_owner_consistency_trigger
after insert or update of roomid, userid, role or delete on public.roommembers
deferrable initially deferred
for each row execute function public.enforce_room_owner_consistency();

alter table public.rooms enable row level security;
alter table public.roommembers enable row level security;
alter table public.roominvites enable row level security;
alter table public.roombans enable row level security;

drop policy if exists rooms_member_select on public.rooms;
create policy rooms_member_select on public.rooms
for select to authenticated
using (public.is_room_member(id, auth.uid()));

drop policy if exists roommembers_member_select on public.roommembers;
create policy roommembers_member_select on public.roommembers
for select to authenticated
using (public.is_room_member(roomid, auth.uid()));

drop policy if exists roominvites_member_select on public.roominvites;
create policy roominvites_member_select on public.roominvites
for select to authenticated
using (public.is_room_member(roomid, auth.uid()));

drop policy if exists roombans_owner_select on public.roombans;
create policy roombans_owner_select on public.roombans
for select to authenticated
using (public.is_room_owner(roomid, auth.uid()));

revoke all on table public.rooms from public, anon, authenticated;
revoke all on table public.roommembers from public, anon, authenticated;
revoke all on table public.roominvites from public, anon, authenticated;
revoke all on table public.roombans from public, anon, authenticated;
grant select on table public.rooms, public.roommembers, public.roominvites, public.roombans to authenticated;

create or replace function public.create_room(
  p_name text,
  p_description text default '',
  p_allowmemberinvite boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_roomid uuid;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception using errcode = 'P0001', message = '방 이름을 입력해 주세요.';
  end if;

  insert into public.rooms (ownerid, name, description, allowmemberinvite)
  values (v_actor, btrim(p_name), btrim(coalesce(p_description, '')), coalesce(p_allowmemberinvite, true))
  returning id into v_roomid;

  insert into public.roommembers (roomid, userid, role)
  values (v_roomid, v_actor, 'owner');

  return v_roomid;
end;
$$;

create or replace function public.update_room(
  p_roomid uuid,
  p_name text,
  p_description text default '',
  p_allowmemberinvite boolean default true
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_room public.rooms%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception using errcode = 'P0001', message = '방 이름을 입력해 주세요.';
  end if;

  select * into v_room from public.rooms where id = p_roomid for update;
  if not found then
    raise exception using errcode = 'P0001', message = '방을 찾을 수 없습니다.';
  end if;
  if not public.room_owner_is_consistent(p_roomid) then
    raise exception using errcode = 'P0001', message = '방장 데이터가 올바르지 않아 요청을 처리할 수 없습니다.';
  end if;
  if not public.is_room_manager(p_roomid, v_actor) then
    raise exception using errcode = 'P0001', message = '방 설정을 바꿀 권한이 없습니다.';
  end if;

  update public.rooms
  set name = btrim(p_name),
      description = btrim(coalesce(p_description, '')),
      allowmemberinvite = coalesce(p_allowmemberinvite, true),
      updatedat = now()
  where id = p_roomid;
end;
$$;

create or replace function public.delete_room(p_roomid uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_ownerid uuid;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  end if;
  select ownerid into v_ownerid from public.rooms where id = p_roomid for update;
  if not found then
    raise exception using errcode = 'P0001', message = '방을 찾을 수 없습니다.';
  end if;
  if not public.room_owner_is_consistent(p_roomid) then
    raise exception using errcode = 'P0001', message = '방장 데이터가 올바르지 않아 요청을 처리할 수 없습니다.';
  end if;
  if v_ownerid <> v_actor then
    raise exception using errcode = 'P0001', message = '방장만 방을 삭제할 수 있습니다.';
  end if;
  delete from public.rooms where id = p_roomid;
end;
$$;

create or replace function public.leave_room(p_roomid uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_ownerid uuid;
  v_membercount integer;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  end if;
  select ownerid into v_ownerid from public.rooms where id = p_roomid for update;
  if not found then
    raise exception using errcode = 'P0001', message = '방을 찾을 수 없습니다.';
  end if;
  if not public.room_owner_is_consistent(p_roomid) then
    raise exception using errcode = 'P0001', message = '방장 데이터가 올바르지 않아 요청을 처리할 수 없습니다.';
  end if;
  if not public.is_room_member(p_roomid, v_actor) then
    raise exception using errcode = 'P0001', message = '이미 나간 방이거나 방 멤버가 아닙니다.';
  end if;
  if v_ownerid = v_actor then
    select count(*) into v_membercount from public.roommembers where roomid = p_roomid;
    if v_membercount > 1 then
      raise exception using errcode = 'P0001', message = '다른 멤버가 있어 방을 나갈 수 없습니다. 먼저 방장을 위임해 주세요.';
    end if;
    raise exception using errcode = 'P0001', message = '방장 혼자 남은 방은 나갈 수 없습니다. 방 삭제를 이용해 주세요.';
  end if;
  delete from public.roommembers where roomid = p_roomid and userid = v_actor;
end;
$$;

create or replace function public.join_room_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_room public.rooms%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  end if;
  if nullif(btrim(p_code), '') is null then
    raise exception using errcode = 'P0001', message = '초대코드를 입력해 주세요.';
  end if;

  select * into v_room
  from public.rooms
  where invitecode = upper(btrim(p_code))
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = '사용 가능한 초대코드를 찾을 수 없습니다.';
  end if;
  if not public.room_owner_is_consistent(v_room.id) then
    raise exception using errcode = 'P0001', message = '방장 데이터가 올바르지 않아 참가할 수 없습니다.';
  end if;
  if exists (
    select 1 from public.roombans where roomid = v_room.id and targetuserid = v_actor
  ) then
    raise exception using errcode = 'P0001', message = '이 방에서 강퇴되어 다시 참가할 수 없습니다. 방장에게 강퇴 해제를 요청해 주세요.';
  end if;

  insert into public.roommembers (roomid, userid, role)
  values (v_room.id, v_actor, 'member')
  on conflict (roomid, userid) do nothing;
  return v_room.id;
end;
$$;

create or replace function public.change_room_member_role(
  p_roomid uuid,
  p_target_memberid uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_ownerid uuid;
  v_target public.roommembers%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception using errcode = 'P0001', message = '변경할 수 없는 멤버 권한입니다.';
  end if;
  select ownerid into v_ownerid from public.rooms where id = p_roomid for update;
  if not found then
    raise exception using errcode = 'P0001', message = '방을 찾을 수 없습니다.';
  end if;
  if not public.room_owner_is_consistent(p_roomid) then
    raise exception using errcode = 'P0001', message = '방장 데이터가 올바르지 않아 요청을 처리할 수 없습니다.';
  end if;
  if v_ownerid <> v_actor then
    raise exception using errcode = 'P0001', message = '방장만 멤버 권한을 바꿀 수 있습니다.';
  end if;

  select * into v_target from public.roommembers where id = p_target_memberid;
  if not found then
    raise exception using errcode = 'P0001', message = '대상 사용자가 이미 방을 나갔거나 강퇴되었습니다.';
  end if;
  if v_target.roomid <> p_roomid then
    raise exception using errcode = 'P0001', message = '대상 멤버가 이 방에 속해 있지 않습니다.';
  end if;
  if v_target.role = 'owner' then
    raise exception using errcode = 'P0001', message = '방장의 권한은 변경할 수 없습니다.';
  end if;

  update public.roommembers set role = p_role, updatedat = now() where id = p_target_memberid;
end;
$$;

create or replace function public.transfer_room_ownership(
  p_roomid uuid,
  p_target_memberid uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_ownerid uuid;
  v_target public.roommembers%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  end if;
  select ownerid into v_ownerid from public.rooms where id = p_roomid for update;
  if not found then
    raise exception using errcode = 'P0001', message = '방을 찾을 수 없습니다.';
  end if;
  if not public.room_owner_is_consistent(p_roomid) then
    raise exception using errcode = 'P0001', message = '방장 데이터가 올바르지 않아 위임할 수 없습니다.';
  end if;
  if v_ownerid <> v_actor then
    raise exception using errcode = 'P0001', message = '더 이상 방장이 아닙니다. 방 정보를 새로고침해 주세요.';
  end if;

  select * into v_target from public.roommembers where id = p_target_memberid;
  if not found then
    raise exception using errcode = 'P0001', message = '대상 사용자가 이미 방을 나갔거나 강퇴되었습니다.';
  end if;
  if v_target.roomid <> p_roomid then
    raise exception using errcode = 'P0001', message = '대상 멤버가 이 방에 속해 있지 않습니다.';
  end if;
  if v_target.userid = v_actor or v_target.role = 'owner' then
    raise exception using errcode = 'P0001', message = '방장 자신에게는 방장을 위임할 수 없습니다.';
  end if;
  if v_target.role not in ('admin', 'member') then
    raise exception using errcode = 'P0001', message = '멤버 또는 관리자에게만 방장을 위임할 수 있습니다.';
  end if;

  update public.roommembers
  set role = 'admin', updatedat = now()
  where roomid = p_roomid and userid = v_actor and role = 'owner';
  if not found then
    raise exception using errcode = 'P0001', message = '현재 방장 멤버 정보를 찾을 수 없습니다.';
  end if;

  update public.roommembers set role = 'owner', updatedat = now() where id = p_target_memberid;
  update public.rooms set ownerid = v_target.userid, updatedat = now() where id = p_roomid;
end;
$$;

create or replace function public.kick_room_member(
  p_roomid uuid,
  p_target_memberid uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_ownerid uuid;
  v_target public.roommembers%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  end if;
  select ownerid into v_ownerid from public.rooms where id = p_roomid for update;
  if not found then
    raise exception using errcode = 'P0001', message = '방을 찾을 수 없습니다.';
  end if;
  if not public.room_owner_is_consistent(p_roomid) then
    raise exception using errcode = 'P0001', message = '방장 데이터가 올바르지 않아 강퇴할 수 없습니다.';
  end if;
  if v_ownerid <> v_actor then
    raise exception using errcode = 'P0001', message = '방장만 멤버를 강퇴할 수 있습니다.';
  end if;

  select * into v_target from public.roommembers where id = p_target_memberid;
  if not found then
    raise exception using errcode = 'P0001', message = '대상 사용자가 이미 방을 나갔거나 강퇴되었습니다.';
  end if;
  if v_target.roomid <> p_roomid then
    raise exception using errcode = 'P0001', message = '대상 멤버가 이 방에 속해 있지 않습니다.';
  end if;
  if v_target.userid = v_actor or v_target.role = 'owner' then
    raise exception using errcode = 'P0001', message = '방장 자신 또는 방장 역할의 멤버는 강퇴할 수 없습니다.';
  end if;

  insert into public.roombans (roomid, targetuserid, bannedby)
  values (p_roomid, v_target.userid, v_actor)
  on conflict (roomid, targetuserid)
  do update set bannedby = excluded.bannedby, createdat = now();
  delete from public.roommembers where id = p_target_memberid and roomid = p_roomid;
end;
$$;

create or replace function public.unban_room_member(
  p_roomid uuid,
  p_target_userid uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_ownerid uuid;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  end if;
  select ownerid into v_ownerid from public.rooms where id = p_roomid for update;
  if not found then
    raise exception using errcode = 'P0001', message = '방을 찾을 수 없습니다.';
  end if;
  if not public.room_owner_is_consistent(p_roomid) then
    raise exception using errcode = 'P0001', message = '방장 데이터가 올바르지 않아 강퇴를 해제할 수 없습니다.';
  end if;
  if v_ownerid <> v_actor then
    raise exception using errcode = 'P0001', message = '방장만 강퇴를 해제할 수 있습니다.';
  end if;
  if not exists (
    select 1 from public.roombans
    where roomid = p_roomid and targetuserid = p_target_userid
    for update
  ) then
    if public.is_room_member(p_roomid, p_target_userid) then
      raise exception using errcode = 'P0001', message = '대상 사용자는 이미 강퇴가 해제되어 방에 다시 참가했습니다.';
    end if;
    raise exception using errcode = 'P0001', message = '이미 강퇴가 해제되었거나 차단 목록에 없는 사용자입니다.';
  end if;
  delete from public.roombans where roomid = p_roomid and targetuserid = p_target_userid;
end;
$$;

revoke execute on function public.is_room_member(uuid, uuid) from public, anon;
revoke execute on function public.is_room_manager(uuid, uuid) from public, anon;
revoke execute on function public.is_room_owner(uuid, uuid) from public, anon;
revoke execute on function public.room_owner_is_consistent(uuid) from public, anon;
revoke execute on function public.enforce_room_owner_consistency() from public, anon, authenticated;

revoke execute on function public.create_room(text, text, boolean) from public, anon;
revoke execute on function public.update_room(uuid, text, text, boolean) from public, anon;
revoke execute on function public.delete_room(uuid) from public, anon;
revoke execute on function public.leave_room(uuid) from public, anon;
revoke execute on function public.join_room_by_code(text) from public, anon;
revoke execute on function public.change_room_member_role(uuid, uuid, text) from public, anon;
revoke execute on function public.transfer_room_ownership(uuid, uuid) from public, anon;
revoke execute on function public.kick_room_member(uuid, uuid) from public, anon;
revoke execute on function public.unban_room_member(uuid, uuid) from public, anon;

grant execute on function public.is_room_member(uuid, uuid) to authenticated;
grant execute on function public.is_room_manager(uuid, uuid) to authenticated;
grant execute on function public.is_room_owner(uuid, uuid) to authenticated;
grant execute on function public.room_owner_is_consistent(uuid) to authenticated;
grant execute on function public.create_room(text, text, boolean) to authenticated;
grant execute on function public.update_room(uuid, text, text, boolean) to authenticated;
grant execute on function public.delete_room(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;
grant execute on function public.join_room_by_code(text) to authenticated;
grant execute on function public.change_room_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.transfer_room_ownership(uuid, uuid) to authenticated;
grant execute on function public.kick_room_member(uuid, uuid) to authenticated;
grant execute on function public.unban_room_member(uuid, uuid) to authenticated;

-- Simplified room roles. Keep this section synchronized with
-- migrations/20260807170000_simplify_room_roles.sql.
-- Keep a single elevated room role: owner. Existing admins become members.

lock table public.rooms in share row exclusive mode;
lock table public.roommembers in share row exclusive mode;

do $$
begin
  if exists (
    select 1
    from public.rooms as r
    left join public.roommembers as rm on rm.roomid = r.id
    group by r.id, r.ownerid
    having count(*) filter (where rm.role = 'owner') <> 1
      or count(*) filter (where rm.role = 'owner' and rm.userid = r.ownerid) <> 1
  ) then
    raise exception using
      errcode = 'P0001',
      message = '방장 데이터가 올바르지 않아 역할을 단순화할 수 없습니다.';
  end if;
end
$$;

update public.roommembers
set role = 'member', updatedat = now()
where role = 'admin';

alter table public.roommembers
  drop constraint if exists roommembersrolecheck;

alter table public.roommembers
  add constraint roommembersrolecheck check (role in ('owner', 'member'));

create or replace function public.is_room_manager(p_roomid uuid, p_userid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select public.is_room_owner(p_roomid, p_userid);
$$;

create or replace function public.transfer_room_ownership(
  p_roomid uuid,
  p_target_memberid uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_ownerid uuid;
  v_target public.roommembers%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  end if;
  select ownerid into v_ownerid from public.rooms where id = p_roomid for update;
  if not found then
    raise exception using errcode = 'P0001', message = '방을 찾을 수 없습니다.';
  end if;
  if not public.room_owner_is_consistent(p_roomid) then
    raise exception using errcode = 'P0001', message = '방장 데이터가 올바르지 않아 위임할 수 없습니다.';
  end if;
  if v_ownerid <> v_actor then
    raise exception using errcode = 'P0001', message = '더 이상 방장이 아닙니다. 방 정보를 새로고침해 주세요.';
  end if;

  select * into v_target from public.roommembers where id = p_target_memberid;
  if not found then
    raise exception using errcode = 'P0001', message = '대상 사용자가 이미 방을 나갔거나 강퇴되었습니다.';
  end if;
  if v_target.roomid <> p_roomid then
    raise exception using errcode = 'P0001', message = '대상 멤버가 이 방에 속해 있지 않습니다.';
  end if;
  if v_target.userid = v_actor or v_target.role = 'owner' then
    raise exception using errcode = 'P0001', message = '방장 자신에게는 방장을 위임할 수 없습니다.';
  end if;
  if v_target.role <> 'member' then
    raise exception using errcode = 'P0001', message = '일반 멤버에게만 방장을 위임할 수 있습니다.';
  end if;

  update public.roommembers
  set role = 'member', updatedat = now()
  where roomid = p_roomid and userid = v_actor and role = 'owner';
  if not found then
    raise exception using errcode = 'P0001', message = '현재 방장 멤버 정보를 찾을 수 없습니다.';
  end if;

  update public.roommembers set role = 'owner', updatedat = now() where id = p_target_memberid;
  update public.rooms set ownerid = v_target.userid, updatedat = now() where id = p_roomid;
end;
$$;

drop function if exists public.change_room_member_role(uuid, uuid, text);

revoke execute on function public.is_room_manager(uuid, uuid) from public, anon;
revoke execute on function public.transfer_room_ownership(uuid, uuid) from public, anon;
grant execute on function public.is_room_manager(uuid, uuid) to authenticated;
grant execute on function public.transfer_room_ownership(uuid, uuid) to authenticated;

-- Room kicks no longer create bans. Keep this section synchronized with
-- migrations/20260807173000_remove_room_bans.sql.
-- Kicking only removes the membership. A kicked user may join again with an invite code.

create or replace function public.join_room_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_room public.rooms%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  end if;
  if nullif(btrim(p_code), '') is null then
    raise exception using errcode = 'P0001', message = '초대코드를 입력해 주세요.';
  end if;

  select * into v_room
  from public.rooms
  where invitecode = upper(btrim(p_code))
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = '사용 가능한 초대코드를 찾을 수 없습니다.';
  end if;
  if not public.room_owner_is_consistent(v_room.id) then
    raise exception using errcode = 'P0001', message = '방장 데이터가 올바르지 않아 참가할 수 없습니다.';
  end if;

  insert into public.roommembers (roomid, userid, role)
  values (v_room.id, v_actor, 'member')
  on conflict (roomid, userid) do nothing;
  return v_room.id;
end;
$$;

create or replace function public.kick_room_member(
  p_roomid uuid,
  p_target_memberid uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_ownerid uuid;
  v_target public.roommembers%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  end if;
  select ownerid into v_ownerid from public.rooms where id = p_roomid for update;
  if not found then
    raise exception using errcode = 'P0001', message = '방을 찾을 수 없습니다.';
  end if;
  if not public.room_owner_is_consistent(p_roomid) then
    raise exception using errcode = 'P0001', message = '방장 데이터가 올바르지 않아 강퇴할 수 없습니다.';
  end if;
  if v_ownerid <> v_actor then
    raise exception using errcode = 'P0001', message = '방장만 멤버를 강퇴할 수 있습니다.';
  end if;

  select * into v_target from public.roommembers where id = p_target_memberid;
  if not found then
    raise exception using errcode = 'P0001', message = '대상 사용자가 이미 방을 나갔거나 강퇴되었습니다.';
  end if;
  if v_target.roomid <> p_roomid then
    raise exception using errcode = 'P0001', message = '대상 멤버가 이 방에 속해 있지 않습니다.';
  end if;
  if v_target.userid = v_actor or v_target.role = 'owner' then
    raise exception using errcode = 'P0001', message = '방장 자신 또는 방장 역할의 멤버는 강퇴할 수 없습니다.';
  end if;

  delete from public.roommembers where id = p_target_memberid and roomid = p_roomid;
end;
$$;

drop function if exists public.unban_room_member(uuid, uuid);
drop table if exists public.roombans;

revoke execute on function public.join_room_by_code(text) from public, anon;
revoke execute on function public.kick_room_member(uuid, uuid) from public, anon;
grant execute on function public.join_room_by_code(text) to authenticated;
grant execute on function public.kick_room_member(uuid, uuid) to authenticated;
-- Enable Supabase Postgres Changes for data displayed by the app.
do $$
declare
  table_name text;
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  foreach table_name in array array[
    'profiles',
    'projects',
    'rooms',
    'roommembers',
    'ideas',
    'ideacategories',
    'idealikes',
    'feedbacks',
    'projectflows',
    'ideaevaluations'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end
$$;

create table if not exists public.project_evaluation_participants (
  id uuid primary key default gen_random_uuid(),
  projectid uuid not null references public.projects(id) on delete cascade,
  userid uuid not null references auth.users(id) on delete cascade,
  completedat timestamptz not null default now(),
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now(),
  constraint project_evaluation_participants_project_user_key unique (projectid, userid)
);

create index if not exists project_evaluation_participants_project_idx
  on public.project_evaluation_participants (projectid, completedat desc);

alter table public.project_evaluation_participants enable row level security;

drop policy if exists project_evaluation_participants_select on public.project_evaluation_participants;
create policy project_evaluation_participants_select
  on public.project_evaluation_participants for select to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = projectid
      and (p.userid = auth.uid() or exists (
        select 1 from public.roommembers rm
        where rm.roomid = p.roomid and rm.userid = auth.uid()
      ))
  ));

drop policy if exists project_evaluation_participants_insert on public.project_evaluation_participants;
create policy project_evaluation_participants_insert
  on public.project_evaluation_participants for insert to authenticated
  with check (userid = auth.uid() and exists (
    select 1 from public.projects p
    where p.id = projectid
      and (p.userid = auth.uid() or exists (
        select 1 from public.roommembers rm
        where rm.roomid = p.roomid and rm.userid = auth.uid()
      ))
  ));

drop policy if exists project_evaluation_participants_update on public.project_evaluation_participants;
create policy project_evaluation_participants_update
  on public.project_evaluation_participants for update to authenticated
  using (userid = auth.uid())
  with check (userid = auth.uid());

grant select, insert, update on public.project_evaluation_participants to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'project_evaluation_participants'
    ) then
    alter publication supabase_realtime add table public.project_evaluation_participants;
  end if;
end
$$;


-- Synced migration: 20260928120000_add_anonymous_reminders.sql
-- Sender audit data is never granted to API roles. Existing room/project policies stay intact.
create table public.reminder_preferences (
  userid uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true
);
create table public.reminder_dispatches (
  id uuid primary key default gen_random_uuid(),
  senderid uuid not null references auth.users(id) on delete cascade,
  projectid uuid not null references public.projects(id) on delete cascade,
  createdat timestamptz not null default now()
);
create index reminder_dispatch_sender_time on public.reminder_dispatches(senderid, createdat);
create index reminder_dispatch_project_time on public.reminder_dispatches(projectid, createdat);
create table public.reminder_notifications (
  id uuid primary key default gen_random_uuid(),
  recipientid uuid not null references auth.users(id) on delete cascade,
  projectid uuid not null references public.projects(id) on delete cascade,
  createdat timestamptz not null default now(),
  isread boolean not null default false
);
alter table public.reminder_preferences enable row level security;
alter table public.reminder_dispatches enable row level security;
alter table public.reminder_notifications enable row level security;
revoke all on public.reminder_dispatches from public, anon, authenticated;
revoke all on public.reminder_notifications from public, anon, authenticated;
revoke all on public.reminder_preferences from public, anon, authenticated;
grant select, insert, update on public.reminder_preferences to authenticated;
grant select on public.reminder_notifications to authenticated;
grant update (isread) on public.reminder_notifications to authenticated;
create policy reminder_preferences_own on public.reminder_preferences for all to authenticated
  using (userid = auth.uid()) with check (userid = auth.uid());
create policy reminder_notifications_own on public.reminder_notifications for select to authenticated
  using (recipientid = auth.uid());
create policy reminder_notifications_read on public.reminder_notifications for update to authenticated
  using (recipientid = auth.uid()) with check (recipientid = auth.uid());

create function public.send_anonymous_reminder(p_projectid uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_room uuid; v_owner uuid; v_round integer; v_targets uuid[];
begin
  if v_user is null then return 'forbidden'; end if;
  select roomid, userid into v_room, v_owner from public.projects where id = p_projectid;
  if not found or v_room is null or not (v_owner = v_user or exists (
    select 1 from public.roommembers where roomid = v_room and userid = v_user
  )) then return 'forbidden'; end if;
  -- Serialize per sender AND project so concurrent requests cannot bypass either limit.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reminder-user:' || v_user::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reminder-project:' || p_projectid::text, 0));
  if exists (select 1 from public.reminder_dispatches where projectid = p_projectid and createdat > now() - interval '1 hour') then return 'cooldown'; end if;
  if (select count(*) from public.reminder_dispatches where senderid = v_user and createdat >= date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') >= 5 then return 'daily_limit'; end if;
  select coalesce(max(evaluationround), 1) into v_round from public.projectflows where projectid = p_projectid;
  if not exists (select 1 from public.ideas where projectid = p_projectid and not legacystructural and (btrim(title) <> '' or btrim(content) <> '')) then return 'complete'; end if;
  select array_agg(rm.userid) into v_targets from public.roommembers rm
  where rm.roomid = v_room and exists (
    select 1 from public.ideas i where i.projectid = p_projectid and not i.legacystructural
      and (btrim(i.title) <> '' or btrim(i.content) <> '') and not exists (
        select 1 from public.ideaevaluations e where e.projectid = p_projectid and e.ideaid = i.id
          and e.userid = rm.userid and e.evaluationround = v_round
      )
  );
  if coalesce(cardinality(v_targets), 0) = 0 then return 'complete'; end if;
  if not exists (select 1 from unnest(v_targets) t(userid) where not exists (
    select 1 from public.reminder_preferences p where p.userid = t.userid and not p.enabled
  )) then return 'opted_out'; end if;
  insert into public.reminder_dispatches(senderid, projectid) values(v_user, p_projectid);
  insert into public.reminder_notifications(recipientid, projectid)
    select t.userid, p_projectid from unnest(v_targets) t(userid) where not exists (
      select 1 from public.reminder_preferences p where p.userid = t.userid and not p.enabled
    );
  return 'sent';
end;
$$;
revoke all on function public.send_anonymous_reminder(uuid) from public, anon;
grant execute on function public.send_anonymous_reminder(uuid) to authenticated;


-- Synced migration: 20261016010000_notification_delivery.sql
-- Shared, per-recipient inbox and server-owned delivery state.
create table public.notification_preferences (
  userid uuid primary key references auth.users(id) on delete cascade,
  deadline boolean not null default true,
  ideareview boolean not null default true,
  finalselection boolean not null default true,
  stalledidea boolean not null default true,
  feedback boolean not null default true,
  likesurge boolean not null default true,
  team_evaluation boolean not null default true,
  team_reminder boolean not null default true,
  team_feedback boolean not null default true,
  team_changes boolean not null default true,
  team_room boolean not null default true,
  push_enabled boolean not null default false,
  deadlinedays integer not null default 3 check (deadlinedays between 1 and 14),
  stalledideadays integer not null default 3 check (stalledideadays between 1 and 14),
  likesurgethreshold integer not null default 3 check (likesurgethreshold between 1 and 100),
  quiet_start integer not null default 22 check (quiet_start between 0 and 23),
  quiet_end integer not null default 8 check (quiet_end between 0 and 23),
  timezone text not null default 'Asia/Seoul',
  updatedat timestamptz not null default now()
);

create table public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  recipientid uuid not null references auth.users(id) on delete cascade,
  projectid uuid references public.projects(id) on delete set null,
  roomid uuid references public.rooms(id) on delete set null,
  scope text not null check (scope in ('personal', 'team')),
  kind text not null,
  sourcekey text not null,
  title text not null,
  message text not null,
  target text not null,
  createdat timestamptz not null default now(),
  readat timestamptz,
  dismissedat timestamptz,
  pushafter timestamptz,
  pushstatus text not null default 'pending' check (pushstatus in ('pending', 'processing', 'sent', 'skipped', 'failed')),
  pushattempts integer not null default 0,
  unique (recipientid, sourcekey)
);
create index app_notifications_recipient_created on public.app_notifications(recipientid, createdat desc);
create index app_notifications_pending on public.app_notifications(pushafter) where pushstatus = 'pending';

create table public.notification_devices (
  token text primary key,
  userid uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updatedat timestamptz not null default now()
);
create index notification_devices_user on public.notification_devices(userid);

create table public.notification_push_attempts (
  id uuid primary key default gen_random_uuid(),
  notificationid uuid not null references public.app_notifications(id) on delete cascade,
  token text not null,
  ticketid text,
  status text not null,
  createdat timestamptz not null default now(),
  checkedat timestamptz
);
create index notification_push_attempts_receipts on public.notification_push_attempts(createdat)
  where ticketid is not null and checkedat is null;

alter table public.notification_preferences enable row level security;
alter table public.app_notifications enable row level security;
alter table public.notification_devices enable row level security;
alter table public.notification_push_attempts enable row level security;
revoke all on public.notification_preferences, public.app_notifications,
  public.notification_devices, public.notification_push_attempts from public, anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, update (readat, dismissedat) on public.app_notifications to authenticated;
grant select, insert, update, delete on public.notification_devices to authenticated;

create policy notification_preferences_own on public.notification_preferences for all to authenticated
  using (userid = auth.uid()) with check (userid = auth.uid());
create policy app_notifications_own_select on public.app_notifications for select to authenticated
  using (recipientid = auth.uid());
create policy app_notifications_own_update on public.app_notifications for update to authenticated
  using (recipientid = auth.uid()) with check (recipientid = auth.uid());
create policy notification_devices_own on public.notification_devices for all to authenticated
  using (userid = auth.uid()) with check (userid = auth.uid());

-- Preserve the previous reminder preference and read state during the transition.
insert into public.notification_preferences(userid, team_reminder)
select userid, enabled from public.reminder_preferences
on conflict (userid) do update set team_reminder = excluded.team_reminder;

create function public.sync_reminder_preference() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  insert into public.reminder_preferences(userid, enabled) values(new.userid, new.team_reminder)
  on conflict (userid) do update set enabled = excluded.enabled;
  return new;
end $$;
create trigger notification_preferences_reminder_sync
after insert or update of team_reminder on public.notification_preferences
for each row execute function public.sync_reminder_preference();

-- Only trusted database routines may create an inbox event.
create function public.enqueue_app_notification(
  p_recipient uuid, p_project uuid, p_room uuid, p_scope text, p_kind text,
  p_sourcekey text, p_title text, p_message text, p_target text,
  p_pushafter timestamptz default now()
) returns void language plpgsql security definer set search_path = '' as $$
declare v_enabled boolean;
begin
  select case p_kind
    when 'deadline' then deadline when 'ideareview' then ideareview
    when 'finalselection' then finalselection when 'stalledidea' then stalledidea
    when 'feedback' then feedback when 'likesurge' then likesurge
    when 'team_evaluation' then team_evaluation when 'team_reminder' then team_reminder
    when 'team_feedback' then team_feedback when 'team_changes' then team_changes
    when 'team_room' then team_room else false end
  into v_enabled from public.notification_preferences where userid = p_recipient;
  if not coalesce(v_enabled, true) then return; end if;
  insert into public.app_notifications
    (recipientid, projectid, roomid, scope, kind, sourcekey, title, message, target, pushafter)
  values (p_recipient, p_project, p_room, p_scope, p_kind, p_sourcekey, p_title, p_message, p_target, p_pushafter)
  on conflict (recipientid, sourcekey) do nothing;
end $$;
revoke all on function public.enqueue_app_notification(uuid, uuid, uuid, text, text, text, text, text, text, timestamptz)
  from public, anon, authenticated;

create function public.enqueue_anonymous_reminder() returns trigger language plpgsql
security definer set search_path = '' as $$
declare v_title text; v_room uuid;
begin
  select title, roomid into v_title, v_room from public.projects where id = new.projectid;
  perform public.enqueue_app_notification(new.recipientid, new.projectid, v_room,
    'team', 'team_reminder', 'reminder:' || new.id::text,
    coalesce(v_title, '팀 과제') || ' 평가 알림',
    '아직 완료하지 않은 평가가 있어요. 평가를 마쳐 주세요.',
    '/projects/' || new.projectid::text || '?projectView=home&flowStep=selection',
    case when new.isread then null else new.createdat end);
  if new.isread then
    update public.app_notifications set readat = new.createdat
    where recipientid = new.recipientid and sourcekey = 'reminder:' || new.id::text;
  end if;
  return new;
end $$;
create trigger reminder_to_app_notifications after insert on public.reminder_notifications
for each row execute function public.enqueue_anonymous_reminder();
create function public.sync_old_reminder_read() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  if new.isread and not old.isread then
    update public.app_notifications set readat = now()
    where recipientid = new.recipientid and sourcekey = 'reminder:' || new.id::text;
  end if;
  return new;
end $$;
create trigger old_reminder_read_sync after update of isread on public.reminder_notifications
for each row execute function public.sync_old_reminder_read();

-- Keep the existing RPC and sender audit, while excluding the sender and repeat targets.
create or replace function public.send_anonymous_reminder(p_projectid uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_room uuid; v_owner uuid; v_round integer; v_targets uuid[];
begin
  if v_user is null then return 'forbidden'; end if;
  select roomid, userid into v_room, v_owner from public.projects where id = p_projectid;
  if not found or v_room is null or not (v_owner = v_user or exists (
    select 1 from public.roommembers where roomid = v_room and userid = v_user
  )) then return 'forbidden'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reminder-user:' || v_user::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reminder-project:' || p_projectid::text, 0));
  if exists (select 1 from public.reminder_dispatches where projectid = p_projectid
    and createdat > now() - interval '1 hour') then return 'cooldown'; end if;
  if (select count(*) from public.reminder_dispatches where senderid = v_user
    and createdat >= date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') >= 5
  then return 'daily_limit'; end if;
  select coalesce(max(evaluationround), 1) into v_round from public.projectflows where projectid = p_projectid;
  if not exists (select 1 from public.ideas where projectid = p_projectid and not legacystructural
    and (btrim(title) <> '' or btrim(content) <> '')) then return 'complete'; end if;
  select array_agg(rm.userid) into v_targets from public.roommembers rm
  where rm.roomid = v_room and rm.userid <> v_user and exists (
    select 1 from public.ideas i where i.projectid = p_projectid and not i.legacystructural
      and (btrim(i.title) <> '' or btrim(i.content) <> '') and not exists (
        select 1 from public.ideaevaluations e where e.projectid = p_projectid and e.ideaid = i.id
          and e.userid = rm.userid and e.evaluationround = v_round
      )
  );
  if coalesce(cardinality(v_targets), 0) = 0 then return 'complete'; end if;
  if not exists (select 1 from unnest(v_targets) t(userid) where not exists (
    select 1 from public.reminder_preferences p where p.userid = t.userid and not p.enabled
  )) then return 'opted_out'; end if;
  if not exists (select 1 from unnest(v_targets) t(userid) where not exists (
    select 1 from public.reminder_preferences p where p.userid = t.userid and not p.enabled
  ) and not exists (select 1 from public.reminder_notifications rn
    where rn.recipientid = t.userid and rn.projectid = p_projectid
      and rn.createdat > now() - interval '24 hours')) then return 'cooldown'; end if;
  insert into public.reminder_dispatches(senderid, projectid) values(v_user, p_projectid);
  insert into public.reminder_notifications(recipientid, projectid)
    select t.userid, p_projectid from unnest(v_targets) t(userid) where not exists (
      select 1 from public.reminder_preferences p where p.userid = t.userid and not p.enabled
    ) and not exists (select 1 from public.reminder_notifications rn
      where rn.recipientid = t.userid and rn.projectid = p_projectid
        and rn.createdat > now() - interval '24 hours');
  return 'sent';
end $$;
insert into public.app_notifications(recipientid, projectid, roomid, scope, kind, sourcekey, title, message, target, createdat, readat, pushafter, pushstatus)
select r.recipientid, r.projectid, p.roomid, 'team', 'team_reminder', 'reminder:' || r.id::text,
  p.title || ' 평가 알림', '아직 완료하지 않은 평가가 있어요. 평가를 마쳐 주세요.',
  '/projects/' || r.projectid::text || '?projectView=home&flowStep=selection',
  r.createdat, case when r.isread then r.createdat end, null, 'skipped'
from public.reminder_notifications r join public.projects p on p.id = r.projectid
on conflict (recipientid, sourcekey) do nothing;

create function public.notify_feedback() returns trigger language plpgsql
security definer set search_path = '' as $$
declare v_owner uuid; v_project uuid; v_room uuid; v_title text; v_kind text;
begin
  select i.userid, i.projectid, p.roomid, p.title into v_owner, v_project, v_room, v_title
  from public.ideas i join public.projects p on p.id = i.projectid where i.id = new.ideaid;
  if v_owner is null or v_owner = new.userid then return new; end if;
  v_kind := case when v_room is null then 'feedback' else 'team_feedback' end;
  perform public.enqueue_app_notification(v_owner, v_project, v_room,
    case when v_room is null then 'personal' else 'team' end, v_kind,
    'feedback:' || new.id::text, v_title || ' 피드백', '내 아이디어에 새 피드백이 달렸어요.',
    '/projects/' || v_project::text || '?projectView=ideas', now() + interval '15 minutes');
  return new;
end $$;
create trigger feedback_notification after insert on public.feedbacks
for each row execute function public.notify_feedback();

create function public.notify_project_change() returns trigger language plpgsql
security definer set search_path = '' as $$
declare v_member record; v_message text; v_key text;
begin
  if new.roomid is null then return new; end if;
  if tg_op = 'INSERT' then
    v_message := '새 팀 과제가 등록됐어요.';
    v_key := 'project-created:' || new.id::text;
  elsif new.deadline is distinct from old.deadline then
    v_message := '과제 마감일이 변경됐어요.';
    v_key := 'deadline-changed:' || new.id::text || ':' || coalesce(new.deadline::text, 'none') || ':' || new.updatedat::text;
  else return new; end if;
  for v_member in select userid from public.roommembers where roomid = new.roomid loop
    if v_member.userid is distinct from auth.uid() then
      perform public.enqueue_app_notification(v_member.userid, new.id, new.roomid,
        'team', 'team_changes', v_key, new.title, v_message,
        '/projects/' || new.id::text || '?projectView=home', now());
    end if;
  end loop;
  return new;
end $$;
create trigger project_change_notification after insert or update of deadline on public.projects
for each row execute function public.notify_project_change();

create function public.notify_selected_idea() returns trigger language plpgsql
security definer set search_path = '' as $$
declare v_project public.projects%rowtype; v_member record;
begin
  if new.selectedideaid is null or new.selectedideaid is not distinct from old.selectedideaid then return new; end if;
  select * into v_project from public.projects where id = new.projectid;
  if v_project.roomid is null then return new; end if;
  for v_member in select userid from public.roommembers where roomid = v_project.roomid loop
    if v_member.userid is distinct from auth.uid() then
      perform public.enqueue_app_notification(v_member.userid, new.projectid, v_project.roomid,
        'team', 'team_changes', 'selected:' || new.projectid::text || ':' || new.selectedideaid::text,
        v_project.title || ' 최종 아이디어 선정', '팀의 최종 아이디어가 선정됐어요.',
        '/projects/' || new.projectid::text || '?projectView=home&flowStep=selection', now());
    end if;
  end loop;
  return new;
end $$;
create trigger selected_idea_notification after update of selectedideaid on public.projectflows
for each row execute function public.notify_selected_idea();

create function public.notify_evaluation_progress() returns trigger language plpgsql
security definer set search_path = '' as $$
declare v_project public.projects%rowtype; v_member record; v_ideas integer; v_completed integer; v_total integer;
begin
  select * into v_project from public.projects where id = new.projectid;
  if v_project.roomid is null then return new; end if;
  select count(*) into v_ideas from public.ideas
    where projectid = new.projectid and not legacystructural and (btrim(title) <> '' or btrim(content) <> '');
  if v_ideas = 0 then return new; end if;
  select count(*) into v_total from public.roommembers where roomid = v_project.roomid;
  select count(*) into v_completed from public.roommembers m where m.roomid = v_project.roomid
    and not exists (select 1 from public.ideas i where i.projectid = new.projectid and not i.legacystructural
      and (btrim(i.title) <> '' or btrim(i.content) <> '') and not exists
      (select 1 from public.ideaevaluations e where e.projectid = new.projectid and e.ideaid = i.id
       and e.userid = m.userid and e.evaluationround = new.evaluationround));
  if (select count(*) from public.ideaevaluations where projectid = new.projectid and evaluationround = new.evaluationround) = 1 then
    for v_member in select userid from public.roommembers where roomid = v_project.roomid and userid <> new.userid loop
      perform public.enqueue_app_notification(v_member.userid, new.projectid, v_project.roomid,
        'team', 'team_evaluation', 'evaluation-start:' || new.projectid::text || ':' || new.evaluationround::text,
        v_project.title || ' 팀 평가', '팀 평가가 시작됐어요. 내 평가를 완료해 주세요.',
        '/projects/' || new.projectid::text || '?projectView=home&flowStep=selection', now());
    end loop;
  end if;
  if v_completed = v_total and v_total > 0 then
    for v_member in select userid from public.roommembers where roomid = v_project.roomid loop
      perform public.enqueue_app_notification(v_member.userid, new.projectid, v_project.roomid,
        'team', 'team_evaluation', 'evaluation-done:' || new.projectid::text || ':' || new.evaluationround::text,
        v_project.title || ' 평가 완료', '팀원 모두 평가를 마쳤어요. 결과를 확인해 보세요.',
        '/projects/' || new.projectid::text || '?projectView=home&flowStep=selection', now());
    end loop;
  end if;
  return new;
end $$;
create trigger evaluation_progress_notification after insert on public.ideaevaluations
for each row execute function public.notify_evaluation_progress();

create function public.notify_room_member() returns trigger language plpgsql
security definer set search_path = '' as $$
declare v_name text; v_owner uuid;
begin
  select name, ownerid into v_name, v_owner from public.rooms where id = new.roomid;
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    perform public.enqueue_app_notification(new.userid, null, new.roomid, 'team', 'team_room',
      'role:' || new.id::text || ':' || new.updatedat::text,
      coalesce(v_name, '팀') || ' 역할 변경', '팀에서 내 역할이 변경됐어요.', '/rooms', now());
  elsif tg_op = 'INSERT' and new.userid <> v_owner then
    perform public.enqueue_app_notification(v_owner, null, new.roomid, 'team', 'team_room',
      'member:' || new.id::text, coalesce(v_name, '팀') || ' 새 팀원',
      '새 팀원이 참여했어요.', '/rooms', now());
  end if;
  return new;
end $$;
create trigger room_member_notification after insert or update of role on public.roommembers
for each row execute function public.notify_room_member();

create function public.notify_like_milestone() returns trigger language plpgsql
security definer set search_path = '' as $$
declare v_owner uuid; v_project uuid; v_room uuid; v_title text; v_count integer; v_threshold integer;
begin
  select i.userid, i.projectid, p.roomid, p.title into v_owner, v_project, v_room, v_title
  from public.ideas i join public.projects p on p.id = i.projectid where i.id = new.ideaid;
  if v_room is not null or v_owner is null or v_owner = new.userid then return new; end if;
  select coalesce(likesurgethreshold, 3) into v_threshold from public.notification_preferences where userid = v_owner;
  v_threshold := coalesce(v_threshold, 3);
  select count(*) into v_count from public.idealikes where ideaid = new.ideaid;
  if v_count < v_threshold or mod(v_count, v_threshold) <> 0 then return new; end if;
  perform public.enqueue_app_notification(v_owner, v_project, null, 'personal', 'likesurge',
    'likes:' || new.ideaid::text || ':' || v_count::text, v_title || ' 공감',
    '내 아이디어가 ' || v_count::text || '개의 공감을 받았어요.',
    '/projects/' || v_project::text || '?projectView=ideas', null);
  return new;
end $$;
create trigger like_milestone_notification after insert on public.idealikes
for each row execute function public.notify_like_milestone();

-- The database job runs independently of whether any mobile client is open.
create function public.generate_due_notifications() returns void language plpgsql
security definer set search_path = '' as $$
declare p record; v_local timestamp; v_days integer; v_last timestamptz; v_count integer; v_base text;
begin
  for p in select pr.*, coalesce(np.timezone, 'Asia/Seoul') as usertimezone,
    coalesce(np.deadlinedays, 3) as firstday, coalesce(np.stalledideadays, 3) as stalldays
    from public.projects pr left join public.notification_preferences np on np.userid = pr.userid
    where pr.roomid is null loop
    begin v_local := now() at time zone p.usertimezone;
    exception when invalid_parameter_value then v_local := now() at time zone 'Asia/Seoul'; end;
    if extract(hour from v_local) < 9 then continue; end if;
    if p.deadline is not null then
      v_days := p.deadline::date - v_local::date;
      if v_days >= 0 and v_days in (p.firstday, 1, 0) then
        perform public.enqueue_app_notification(p.userid, p.id, null, 'personal', 'deadline',
          'deadline:' || p.id::text || ':' || p.deadline::text || ':' || v_days::text,
          p.title || ' 마감 알림', case when v_days = 0 then '오늘이 마감일이에요.'
            else '마감까지 ' || v_days::text || '일 남았어요.' end,
          '/projects/' || p.id::text || '?projectView=home', now());
      end if;
    end if;
    select count(*), max(updatedat) into v_count, v_last from public.ideas
      where projectid = p.id and not legacystructural and status = 'research';
    if v_count > 0 and v_last <= now() - interval '1 day' then
      v_base := 'review:' || p.id::text || ':' || v_last::text;
      perform public.enqueue_app_notification(p.userid, p.id, null, 'personal', 'ideareview',
        v_base || ':1', p.title || ' 아이디어 검토', '검토가 필요한 아이디어가 있어요.',
        '/projects/' || p.id::text || '?projectView=ideas', now());
      if exists (select 1 from public.app_notifications n where n.recipientid = p.userid
        and n.sourcekey = v_base || ':1' and n.createdat <= now() - interval '3 days') then
        perform public.enqueue_app_notification(p.userid, p.id, null, 'personal', 'ideareview',
          v_base || ':2', p.title || ' 아이디어 검토', '아직 검토하지 않은 아이디어가 있어요.',
          '/projects/' || p.id::text || '?projectView=ideas', now());
      end if;
    end if;
    select count(*), max(updatedat) into v_count, v_last from public.ideas
      where projectid = p.id and not legacystructural and status = 'thought'
        and updatedat <= now() - make_interval(days => p.stalldays);
    if v_count > 0 then
      v_base := 'stalled:' || p.id::text || ':' || v_last::text;
      perform public.enqueue_app_notification(p.userid, p.id, null, 'personal', 'stalledidea',
        v_base || ':1', p.title || ' 진행 정체', '오래 갱신되지 않은 아이디어가 있어요.',
        '/projects/' || p.id::text || '?projectView=ideas', now());
      if exists (select 1 from public.app_notifications n where n.recipientid = p.userid
        and n.sourcekey = v_base || ':1' and n.createdat <= now() - interval '7 days') then
        perform public.enqueue_app_notification(p.userid, p.id, null, 'personal', 'stalledidea',
          v_base || ':2', p.title || ' 진행 정체', '아이디어를 다시 확인해 보세요.',
          '/projects/' || p.id::text || '?projectView=ideas', now());
      end if;
    end if;
    select f.updatedat into v_last from public.projectflows f where f.projectid = p.id
      and f.blindanalysis is not null and f.selectedideaid is null;
    if v_last is not null and v_last <= now() - interval '1 day' then
      v_base := 'selection:' || p.id::text || ':' || v_last::text;
      perform public.enqueue_app_notification(p.userid, p.id, null, 'personal', 'finalselection',
        v_base || ':1', p.title || ' 최종 선정', '비교 결과를 확인하고 아이디어를 선정해 주세요.',
        '/projects/' || p.id::text || '?projectView=home&flowStep=selection', now());
      if exists (select 1 from public.app_notifications n where n.recipientid = p.userid
        and n.sourcekey = v_base || ':1' and n.createdat <= now() - interval '3 days') then
        perform public.enqueue_app_notification(p.userid, p.id, null, 'personal', 'finalselection',
          v_base || ':2', p.title || ' 최종 선정', '아직 최종 아이디어를 선정하지 않았어요.',
          '/projects/' || p.id::text || '?projectView=home&flowStep=selection', now());
      end if;
    end if;
  end loop;
end $$;
revoke all on function public.generate_due_notifications() from public, anon, authenticated;

-- Claiming is atomic, so concurrent workers cannot deliver the same event.
create function public.claim_due_notification_pushes(p_limit integer default 50)
returns setof public.app_notifications language plpgsql security definer set search_path = '' as $$
begin
  return query with claimed as (
    select n.id from public.app_notifications n
    join public.notification_preferences p on p.userid = n.recipientid
    where n.pushstatus = 'pending' and n.pushafter <= now() and n.readat is null
      and n.dismissedat is null and p.push_enabled
      and not (
        case when p.quiet_start = p.quiet_end then false
        when p.quiet_start < p.quiet_end then
          extract(hour from now() at time zone p.timezone) >= p.quiet_start
          and extract(hour from now() at time zone p.timezone) < p.quiet_end
        else extract(hour from now() at time zone p.timezone) >= p.quiet_start
          or extract(hour from now() at time zone p.timezone) < p.quiet_end end)
    order by n.pushafter, n.createdat limit least(greatest(p_limit, 1), 100)
    for update of n skip locked
  ) update public.app_notifications n set pushstatus = 'processing', pushattempts = pushattempts + 1
    from claimed where n.id = claimed.id returning n.*;
end $$;
revoke all on function public.claim_due_notification_pushes(integer) from public, anon, authenticated;
grant execute on function public.claim_due_notification_pushes(integer) to service_role;

-- Recover work if a worker exits after claiming a batch.
create function public.requeue_stale_notification_pushes() returns void language sql
security definer set search_path = '' as $$
  update public.app_notifications set pushstatus = 'pending', pushafter = now() + interval '5 minutes'
  where pushstatus = 'processing' and pushafter < now() - interval '15 minutes' and pushattempts < 4;
  update public.app_notifications set pushstatus = 'failed'
  where pushstatus = 'processing' and pushafter < now() - interval '15 minutes' and pushattempts >= 4;
$$;
revoke all on function public.requeue_stale_notification_pushes() from public, anon, authenticated;
grant execute on function public.requeue_stale_notification_pushes() to service_role;

create function public.notification_is_actionable(p_id uuid) returns boolean language plpgsql
security definer set search_path = '' as $$
declare n public.app_notifications%rowtype; p public.notification_preferences%rowtype;
  v_round integer; v_deadline text;
begin
  select * into n from public.app_notifications where id = p_id;
  if not found or n.readat is not null or n.dismissedat is not null then return false; end if;
  select * into p from public.notification_preferences where userid = n.recipientid;
  if not found or not p.push_enabled then return false; end if;
  if not (case n.kind
    when 'deadline' then p.deadline when 'ideareview' then p.ideareview
    when 'finalselection' then p.finalselection when 'stalledidea' then p.stalledidea
    when 'feedback' then p.feedback when 'likesurge' then p.likesurge
    when 'team_evaluation' then p.team_evaluation when 'team_reminder' then p.team_reminder
    when 'team_feedback' then p.team_feedback when 'team_changes' then p.team_changes
    when 'team_room' then p.team_room else false end) then return false; end if;
  if n.kind = 'deadline' then
    select deadline::text into v_deadline from public.projects where id = n.projectid;
    return v_deadline is not null and n.sourcekey like 'deadline:%:' || v_deadline || ':%'
      and v_deadline::date >= (now() at time zone p.timezone)::date;
  end if;
  if n.kind = 'ideareview' then
    return exists (select 1 from public.ideas where projectid = n.projectid
      and not legacystructural and status = 'research');
  end if;
  if n.kind = 'finalselection' then
    return exists (select 1 from public.projectflows where projectid = n.projectid
      and blindanalysis is not null and selectedideaid is null);
  end if;
  if n.kind = 'stalledidea' then
    return exists (select 1 from public.ideas where projectid = n.projectid
      and not legacystructural and status = 'thought'
      and updatedat <= now() - make_interval(days => p.stalledideadays));
  end if;
  if n.kind = 'team_reminder' or (n.kind = 'team_evaluation' and n.sourcekey like 'evaluation-start:%') then
    if not exists (select 1 from public.projects pr join public.roommembers m on m.roomid = pr.roomid
      where pr.id = n.projectid and m.userid = n.recipientid) then return false; end if;
    select coalesce(max(evaluationround), 1) into v_round from public.projectflows where projectid = n.projectid;
    if n.kind = 'team_evaluation' and n.sourcekey <> 'evaluation-start:' || n.projectid::text || ':' || v_round::text then
      return false;
    end if;
    return exists (select 1 from public.ideas i where i.projectid = n.projectid and not i.legacystructural
      and (btrim(i.title) <> '' or btrim(i.content) <> '')
      and not exists (select 1 from public.ideaevaluations e where e.projectid = n.projectid
        and e.ideaid = i.id and e.userid = n.recipientid and e.evaluationround = v_round));
  end if;
  return true;
end $$;
revoke all on function public.notification_is_actionable(uuid) from public, anon, authenticated;
grant execute on function public.notification_is_actionable(uuid) to service_role;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'app_notifications') then
    alter publication supabase_realtime add table public.app_notifications;
  end if;
end $$;

-- Configure these Vault secrets on the target project before push dispatch is live:
-- notification_worker_url = https://<project-ref>.supabase.co/functions/v1/notification-worker
-- notification_worker_key = the same random value as the Edge Function's NOTIFICATION_WORKER_SECRET.
-- The key is read inside Postgres; it must never be stored in source or sent to the app.
create function public.invoke_notification_worker() returns void language plpgsql
security definer set search_path = '' as $$
declare v_url text; v_key text;
begin
  if to_regclass('vault.decrypted_secrets') is null or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    return;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
    into v_url using 'notification_worker_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
    into v_key using 'notification_worker_key';
  if v_url is null or v_key is null then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end $$;
revoke all on function public.invoke_notification_worker() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('watt-notification-generate', '*/15 * * * *',
      'select public.generate_due_notifications()');
    if exists (select 1 from pg_available_extensions where name = 'pg_net') then
      create extension if not exists pg_net with schema extensions;
      perform cron.schedule('watt-notification-worker', '* * * * *',
        'select public.invoke_notification_worker()');
    end if;
  end if;
end $$;


-- Synced migration: 20261016020000_notification_delivery_hardening.sql
-- The Edge worker uses the service role through PostgREST. Keep its access
-- explicit even when the project's default privileges are customized.
grant select, insert, update, delete on public.notification_preferences,
  public.app_notifications, public.notification_devices,
  public.notification_push_attempts to service_role;

-- The settings screen currently supports Korean local time only. Fail the
-- migration if an existing row differs, so no user's setting is overwritten.
-- Invalid time zone names would otherwise abort the due-push claim for all users.
alter table public.notification_preferences
  add constraint notification_preferences_timezone_check
  check (timezone = 'Asia/Seoul');


-- Synced migration: 20261017010000_project_templates_favorites_stages.sql
-- Existing projects retain the original service/app workflow and presentation stage.
-- Preserve values from the earlier snake_case project schema when it is present.
do $$
begin
  if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'projects' and column_name = 'has_presentation')
    and not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'projects' and column_name = 'haspresentation') then
    alter table public.projects rename column has_presentation to haspresentation;
  end if;
end $$;

alter table public.projects
  add column if not exists template text not null default 'service_app',
  add column if not exists haspresentation boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint
      where conrelid = 'public.projects'::regclass and conname = 'projects_template_check') then
    alter table public.projects add constraint projects_template_check
      check (template in ('service_app', 'report_research', 'writing_creative'));
  end if;
end $$;

-- Favorite is a per-user relation, not a project-wide flag.
create table if not exists public.project_favorites (
  userid uuid not null references auth.users(id) on delete cascade,
  projectid uuid not null references public.projects(id) on delete cascade,
  createdat timestamptz not null default now(),
  primary key (userid, projectid)
);
-- The remote database already has this table with user_id/project_id/created_at.
-- Rename its columns so existing favorite rows remain usable by the app.
do $$
begin
  if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'project_favorites' and column_name = 'user_id')
    and not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'project_favorites' and column_name = 'userid') then
    alter table public.project_favorites rename column user_id to userid;
  end if;
  if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'project_favorites' and column_name = 'project_id')
    and not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'project_favorites' and column_name = 'projectid') then
    alter table public.project_favorites rename column project_id to projectid;
  end if;
  if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'project_favorites' and column_name = 'created_at')
    and not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'project_favorites' and column_name = 'createdat') then
    alter table public.project_favorites rename column created_at to createdat;
  end if;
end $$;

create index if not exists project_favorites_project_idx on public.project_favorites(projectid);
alter table public.project_favorites enable row level security;
revoke all on public.project_favorites from public, anon, authenticated;
grant select, insert, delete on public.project_favorites to authenticated;
drop policy if exists "Users can view their own project favorites" on public.project_favorites;
drop policy if exists "Users can create their own project favorites" on public.project_favorites;
drop policy if exists "Users can delete their own project favorites" on public.project_favorites;
create policy project_favorites_select on public.project_favorites for select to authenticated
  using (userid = auth.uid() and exists (
    select 1 from public.projects p where p.id = projectid and
      (p.userid = auth.uid() or exists (
        select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));
create policy project_favorites_insert on public.project_favorites for insert to authenticated
  with check (userid = auth.uid() and exists (
    select 1 from public.projects p where p.id = projectid and
      (p.userid = auth.uid() or exists (
        select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));
create policy project_favorites_delete on public.project_favorites for delete to authenticated
  using (userid = auth.uid() and exists (
    select 1 from public.projects p where p.id = projectid and
      (p.userid = auth.uid() or exists (
        select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));

-- Non-service templates use shared stage content and explicit completion.
create table public.project_stage_progress (
  projectid uuid not null references public.projects(id) on delete cascade,
  template text not null check (template in ('report_research', 'writing_creative')),
  stageid text not null check (stageid in ('extraction', 'selection', 'mvp', 'draft', 'revision', 'result', 'presentation')),
  content text not null default '',
  iscompleted boolean not null default false,
  updatedat timestamptz not null default now(),
  primary key (projectid, template, stageid)
);
alter table public.project_stage_progress enable row level security;
revoke all on public.project_stage_progress from public, anon, authenticated;
grant select, insert, update on public.project_stage_progress to authenticated;
create policy project_stage_progress_select on public.project_stage_progress for select to authenticated
  using (exists (select 1 from public.projects p where p.id = projectid and
    (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));
create policy project_stage_progress_insert on public.project_stage_progress for insert to authenticated
  with check (exists (select 1 from public.projects p where p.id = projectid and
    (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));
create policy project_stage_progress_update on public.project_stage_progress for update to authenticated
  using (exists (select 1 from public.projects p where p.id = projectid and
    (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))))
  with check (exists (select 1 from public.projects p where p.id = projectid and
    (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));
