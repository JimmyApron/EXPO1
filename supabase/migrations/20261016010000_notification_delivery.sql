-- Shared, per-recipient inbox and server-owned delivery state.
create table public.notification_preferences (
  userid uuid primary key references auth.users(id) on delete cascade,
  deadline boolean not null default true,
  ideareview boolean not null default true,
  finalselection boolean not null default true,
  stalledidea boolean not null default true,
  feedback boolean not null default true,
  likesurge boolean not null default true,
  team_evaluation boolean not null default true,
  team_reminder boolean not null default true,
  team_feedback boolean not null default true,
  team_changes boolean not null default true,
  team_room boolean not null default true,
  push_enabled boolean not null default false,
  deadlinedays integer not null default 3 check (deadlinedays between 1 and 14),
  stalledideadays integer not null default 3 check (stalledideadays between 1 and 14),
  likesurgethreshold integer not null default 3 check (likesurgethreshold between 1 and 100),
  quiet_start integer not null default 22 check (quiet_start between 0 and 23),
  quiet_end integer not null default 8 check (quiet_end between 0 and 23),
  timezone text not null default 'Asia/Seoul',
  updatedat timestamptz not null default now()
);

create table public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  recipientid uuid not null references auth.users(id) on delete cascade,
  projectid uuid references public.projects(id) on delete set null,
  roomid uuid references public.rooms(id) on delete set null,
  scope text not null check (scope in ('personal', 'team')),
  kind text not null,
  sourcekey text not null,
  title text not null,
  message text not null,
  target text not null,
  createdat timestamptz not null default now(),
  readat timestamptz,
  dismissedat timestamptz,
  pushafter timestamptz,
  pushstatus text not null default 'pending' check (pushstatus in ('pending', 'processing', 'sent', 'skipped', 'failed')),
  pushattempts integer not null default 0,
  unique (recipientid, sourcekey)
);
create index app_notifications_recipient_created on public.app_notifications(recipientid, createdat desc);
create index app_notifications_pending on public.app_notifications(pushafter) where pushstatus = 'pending';

create table public.notification_devices (
  token text primary key,
  userid uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updatedat timestamptz not null default now()
);
create index notification_devices_user on public.notification_devices(userid);

create table public.notification_push_attempts (
  id uuid primary key default gen_random_uuid(),
  notificationid uuid not null references public.app_notifications(id) on delete cascade,
  token text not null,
  ticketid text,
  status text not null,
  createdat timestamptz not null default now(),
  checkedat timestamptz
);
create index notification_push_attempts_receipts on public.notification_push_attempts(createdat)
  where ticketid is not null and checkedat is null;

alter table public.notification_preferences enable row level security;
alter table public.app_notifications enable row level security;
alter table public.notification_devices enable row level security;
alter table public.notification_push_attempts enable row level security;
revoke all on public.notification_preferences, public.app_notifications,
  public.notification_devices, public.notification_push_attempts from public, anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, update (readat, dismissedat) on public.app_notifications to authenticated;
grant select, insert, update, delete on public.notification_devices to authenticated;

create policy notification_preferences_own on public.notification_preferences for all to authenticated
  using (userid = auth.uid()) with check (userid = auth.uid());
create policy app_notifications_own_select on public.app_notifications for select to authenticated
  using (recipientid = auth.uid());
create policy app_notifications_own_update on public.app_notifications for update to authenticated
  using (recipientid = auth.uid()) with check (recipientid = auth.uid());
create policy notification_devices_own on public.notification_devices for all to authenticated
  using (userid = auth.uid()) with check (userid = auth.uid());

-- Preserve the previous reminder preference and read state during the transition.
insert into public.notification_preferences(userid, team_reminder)
select userid, enabled from public.reminder_preferences
on conflict (userid) do update set team_reminder = excluded.team_reminder;

create function public.sync_reminder_preference() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  insert into public.reminder_preferences(userid, enabled) values(new.userid, new.team_reminder)
  on conflict (userid) do update set enabled = excluded.enabled;
  return new;
end $$;
create trigger notification_preferences_reminder_sync
after insert or update of team_reminder on public.notification_preferences
for each row execute function public.sync_reminder_preference();

