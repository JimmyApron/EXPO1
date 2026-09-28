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
