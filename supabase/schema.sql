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
  status text not null default 'thought'
    check (status in ('thought', 'research', 'approved', 'selected')),
  category text not null default 'planning'
    check (category in ('planning', 'design', 'develop', 'research')),
  isfavorite boolean not null default false,
  parentnodeid uuid null,
  x integer null,
  y integer null,
  side text null,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

alter table ideas
  add column if not exists category text not null default 'planning';

alter table ideas
  add column if not exists isfavorite boolean not null default false;

alter table ideas
add column if not exists parentnodeid uuid null,
add column if not exists x integer null,
add column if not exists y integer null,
add column if not exists side text null,
add column if not exists status text default 'idea';

alter table ideas
  alter column status set default 'thought';

alter table ideas
  alter column category set default 'planning';

update ideas
set status = case
  when status = '?좎삤瑜??앷컖' then 'thought'
  when status = '議곗궗 ?꾩슂' then 'research'
  when status = '??留뚰븿' then 'approved'
  when status = '理쒖쥌 ?ъ슜' then 'selected'
  when status in ('thought', 'research', 'approved', 'selected') then status
  else 'thought'
end
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