-- Only trusted database routines may create an inbox event.
create function public.enqueue_app_notification(
  p_recipient uuid, p_project uuid, p_room uuid, p_scope text, p_kind text,
  p_sourcekey text, p_title text, p_message text, p_target text,
  p_pushafter timestamptz default now()
) returns void language plpgsql security definer set search_path = '' as $$
declare v_enabled boolean;
begin
  select case p_kind
    when 'deadline' then deadline when 'ideareview' then ideareview
    when 'finalselection' then finalselection when 'stalledidea' then stalledidea
    when 'feedback' then feedback when 'likesurge' then likesurge
    when 'team_evaluation' then team_evaluation when 'team_reminder' then team_reminder
    when 'team_feedback' then team_feedback when 'team_changes' then team_changes
    when 'team_room' then team_room else false end
  into v_enabled from public.notification_preferences where userid = p_recipient;
  if not coalesce(v_enabled, true) then return; end if;
  insert into public.app_notifications
    (recipientid, projectid, roomid, scope, kind, sourcekey, title, message, target, pushafter)
  values (p_recipient, p_project, p_room, p_scope, p_kind, p_sourcekey, p_title, p_message, p_target, p_pushafter)
  on conflict (recipientid, sourcekey) do nothing;
end $$;
revoke all on function public.enqueue_app_notification(uuid, uuid, uuid, text, text, text, text, text, text, timestamptz)
  from public, anon, authenticated;

create function public.enqueue_anonymous_reminder() returns trigger language plpgsql
security definer set search_path = '' as $$
declare v_title text; v_room uuid;
begin
  select title, roomid into v_title, v_room from public.projects where id = new.projectid;
  perform public.enqueue_app_notification(new.recipientid, new.projectid, v_room,
    'team', 'team_reminder', 'reminder:' || new.id::text,
    coalesce(v_title, '팀 과제') || ' 평가 알림',
    '아직 완료하지 않은 평가가 있어요. 평가를 마쳐 주세요.',
    '/projects/' || new.projectid::text || '?projectView=home&flowStep=selection',
    case when new.isread then null else new.createdat end);
  if new.isread then
    update public.app_notifications set readat = new.createdat
    where recipientid = new.recipientid and sourcekey = 'reminder:' || new.id::text;
  end if;
  return new;
end $$;
create trigger reminder_to_app_notifications after insert on public.reminder_notifications
for each row execute function public.enqueue_anonymous_reminder();
create function public.sync_old_reminder_read() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  if new.isread and not old.isread then
    update public.app_notifications set readat = now()
    where recipientid = new.recipientid and sourcekey = 'reminder:' || new.id::text;
  end if;
  return new;
end $$;
create trigger old_reminder_read_sync after update of isread on public.reminder_notifications
for each row execute function public.sync_old_reminder_read();

