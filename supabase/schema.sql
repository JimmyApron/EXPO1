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
  mvpplan jsonb null,
  presentationdata jsonb null,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now(),
  constraint projectflowsdurationweekscheck check (durationweeks between 1 and 104),
  constraint projectflowsteamsizecheck check (teamsize between 1 and 100),
  constraint projectflowsbudgetcheck check (budget >= 0)
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
  locked boolean not null default true check (locked),
  createdat timestamptz not null default now(),
  unique (projectid, ideaid, userid)
);

create index if not exists ideaevaluationsprojectidideaididx
  on public.ideaevaluations (projectid, ideaid);

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
  raise exception using errcode = 'P0001', message = 'Submitted blind evaluations are locked.';
end;
$$;

create trigger ideaevaluationsimmutable
  before update or delete on public.ideaevaluations
  for each row execute function public.reject_idea_evaluation_change();

grant select, insert on table public.ideaevaluations to authenticated;

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
