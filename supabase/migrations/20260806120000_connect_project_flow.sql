alter table ideas
  add column if not exists sourceid text null,
  add column if not exists summary text not null default '',
  add column if not exists problem text not null default '',
  add column if not exists targetusers text[] not null default '{}',
  add column if not exists solution text not null default '',
  add column if not exists keywords text[] not null default '{}',
  add column if not exists corefeatures text[] not null default '{}';

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
