create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.ideas') is null then
    raise exception 'public.ideas table must exist before public.idealikes can be created';
  end if;
end $$;

create table if not exists public.idealikes (
  id uuid primary key default gen_random_uuid(),
  ideaid uuid not null references public.ideas(id) on delete cascade,
  userid uuid not null references auth.users(id) on delete cascade,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

alter table public.idealikes
  add column if not exists id uuid,
  add column if not exists ideaid uuid,
  add column if not exists userid uuid,
  add column if not exists createdat timestamptz not null default now(),
  add column if not exists updatedat timestamptz not null default now();

alter table public.idealikes
  alter column id set default gen_random_uuid(),
  alter column createdat set default now(),
  alter column updatedat set default now();

update public.idealikes
set id = gen_random_uuid()
where id is null;

update public.idealikes
set
  createdat = coalesce(createdat, now()),
  updatedat = coalesce(updatedat, createdat, now())
where createdat is null
  or updatedat is null;

update public.idealikes like_row
set id = gen_random_uuid()
from (
  select
    ctid,
    row_number() over (
      partition by id
      order by createdat asc, ctid asc
    ) as rownumber
  from public.idealikes
) duplicate_ids
where like_row.ctid = duplicate_ids.ctid
  and duplicate_ids.rownumber > 1;

delete from public.idealikes like_row
where like_row.ideaid is null
  or like_row.userid is null
  or not exists (
    select 1
    from public.ideas idea_row
    where idea_row.id = like_row.ideaid
  )
  or not exists (
    select 1
    from auth.users user_row
    where user_row.id = like_row.userid
  );

delete from public.idealikes like_row
using (
  select id
  from (
    select
      id,
      row_number() over (
        partition by ideaid, userid
        order by createdat asc, id asc
      ) as rownumber
    from public.idealikes
  ) ranked_likes
  where ranked_likes.rownumber > 1
) duplicate_likes
where like_row.id = duplicate_likes.id;

alter table public.idealikes
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
    alter table public.idealikes
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
    alter table public.idealikes
      add constraint idealikesideaidfkey
      foreign key (ideaid) references public.ideas(id) on delete cascade;
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
    alter table public.idealikes
      add constraint idealikesuseridfkey
      foreign key (userid) references auth.users(id) on delete cascade;
  end if;
end $$;

alter table public.idealikes disable row level security;

create unique index if not exists idealikesideaiduseridkey
  on public.idealikes (ideaid, userid);

create index if not exists idealikesideaidcreatedatidx
  on public.idealikes (ideaid, createdat desc);

create index if not exists idealikesuseridcreatedatidx
  on public.idealikes (userid, createdat desc);

grant select, insert, update, delete on table public.idealikes to authenticated;
