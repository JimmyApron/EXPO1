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
