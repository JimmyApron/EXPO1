-- Kicking only removes the membership. A kicked user may join again with an invite code.

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

  insert into public.roommembers (roomid, userid, role)
  values (v_room.id, v_actor, 'member')
  on conflict (roomid, userid) do nothing;
  return v_room.id;
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

  delete from public.roommembers where id = p_target_memberid and roomid = p_roomid;
end;
$$;

drop function if exists public.unban_room_member(uuid, uuid);
drop table if exists public.roombans;

revoke execute on function public.join_room_by_code(text) from public, anon;
revoke execute on function public.kick_room_member(uuid, uuid) from public, anon;
grant execute on function public.join_room_by_code(text) to authenticated;
grant execute on function public.kick_room_member(uuid, uuid) to authenticated;
