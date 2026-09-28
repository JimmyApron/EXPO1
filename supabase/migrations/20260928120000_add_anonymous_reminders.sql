-- Sender audit data is never granted to API roles. Existing room/project policies stay intact.
create table public.reminder_preferences (
  userid uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true
);
create table public.reminder_dispatches (
  id uuid primary key default gen_random_uuid(),
  senderid uuid not null references auth.users(id) on delete cascade,
  projectid uuid not null references public.projects(id) on delete cascade,
  createdat timestamptz not null default now()
);
create index reminder_dispatch_sender_time on public.reminder_dispatches(senderid, createdat);
create index reminder_dispatch_project_time on public.reminder_dispatches(projectid, createdat);
create table public.reminder_notifications (
  id uuid primary key default gen_random_uuid(),
  recipientid uuid not null references auth.users(id) on delete cascade,
  projectid uuid not null references public.projects(id) on delete cascade,
  createdat timestamptz not null default now(),
  isread boolean not null default false
);
alter table public.reminder_preferences enable row level security;
alter table public.reminder_dispatches enable row level security;
alter table public.reminder_notifications enable row level security;
revoke all on public.reminder_dispatches from public, anon, authenticated;
revoke all on public.reminder_notifications from public, anon, authenticated;
revoke all on public.reminder_preferences from public, anon, authenticated;
grant select, insert, update on public.reminder_preferences to authenticated;
grant select on public.reminder_notifications to authenticated;
grant update (isread) on public.reminder_notifications to authenticated;
create policy reminder_preferences_own on public.reminder_preferences for all to authenticated
  using (userid = auth.uid()) with check (userid = auth.uid());
create policy reminder_notifications_own on public.reminder_notifications for select to authenticated
  using (recipientid = auth.uid());
create policy reminder_notifications_read on public.reminder_notifications for update to authenticated
  using (recipientid = auth.uid()) with check (recipientid = auth.uid());

create function public.send_anonymous_reminder(p_projectid uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_room uuid; v_owner uuid; v_round integer; v_targets uuid[];
begin
  if v_user is null then return 'forbidden'; end if;
  select roomid, userid into v_room, v_owner from public.projects where id = p_projectid;
  if not found or v_room is null or not (v_owner = v_user or exists (
    select 1 from public.roommembers where roomid = v_room and userid = v_user
  )) then return 'forbidden'; end if;
  -- Serialize per sender AND project so concurrent requests cannot bypass either limit.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reminder-user:' || v_user::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reminder-project:' || p_projectid::text, 0));
  if exists (select 1 from public.reminder_dispatches where projectid = p_projectid and createdat > now() - interval '1 hour') then return 'cooldown'; end if;
  if (select count(*) from public.reminder_dispatches where senderid = v_user and createdat >= date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') >= 5 then return 'daily_limit'; end if;
  select coalesce(max(evaluationround), 1) into v_round from public.projectflows where projectid = p_projectid;
  if not exists (select 1 from public.ideas where projectid = p_projectid and not legacystructural and (btrim(title) <> '' or btrim(content) <> '')) then return 'complete'; end if;
  select array_agg(rm.userid) into v_targets from public.roommembers rm
  where rm.roomid = v_room and exists (
    select 1 from public.ideas i where i.projectid = p_projectid and not i.legacystructural
      and (btrim(i.title) <> '' or btrim(i.content) <> '') and not exists (
        select 1 from public.ideaevaluations e where e.projectid = p_projectid and e.ideaid = i.id
          and e.userid = rm.userid and e.evaluationround = v_round
      )
  );
  if coalesce(cardinality(v_targets), 0) = 0 then return 'complete'; end if;
  if not exists (select 1 from unnest(v_targets) t(userid) where not exists (
    select 1 from public.reminder_preferences p where p.userid = t.userid and not p.enabled
  )) then return 'opted_out'; end if;
  insert into public.reminder_dispatches(senderid, projectid) values(v_user, p_projectid);
  insert into public.reminder_notifications(recipientid, projectid)
    select t.userid, p_projectid from unnest(v_targets) t(userid) where not exists (
      select 1 from public.reminder_preferences p where p.userid = t.userid and not p.enabled
    );
  return 'sent';
end;
$$;
revoke all on function public.send_anonymous_reminder(uuid) from public, anon;
grant execute on function public.send_anonymous_reminder(uuid) to authenticated;
