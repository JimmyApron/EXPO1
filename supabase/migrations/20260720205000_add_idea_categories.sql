create extension if not exists pgcrypto;

alter table public.ideas
  drop constraint if exists ideas_category_check;

create table if not exists public.ideacategories (
  id uuid primary key default gen_random_uuid(),
  userid uuid not null references auth.users(id) on delete cascade,
  projectid uuid not null references public.projects(id) on delete cascade,
  name text not null,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

alter table public.ideacategories
  add column if not exists userid uuid references auth.users(id) on delete cascade,
  add column if not exists projectid uuid references public.projects(id) on delete cascade,
  add column if not exists name text not null default '',
  add column if not exists createdat timestamptz not null default now(),
  add column if not exists updatedat timestamptz not null default now();

delete from public.ideacategories
where projectid is null
  or userid is null
  or btrim(name) = '';

alter table public.ideacategories
  alter column userid set not null,
  alter column projectid set not null,
  alter column name set not null,
  alter column name drop default,
  alter column createdat set not null,
  alter column updatedat set not null;

alter table public.ideacategories disable row level security;

create unique index if not exists ideacategoriesprojectidnameidx
  on public.ideacategories (projectid, lower(name));

create index if not exists ideacategoriesuseridprojectididx
  on public.ideacategories (userid, projectid);

grant select, insert, update, delete on table public.ideacategories to authenticated;