-- Keep the existing RPC and sender audit, while excluding the sender and repeat targets.
create or replace function public.send_anonymous_reminder(p_projectid uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_room uuid; v_owner uuid; v_round integer; v_targets uuid[];
begin
  if v_user is null then return 'forbidden'; end if;
  select roomid, userid into v_room, v_owner from public.projects where id = p_projectid;
  if not found or v_room is null or not (v_owner = v_user or exists (
    select 1 from public.roommembers where roomid = v_room and userid = v_user
  )) then return 'forbidden'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reminder-user:' || v_user::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reminder-project:' || p_projectid::text, 0));
  if exists (select 1 from public.reminder_dispatches where projectid = p_projectid
    and createdat > now() - interval '1 hour') then return 'cooldown'; end if;
  if (select count(*) from public.reminder_dispatches where senderid = v_user
    and createdat >= date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') >= 5
  then return 'daily_limit'; end if;
  select coalesce(max(evaluationround), 1) into v_round from public.projectflows where projectid = p_projectid;
  if not exists (select 1 from public.ideas where projectid = p_projectid and not legacystructural
    and (btrim(title) <> '' or btrim(content) <> '')) then return 'complete'; end if;
  select array_agg(rm.userid) into v_targets from public.roommembers rm
  where rm.roomid = v_room and rm.userid <> v_user and exists (
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
  if not exists (select 1 from unnest(v_targets) t(userid) where not exists (
    select 1 from public.reminder_preferences p where p.userid = t.userid and not p.enabled
  ) and not exists (select 1 from public.reminder_notifications rn
    where rn.recipientid = t.userid and rn.projectid = p_projectid
      and rn.createdat > now() - interval '24 hours')) then return 'cooldown'; end if;
  insert into public.reminder_dispatches(senderid, projectid) values(v_user, p_projectid);
  insert into public.reminder_notifications(recipientid, projectid)
    select t.userid, p_projectid from unnest(v_targets) t(userid) where not exists (
      select 1 from public.reminder_preferences p where p.userid = t.userid and not p.enabled
    ) and not exists (select 1 from public.reminder_notifications rn
      where rn.recipientid = t.userid and rn.projectid = p_projectid
        and rn.createdat > now() - interval '24 hours');
  return 'sent';
end $$;
insert into public.app_notifications(recipientid, projectid, roomid, scope, kind, sourcekey, title, message, target, createdat, readat, pushafter, pushstatus)
select r.recipientid, r.projectid, p.roomid, 'team', 'team_reminder', 'reminder:' || r.id::text,
  p.title || ' 평가 알림', '아직 완료하지 않은 평가가 있어요. 평가를 마쳐 주세요.',
  '/projects/' || r.projectid::text || '?projectView=home&flowStep=selection',
  r.createdat, case when r.isread then r.createdat end, null, 'skipped'
from public.reminder_notifications r join public.projects p on p.id = r.projectid
on conflict (recipientid, sourcekey) do nothing;

create function public.notify_feedback() returns trigger language plpgsql
security definer set search_path = '' as $$
declare v_owner uuid; v_project uuid; v_room uuid; v_title text; v_kind text;
begin
  select i.userid, i.projectid, p.roomid, p.title into v_owner, v_project, v_room, v_title
  from public.ideas i join public.projects p on p.id = i.projectid where i.id = new.ideaid;
  if v_owner is null or v_owner = new.userid then return new; end if;
  v_kind := case when v_room is null then 'feedback' else 'team_feedback' end;
  perform public.enqueue_app_notification(v_owner, v_project, v_room,
    case when v_room is null then 'personal' else 'team' end, v_kind,
    'feedback:' || new.id::text, v_title || ' 피드백', '내 아이디어에 새 피드백이 달렸어요.',
    '/projects/' || v_project::text || '?projectView=ideas', now() + interval '15 minutes');
  return new;
end $$;
create trigger feedback_notification after insert on public.feedbacks
for each row execute function public.notify_feedback();

create function public.notify_project_change() returns trigger language plpgsql
security definer set search_path = '' as $$
declare v_member record; v_message text; v_key text;
begin
  if new.roomid is null then return new; end if;
  if tg_op = 'INSERT' then
    v_message := '새 팀 과제가 등록됐어요.';
    v_key := 'project-created:' || new.id::text;
  elsif new.deadline is distinct from old.deadline then
    v_message := '과제 마감일이 변경됐어요.';
    v_key := 'deadline-changed:' || new.id::text || ':' || coalesce(new.deadline::text, 'none') || ':' || new.updatedat::text;
  else return new; end if;
  for v_member in select userid from public.roommembers where roomid = new.roomid loop
    if v_member.userid is distinct from auth.uid() then
      perform public.enqueue_app_notification(v_member.userid, new.id, new.roomid,
        'team', 'team_changes', v_key, new.title, v_message,
        '/projects/' || new.id::text || '?projectView=home', now());
    end if;
  end loop;
  return new;
end $$;
create trigger project_change_notification after insert or update of deadline on public.projects
for each row execute function public.notify_project_change();

create function public.notify_selected_idea() returns trigger language plpgsql
security definer set search_path = '' as $$
declare v_project public.projects%rowtype; v_member record;
begin
  if new.selectedideaid is null or new.selectedideaid is not distinct from old.selectedideaid then return new; end if;
  select * into v_project from public.projects where id = new.projectid;
  if v_project.roomid is null then return new; end if;
  for v_member in select userid from public.roommembers where roomid = v_project.roomid loop
    if v_member.userid is distinct from auth.uid() then
      perform public.enqueue_app_notification(v_member.userid, new.projectid, v_project.roomid,
        'team', 'team_changes', 'selected:' || new.projectid::text || ':' || new.selectedideaid::text,
        v_project.title || ' 최종 아이디어 선정', '팀의 최종 아이디어가 선정됐어요.',
        '/projects/' || new.projectid::text || '?projectView=home&flowStep=selection', now());
    end if;
  end loop;
  return new;
end $$;
create trigger selected_idea_notification after update of selectedideaid on public.projectflows
for each row execute function public.notify_selected_idea();

create function public.notify_evaluation_progress() returns trigger language plpgsql
security definer set search_path = '' as $$
declare v_project public.projects%rowtype; v_member record; v_ideas integer; v_completed integer; v_total integer;
begin
  select * into v_project from public.projects where id = new.projectid;
  if v_project.roomid is null then return new; end if;
  select count(*) into v_ideas from public.ideas
    where projectid = new.projectid and not legacystructural and (btrim(title) <> '' or btrim(content) <> '');
  if v_ideas = 0 then return new; end if;
  select count(*) into v_total from public.roommembers where roomid = v_project.roomid;
  select count(*) into v_completed from public.roommembers m where m.roomid = v_project.roomid
    and not exists (select 1 from public.ideas i where i.projectid = new.projectid and not i.legacystructural
      and (btrim(i.title) <> '' or btrim(i.content) <> '') and not exists
      (select 1 from public.ideaevaluations e where e.projectid = new.projectid and e.ideaid = i.id
       and e.userid = m.userid and e.evaluationround = new.evaluationround));
  if (select count(*) from public.ideaevaluations where projectid = new.projectid and evaluationround = new.evaluationround) = 1 then
    for v_member in select userid from public.roommembers where roomid = v_project.roomid and userid <> new.userid loop
      perform public.enqueue_app_notification(v_member.userid, new.projectid, v_project.roomid,
        'team', 'team_evaluation', 'evaluation-start:' || new.projectid::text || ':' || new.evaluationround::text,
        v_project.title || ' 팀 평가', '팀 평가가 시작됐어요. 내 평가를 완료해 주세요.',
        '/projects/' || new.projectid::text || '?projectView=home&flowStep=selection', now());
    end loop;
  end if;
  if v_completed = v_total and v_total > 0 then
    for v_member in select userid from public.roommembers where roomid = v_project.roomid loop
      perform public.enqueue_app_notification(v_member.userid, new.projectid, v_project.roomid,
        'team', 'team_evaluation', 'evaluation-done:' || new.projectid::text || ':' || new.evaluationround::text,
        v_project.title || ' 평가 완료', '팀원 모두 평가를 마쳤어요. 결과를 확인해 보세요.',
        '/projects/' || new.projectid::text || '?projectView=home&flowStep=selection', now());
    end loop;
  end if;
  return new;
end $$;
create trigger evaluation_progress_notification after insert on public.ideaevaluations
for each row execute function public.notify_evaluation_progress();

create function public.notify_room_member() returns trigger language plpgsql
security definer set search_path = '' as $$
declare v_name text; v_owner uuid;
begin
  select name, ownerid into v_name, v_owner from public.rooms where id = new.roomid;
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    perform public.enqueue_app_notification(new.userid, null, new.roomid, 'team', 'team_room',
      'role:' || new.id::text || ':' || new.updatedat::text,
      coalesce(v_name, '팀') || ' 역할 변경', '팀에서 내 역할이 변경됐어요.', '/rooms', now());
  elsif tg_op = 'INSERT' and new.userid <> v_owner then
    perform public.enqueue_app_notification(v_owner, null, new.roomid, 'team', 'team_room',
      'member:' || new.id::text, coalesce(v_name, '팀') || ' 새 팀원',
      '새 팀원이 참여했어요.', '/rooms', now());
  end if;
  return new;
end $$;
create trigger room_member_notification after insert or update of role on public.roommembers
for each row execute function public.notify_room_member();

create function public.notify_like_milestone() returns trigger language plpgsql
security definer set search_path = '' as $$
declare v_owner uuid; v_project uuid; v_room uuid; v_title text; v_count integer; v_threshold integer;
begin
  select i.userid, i.projectid, p.roomid, p.title into v_owner, v_project, v_room, v_title
  from public.ideas i join public.projects p on p.id = i.projectid where i.id = new.ideaid;
  if v_room is not null or v_owner is null or v_owner = new.userid then return new; end if;
  select coalesce(likesurgethreshold, 3) into v_threshold from public.notification_preferences where userid = v_owner;
  v_threshold := coalesce(v_threshold, 3);
  select count(*) into v_count from public.idealikes where ideaid = new.ideaid;
  if v_count < v_threshold or mod(v_count, v_threshold) <> 0 then return new; end if;
  perform public.enqueue_app_notification(v_owner, v_project, null, 'personal', 'likesurge',
    'likes:' || new.ideaid::text || ':' || v_count::text, v_title || ' 공감',
    '내 아이디어가 ' || v_count::text || '개의 공감을 받았어요.',
    '/projects/' || v_project::text || '?projectView=ideas', null);
  return new;
end $$;
create trigger like_milestone_notification after insert on public.idealikes
for each row execute function public.notify_like_milestone();

-- The database job runs independently of whether any mobile client is open.
create function public.generate_due_notifications() returns void language plpgsql
security definer set search_path = '' as $$
declare p record; v_local timestamp; v_days integer; v_last timestamptz; v_count integer; v_base text;
begin
  for p in select pr.*, coalesce(np.timezone, 'Asia/Seoul') as usertimezone,
    coalesce(np.deadlinedays, 3) as firstday, coalesce(np.stalledideadays, 3) as stalldays
    from public.projects pr left join public.notification_preferences np on np.userid = pr.userid
    where pr.roomid is null loop
    begin v_local := now() at time zone p.usertimezone;
    exception when invalid_parameter_value then v_local := now() at time zone 'Asia/Seoul'; end;
    if extract(hour from v_local) < 9 then continue; end if;
    if p.deadline is not null then
      v_days := p.deadline::date - v_local::date;
      if v_days >= 0 and v_days in (p.firstday, 1, 0) then
        perform public.enqueue_app_notification(p.userid, p.id, null, 'personal', 'deadline',
          'deadline:' || p.id::text || ':' || p.deadline::text || ':' || v_days::text,
          p.title || ' 마감 알림', case when v_days = 0 then '오늘이 마감일이에요.'
            else '마감까지 ' || v_days::text || '일 남았어요.' end,
          '/projects/' || p.id::text || '?projectView=home', now());
      end if;
    end if;
    select count(*), max(updatedat) into v_count, v_last from public.ideas
      where projectid = p.id and not legacystructural and status = 'research';
    if v_count > 0 and v_last <= now() - interval '1 day' then
      v_base := 'review:' || p.id::text || ':' || v_last::text;
      perform public.enqueue_app_notification(p.userid, p.id, null, 'personal', 'ideareview',
        v_base || ':1', p.title || ' 아이디어 검토', '검토가 필요한 아이디어가 있어요.',
        '/projects/' || p.id::text || '?projectView=ideas', now());
      if exists (select 1 from public.app_notifications n where n.recipientid = p.userid
        and n.sourcekey = v_base || ':1' and n.createdat <= now() - interval '3 days') then
        perform public.enqueue_app_notification(p.userid, p.id, null, 'personal', 'ideareview',
          v_base || ':2', p.title || ' 아이디어 검토', '아직 검토하지 않은 아이디어가 있어요.',
          '/projects/' || p.id::text || '?projectView=ideas', now());
      end if;
    end if;
    select count(*), max(updatedat) into v_count, v_last from public.ideas
      where projectid = p.id and not legacystructural and status = 'thought'
        and updatedat <= now() - make_interval(days => p.stalldays);
    if v_count > 0 then
      v_base := 'stalled:' || p.id::text || ':' || v_last::text;
      perform public.enqueue_app_notification(p.userid, p.id, null, 'personal', 'stalledidea',
        v_base || ':1', p.title || ' 진행 정체', '오래 갱신되지 않은 아이디어가 있어요.',
        '/projects/' || p.id::text || '?projectView=ideas', now());
      if exists (select 1 from public.app_notifications n where n.recipientid = p.userid
        and n.sourcekey = v_base || ':1' and n.createdat <= now() - interval '7 days') then
        perform public.enqueue_app_notification(p.userid, p.id, null, 'personal', 'stalledidea',
          v_base || ':2', p.title || ' 진행 정체', '아이디어를 다시 확인해 보세요.',
          '/projects/' || p.id::text || '?projectView=ideas', now());
      end if;
    end if;
    select f.updatedat into v_last from public.projectflows f where f.projectid = p.id
      and f.blindanalysis is not null and f.selectedideaid is null;
    if v_last is not null and v_last <= now() - interval '1 day' then
      v_base := 'selection:' || p.id::text || ':' || v_last::text;
      perform public.enqueue_app_notification(p.userid, p.id, null, 'personal', 'finalselection',
        v_base || ':1', p.title || ' 최종 선정', '비교 결과를 확인하고 아이디어를 선정해 주세요.',
        '/projects/' || p.id::text || '?projectView=home&flowStep=selection', now());
      if exists (select 1 from public.app_notifications n where n.recipientid = p.userid
        and n.sourcekey = v_base || ':1' and n.createdat <= now() - interval '3 days') then
        perform public.enqueue_app_notification(p.userid, p.id, null, 'personal', 'finalselection',
          v_base || ':2', p.title || ' 최종 선정', '아직 최종 아이디어를 선정하지 않았어요.',
          '/projects/' || p.id::text || '?projectView=home&flowStep=selection', now());
      end if;
    end if;
  end loop;
end $$;
revoke all on function public.generate_due_notifications() from public, anon, authenticated;

-- Claiming is atomic, so concurrent workers cannot deliver the same event.
create function public.claim_due_notification_pushes(p_limit integer default 50)
returns setof public.app_notifications language plpgsql security definer set search_path = '' as $$
begin
  return query with claimed as (
    select n.id from public.app_notifications n
    join public.notification_preferences p on p.userid = n.recipientid
    where n.pushstatus = 'pending' and n.pushafter <= now() and n.readat is null
      and n.dismissedat is null and p.push_enabled
      and not (
        case when p.quiet_start = p.quiet_end then false
        when p.quiet_start < p.quiet_end then
          extract(hour from now() at time zone p.timezone) >= p.quiet_start
          and extract(hour from now() at time zone p.timezone) < p.quiet_end
        else extract(hour from now() at time zone p.timezone) >= p.quiet_start
          or extract(hour from now() at time zone p.timezone) < p.quiet_end end)
    order by n.pushafter, n.createdat limit least(greatest(p_limit, 1), 100)
    for update of n skip locked
  ) update public.app_notifications n set pushstatus = 'processing', pushattempts = pushattempts + 1
    from claimed where n.id = claimed.id returning n.*;
end $$;
revoke all on function public.claim_due_notification_pushes(integer) from public, anon, authenticated;
grant execute on function public.claim_due_notification_pushes(integer) to service_role;

-- Recover work if a worker exits after claiming a batch.
create function public.requeue_stale_notification_pushes() returns void language sql
security definer set search_path = '' as $$
  update public.app_notifications set pushstatus = 'pending', pushafter = now() + interval '5 minutes'
  where pushstatus = 'processing' and pushafter < now() - interval '15 minutes' and pushattempts < 4;
  update public.app_notifications set pushstatus = 'failed'
  where pushstatus = 'processing' and pushafter < now() - interval '15 minutes' and pushattempts >= 4;
$$;
revoke all on function public.requeue_stale_notification_pushes() from public, anon, authenticated;
grant execute on function public.requeue_stale_notification_pushes() to service_role;

create function public.notification_is_actionable(p_id uuid) returns boolean language plpgsql
security definer set search_path = '' as $$
declare n public.app_notifications%rowtype; p public.notification_preferences%rowtype;
  v_round integer; v_deadline text;
begin
  select * into n from public.app_notifications where id = p_id;
  if not found or n.readat is not null or n.dismissedat is not null then return false; end if;
  select * into p from public.notification_preferences where userid = n.recipientid;
  if not found or not p.push_enabled then return false; end if;
  if not (case n.kind
    when 'deadline' then p.deadline when 'ideareview' then p.ideareview
    when 'finalselection' then p.finalselection when 'stalledidea' then p.stalledidea
    when 'feedback' then p.feedback when 'likesurge' then p.likesurge
    when 'team_evaluation' then p.team_evaluation when 'team_reminder' then p.team_reminder
    when 'team_feedback' then p.team_feedback when 'team_changes' then p.team_changes
    when 'team_room' then p.team_room else false end) then return false; end if;
  if n.kind = 'deadline' then
    select deadline::text into v_deadline from public.projects where id = n.projectid;
    return v_deadline is not null and n.sourcekey like 'deadline:%:' || v_deadline || ':%'
      and v_deadline::date >= (now() at time zone p.timezone)::date;
  end if;
  if n.kind = 'ideareview' then
    return exists (select 1 from public.ideas where projectid = n.projectid
      and not legacystructural and status = 'research');
  end if;
  if n.kind = 'finalselection' then
    return exists (select 1 from public.projectflows where projectid = n.projectid
      and blindanalysis is not null and selectedideaid is null);
  end if;
  if n.kind = 'stalledidea' then
    return exists (select 1 from public.ideas where projectid = n.projectid
      and not legacystructural and status = 'thought'
      and updatedat <= now() - make_interval(days => p.stalledideadays));
  end if;
  if n.kind = 'team_reminder' or (n.kind = 'team_evaluation' and n.sourcekey like 'evaluation-start:%') then
    if not exists (select 1 from public.projects pr join public.roommembers m on m.roomid = pr.roomid
      where pr.id = n.projectid and m.userid = n.recipientid) then return false; end if;
    select coalesce(max(evaluationround), 1) into v_round from public.projectflows where projectid = n.projectid;
    if n.kind = 'team_evaluation' and n.sourcekey <> 'evaluation-start:' || n.projectid::text || ':' || v_round::text then
      return false;
    end if;
    return exists (select 1 from public.ideas i where i.projectid = n.projectid and not i.legacystructural
      and (btrim(i.title) <> '' or btrim(i.content) <> '')
      and not exists (select 1 from public.ideaevaluations e where e.projectid = n.projectid
        and e.ideaid = i.id and e.userid = n.recipientid and e.evaluationround = v_round));
  end if;
  return true;
end $$;
revoke all on function public.notification_is_actionable(uuid) from public, anon, authenticated;
grant execute on function public.notification_is_actionable(uuid) to service_role;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'app_notifications') then
    alter publication supabase_realtime add table public.app_notifications;
  end if;
end $$;

-- Configure these Vault secrets on the target project before push dispatch is live:
-- notification_worker_url = https://<project-ref>.supabase.co/functions/v1/notification-worker
-- notification_worker_key = the same random value as the Edge Function's NOTIFICATION_WORKER_SECRET.
-- The key is read inside Postgres; it must never be stored in source or sent to the app.
create function public.invoke_notification_worker() returns void language plpgsql
security definer set search_path = '' as $$
declare v_url text; v_key text;
begin
  if to_regclass('vault.decrypted_secrets') is null or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    return;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
    into v_url using 'notification_worker_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
    into v_key using 'notification_worker_key';
  if v_url is null or v_key is null then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end $$;
revoke all on function public.invoke_notification_worker() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('watt-notification-generate', '*/15 * * * *',
      'select public.generate_due_notifications()');
    if exists (select 1 from pg_available_extensions where name = 'pg_net') then
      create extension if not exists pg_net with schema extensions;
      perform cron.schedule('watt-notification-worker', '* * * * *',
        'select public.invoke_notification_worker()');
    end if;
  end if;
end $$;
