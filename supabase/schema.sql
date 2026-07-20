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
  add column if not exists author text null;

alter table ideas
  alter column status set default 'thought',
  alter column category set default 'planning';

update ideas
set status = 'thought'
where status not in ('thought', 'research', 'approved', 'selected');

update ideas
set category = 'planning'
where category not in ('planning', 'design', 'develop', 'research');

alter table ideas
  drop constraint if exists ideas_status_check;

alter table ideas
  drop constraint if exists ideas_category_check;

alter table ideas
  add constraint ideas_status_check
  check (status in ('thought', 'research', 'approved', 'selected'));

alter table ideas
  add constraint ideas_category_check
  check (category in ('planning', 'design', 'develop', 'research'));

alter table ideas disable row level security;

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

do $$
begin
  if to_regclass('public.idea_likes') is not null then
    insert into idealikes (id, ideaid, userid, createdat, updatedat)
    select
      source_like.id,
      source_like.idea_id,
      source_like.user_id,
      coalesce(source_like.created_at, now()),
      coalesce(source_like.created_at, now())
    from idea_likes source_like
    where source_like.idea_id is not null
      and source_like.user_id is not null
      and not exists (
        select 1
        from idealikes target_like
        where target_like.ideaid = source_like.idea_id
          and target_like.userid = source_like.user_id
      );
  end if;
end $$;

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
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

alter table feedbacks
  add column if not exists comment text not null default '',
  add column if not exists createdat timestamptz not null default now(),
  add column if not exists updatedat timestamptz not null default now();

alter table feedbacks disable row level security;

create index if not exists feedbacksideaidcreatedatidx
  on feedbacks (ideaid, createdat desc);

create index if not exists feedbacksuseridcreatedatidx
  on feedbacks (userid, createdat desc);

grant select, insert, update, delete on table feedbacks to authenticated;
