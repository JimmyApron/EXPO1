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
  add column if not exists description text not null default '',
  add column if not exists invitecode text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  add column if not exists allowmemberinvite boolean not null default true,
  add column if not exists createdat timestamptz not null default now(),
  add column if not exists updatedat timestamptz not null default now();

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

create index if not exists roominvitesroomidcreatedatidx
  on roominvites (roomid, createdat desc);

create index if not exists roominvitescodeidx
  on roominvites (code);

grant select, insert, update, delete on table roominvites to authenticated;

alter table projects
  add column if not exists roomid uuid null references rooms(id) on delete set null;

create index if not exists projectsroomidcreatedatidx
  on projects (roomid, createdat desc);
