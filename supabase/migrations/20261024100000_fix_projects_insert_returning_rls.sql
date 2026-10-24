-- INSERT ... RETURNING must be able to authorize the new row directly.
-- A STABLE helper that queries projects cannot see that row yet.
alter policy projects_read on public.projects
  using (
    (roomid is null and userid = (select auth.uid()))
    or (roomid is not null and public.is_room_member(roomid, (select auth.uid())))
  );
