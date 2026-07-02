create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  userid uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  deadline date,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

alter table projects disable row level security;

create index if not exists projectsuseridcreatedatidx
  on projects (userid, createdat desc);

grant select, insert, update, delete on table projects to authenticated;

create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),
  projectid uuid not null references projects(id) on delete cascade,
  userid uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null default '',
  status text not null default '떠오른 생각'
    check (status in ('떠오른 생각', '조사 필요', '쓸 만함', '최종 사용')),
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

alter table ideas disable row level security;

create index if not exists ideasprojectidcreatedatidx
  on ideas (projectid, createdat desc);

create index if not exists ideasuseridprojectididx
  on ideas (userid, projectid);

grant select, insert, update, delete on table ideas to authenticated;
