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
