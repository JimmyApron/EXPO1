-- Project access is checked against current room membership. Service role retains
-- its normal RLS bypass; authenticated clients use only the policies below.
create or replace function public.watt_can_access_project(p_project_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select p_user_id is not null and (p_user_id=auth.uid() or auth.role()='service_role') and exists (
    select 1 from public.projects p where p.id = p_project_id and
      ((p.roomid is null and p.userid = p_user_id) or
       (p.roomid is not null and public.is_room_member(p.roomid, p_user_id)))
  );
$$;
revoke all on function public.watt_can_access_project(uuid,uuid) from public,anon,authenticated;
grant execute on function public.watt_can_access_project(uuid,uuid) to authenticated,service_role;

-- Remove any legacy permissive policies before enabling RLS.
do $$ declare t text; r record; begin
  foreach t in array array['projects','projectflows','ideas','ideacategories','idealikes','feedbacks'] loop
    for r in select policyname from pg_catalog.pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I',r.policyname,t);
    end loop;
  end loop;
end $$;
alter table public.projects enable row level security;
alter table public.projectflows enable row level security;
alter table public.ideas enable row level security;
alter table public.ideacategories enable row level security;
alter table public.idealikes enable row level security;
alter table public.feedbacks enable row level security;
revoke all on public.projects,public.projectflows,public.ideas,public.ideacategories,
  public.idealikes,public.feedbacks from public,anon;
grant select,insert,update,delete on public.projects,public.projectflows,public.ideas,
  public.ideacategories,public.idealikes,public.feedbacks to authenticated;
revoke update on public.feedbacks from authenticated;
grant update(isresolved,updatedat) on public.feedbacks to authenticated;

create policy projects_read on public.projects for select to authenticated
  using (public.watt_can_access_project(id,(select auth.uid())));
create policy projects_create on public.projects for insert to authenticated
  with check (userid=(select auth.uid()) and (roomid is null or public.is_room_member(roomid,(select auth.uid()))));
create policy projects_edit on public.projects for update to authenticated
  using (public.watt_can_access_project(id,(select auth.uid())))
  with check (public.watt_can_access_project(id,(select auth.uid())));
create policy projects_remove on public.projects for delete to authenticated
  using (public.watt_can_access_project(id,(select auth.uid())));

-- FK room deletion may detach a project; clients cannot reassign its owner or room.
create or replace function public.watt_guard_project_identity() returns trigger
language plpgsql set search_path=pg_catalog as $$ begin
  if new.userid is distinct from old.userid or
     (new.roomid is distinct from old.roomid and not
       (old.roomid is not null and new.roomid is null and
        not exists(select 1 from public.rooms where id=old.roomid))) then
    raise exception 'project_identity_immutable' using errcode='42501';
  end if;
  return new;
end $$;
create trigger watt_project_identity before update on public.projects
  for each row execute function public.watt_guard_project_identity();

create or replace function public.watt_guard_link_identity() returns trigger
language plpgsql set search_path=pg_catalog as $$
declare v_old jsonb:=to_jsonb(old); v_new jsonb:=to_jsonb(new);
begin
  if (v_new->>tg_argv[0]) is distinct from (v_old->>tg_argv[0])
    or (tg_nargs>1 and (v_new->>tg_argv[1]) is distinct from (v_old->>tg_argv[1]))
  then raise exception 'linked_identity_immutable' using errcode='42501'; end if;
  return new;
end $$;
create trigger watt_flow_link before update on public.projectflows
  for each row execute function public.watt_guard_link_identity('projectid');
create or replace function public.watt_stamp_flow_editor() returns trigger
language plpgsql set search_path=pg_catalog as $$ begin
  if auth.uid() is not null then new.userid:=auth.uid(); end if;
  return new;
end $$;
create trigger watt_flow_editor before update on public.projectflows
  for each row execute function public.watt_stamp_flow_editor();
create trigger watt_idea_link before update on public.ideas
  for each row execute function public.watt_guard_link_identity('projectid','userid');
create trigger watt_category_link before update on public.ideacategories
  for each row execute function public.watt_guard_link_identity('projectid','userid');
create trigger watt_like_link before update on public.idealikes
  for each row execute function public.watt_guard_link_identity('ideaid','userid');
create trigger watt_feedback_link before update on public.feedbacks
  for each row execute function public.watt_guard_link_identity('ideaid','userid');
create trigger watt_evaluation_link before update on public.project_evaluations
  for each row execute function public.watt_guard_link_identity('projectid','evaluatorid');
create trigger watt_evaluation_idea before update on public.project_evaluations
  for each row execute function public.watt_guard_link_identity('ideaid');
create trigger watt_participant_link before update on public.project_evaluation_participants
  for each row execute function public.watt_guard_link_identity('projectid','userid');

create or replace function public.watt_guard_flow_selection() returns trigger
language plpgsql set search_path=pg_catalog as $$ begin
  if new.selectedideaid is not null and not exists (
    select 1 from public.ideas i where i.id=new.selectedideaid and i.projectid=new.projectid
  ) then raise exception 'idea_project_mismatch' using errcode='23514'; end if;
  return new;
end $$;
create trigger watt_flow_selection before insert or update of selectedideaid,projectid on public.projectflows
  for each row execute function public.watt_guard_flow_selection();

create policy projectflows_read on public.projectflows for select to authenticated
  using (public.watt_can_access_project(projectid,(select auth.uid())));
create policy projectflows_create on public.projectflows for insert to authenticated
  with check (userid=(select auth.uid()) and public.watt_can_access_project(projectid,(select auth.uid())));
create policy projectflows_edit on public.projectflows for update to authenticated
  using (public.watt_can_access_project(projectid,(select auth.uid())))
  with check (userid=(select auth.uid()) and public.watt_can_access_project(projectid,(select auth.uid())));
create policy projectflows_remove on public.projectflows for delete to authenticated
  using (public.watt_can_access_project(projectid,(select auth.uid())));

create policy ideas_read on public.ideas for select to authenticated
  using (public.watt_can_access_project(projectid,(select auth.uid())));
create policy ideas_create on public.ideas for insert to authenticated
  with check (userid=(select auth.uid()) and public.watt_can_access_project(projectid,(select auth.uid())));
create policy ideas_edit on public.ideas for update to authenticated
  using (public.watt_can_access_project(projectid,(select auth.uid())))
  with check (public.watt_can_access_project(projectid,(select auth.uid())));
create policy ideas_remove on public.ideas for delete to authenticated
  using (userid=(select auth.uid()) and public.watt_can_access_project(projectid,(select auth.uid())));

create policy ideacategories_read on public.ideacategories for select to authenticated
  using (public.watt_can_access_project(projectid,(select auth.uid())));
create policy ideacategories_create on public.ideacategories for insert to authenticated
  with check (userid=(select auth.uid()) and public.watt_can_access_project(projectid,(select auth.uid())));
create policy ideacategories_edit on public.ideacategories for update to authenticated
  using (public.watt_can_access_project(projectid,(select auth.uid())))
  with check (public.watt_can_access_project(projectid,(select auth.uid())));
create policy ideacategories_remove on public.ideacategories for delete to authenticated
  using (public.watt_can_access_project(projectid,(select auth.uid())));

create policy idealikes_read on public.idealikes for select to authenticated
  using (exists(select 1 from public.ideas i where i.id=ideaid));
create policy idealikes_create on public.idealikes for insert to authenticated
  with check (userid=(select auth.uid()) and exists(select 1 from public.ideas i where i.id=ideaid));
create policy idealikes_edit on public.idealikes for update to authenticated
  using (userid=(select auth.uid()) and exists(select 1 from public.ideas i where i.id=ideaid))
  with check (userid=(select auth.uid()) and exists(select 1 from public.ideas i where i.id=ideaid));
create policy idealikes_remove on public.idealikes for delete to authenticated
  using (userid=(select auth.uid()) and exists(select 1 from public.ideas i where i.id=ideaid));

create policy feedbacks_read on public.feedbacks for select to authenticated
  using (exists(select 1 from public.ideas i where i.id=ideaid));
create policy feedbacks_create on public.feedbacks for insert to authenticated
  with check (userid=(select auth.uid()) and exists(select 1 from public.ideas i where i.id=ideaid));
create policy feedbacks_edit on public.feedbacks for update to authenticated
  using (exists(select 1 from public.ideas i where i.id=ideaid))
  with check (exists(select 1 from public.ideas i where i.id=ideaid));
create policy feedbacks_remove on public.feedbacks for delete to authenticated
  using (userid=(select auth.uid()) and exists(select 1 from public.ideas i where i.id=ideaid));

-- Blind ballots must never be visible to unrelated users or inserted for another project.
drop policy if exists ideaevaluations_select_project_members on public.ideaevaluations;
drop policy if exists ideaevaluations_insert_self on public.ideaevaluations;
create policy ideaevaluations_select_project_members on public.ideaevaluations for select to authenticated
  using (public.watt_can_access_project(projectid,(select auth.uid())));
create policy ideaevaluations_insert_self on public.ideaevaluations for insert to authenticated
  with check (userid=(select auth.uid()) and public.watt_can_access_project(projectid,(select auth.uid()))
    and exists(select 1 from public.ideas i where i.id=ideaid and i.projectid=ideaevaluations.projectid));
drop policy if exists project_evaluations_select on public.project_evaluations;
create policy project_evaluations_select on public.project_evaluations for select to authenticated
  using (evaluatorid=(select auth.uid()) and public.watt_can_access_project(projectid,(select auth.uid())));
drop policy if exists project_evaluations_update on public.project_evaluations;
create policy project_evaluations_update on public.project_evaluations for update to authenticated
  using (evaluatorid=(select auth.uid()) and public.watt_can_access_project(projectid,(select auth.uid())))
  with check (evaluatorid=(select auth.uid()) and public.watt_can_access_project(projectid,(select auth.uid())));
drop policy if exists project_evaluation_participants_update on public.project_evaluation_participants;
create policy project_evaluation_participants_update on public.project_evaluation_participants for update to authenticated
  using (userid=(select auth.uid()) and public.watt_can_access_project(projectid,(select auth.uid())))
  with check (userid=(select auth.uid()) and public.watt_can_access_project(projectid,(select auth.uid())));

-- Keep documented client reads; no direct authenticated writes to billing data.
revoke all on public.watt_products,public.watt_entitlements,public.watt_grants,
  public.watt_purchases,public.watt_trials,public.watt_usage,public.watt_usage_allocations,
  public.watt_renewals,public.watt_usage_responses from public,anon,authenticated;
grant select on public.watt_products,public.watt_entitlements,public.watt_grants,
  public.watt_purchases,public.watt_trials,public.watt_usage,public.watt_renewals to authenticated;
grant select on public.watt_products to anon;
drop policy if exists watt_entitlements_read on public.watt_entitlements;
create policy watt_entitlements_read on public.watt_entitlements for select to authenticated
  using ((room_id is null and user_id=(select auth.uid())) or
    (room_id is not null and public.is_room_member(room_id,(select auth.uid()))));
create policy watt_renewals_read on public.watt_renewals for select to authenticated
  using (exists(select 1 from public.watt_entitlements e where e.id=entitlement_id
    and ((e.room_id is null and e.user_id=(select auth.uid())) or
      (e.room_id is not null and public.is_room_member(e.room_id,(select auth.uid()))))));
grant all on public.watt_usage_responses to service_role;

-- A room delete must not erase a used trial or its original room identity.
alter table public.watt_trials add column if not exists original_room_id uuid;
update public.watt_trials set original_room_id=room_id where original_room_id is null and room_id is not null;
create unique index if not exists watt_trials_original_room_once on public.watt_trials(original_room_id)
  where original_room_id is not null;
alter table public.watt_trials drop constraint if exists watt_trials_room_id_fkey;
alter table public.watt_trials add constraint watt_trials_room_id_fkey
  foreign key(room_id) references public.rooms(id) on delete set null;

-- Serialize joins on the room row and enforce the subscribed team's size continuously.
create or replace function public.watt_guard_team_size() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
  perform 1 from public.rooms where id=new.roomid for update;
  if not found then return new; end if;
  if exists(select 1 from public.watt_entitlements e where e.room_id=new.roomid
      and e.state in ('active','cancel_scheduled') and e.ends_at>clock_timestamp()
      and e.product_id in ('team_30','team_120','trial_team'))
    and (select count(*) from public.roommembers where roomid=new.roomid and id is distinct from new.id)>=5
  then raise exception 'team_limit' using errcode='23514'; end if;
  return new;
end $$;
create trigger watt_team_size before insert or update of roomid on public.roommembers
  for each row execute function public.watt_guard_team_size();

-- Price rates are intentionally empty until server administrators enter verified rates.
create table public.watt_model_rates (
  provider text not null, model text not null,
  input_usd_per_million numeric(14,6) not null check(input_usd_per_million>=0),
  output_usd_per_million numeric(14,6) not null check(output_usd_per_million>=0),
  effective_at timestamptz not null default now(), primary key(provider,model,effective_at)
);
create table public.watt_provider_calls (
  usage_id uuid not null references public.watt_usage(id) on delete cascade,
  attempt integer not null check(attempt between 1 and 3),
  provider text not null check(provider in ('deepseek','anthropic')),
  model text not null check(length(model) between 1 and 100),
  http_status integer not null check(http_status between 0 and 599),
  input_tokens integer check(input_tokens>=0), output_tokens integer check(output_tokens>=0),
  estimated_cost_usd numeric(14,8), actual_cost_usd numeric(14,8),
  cost_basis text not null,
  created_at timestamptz not null default now(), primary key(usage_id,attempt)
);
alter table public.watt_model_rates enable row level security;
alter table public.watt_provider_calls enable row level security;
revoke all on public.watt_model_rates,public.watt_provider_calls from public,anon,authenticated;
grant all on public.watt_model_rates,public.watt_provider_calls to service_role;

-- Operations may disable simulated renewals here; Edge configuration independently
-- gates new simulated activations. Defaults keep the development flow working.
create table public.watt_billing_settings (
  id boolean primary key default true check(id),
  simulated_billing_enabled boolean not null default true
);
insert into public.watt_billing_settings(id,simulated_billing_enabled) values(true,true);
alter table public.watt_billing_settings enable row level security;
revoke all on public.watt_billing_settings from public,anon,authenticated;
grant all on public.watt_billing_settings to service_role;

create or replace function public.watt_preserve_trial_room() returns trigger
language plpgsql set search_path=pg_catalog as $$ begin
  new.original_room_id:=new.room_id;
  return new;
end $$;
create trigger watt_trial_original_room before insert on public.watt_trials
  for each row execute function public.watt_preserve_trial_room();

-- Phase 2 reservation logic with mandatory project validation and global slot limits.
create or replace function public.watt_reserve_usage(
  p_user_id uuid,p_request_id uuid,p_feature text,p_project_id uuid,p_room_id uuid,p_units integer,
  p_request_hash text default null,p_consent boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  u public.watt_usage%rowtype; e public.watt_entitlements%rowtype;
  v_room uuid; v_owner uuid; v_type text; v_cost integer; v_units integer;
  v_kind text:='unit_charge'; v_day date; v_day_count integer; v_total integer;
  v_user_count integer; v_minute integer; v_slots integer; v_left integer; g record;
  v_response_status integer; v_response_body text;
begin
  if p_request_hash is null or length(p_request_hash)<>64 then raise exception 'invalid_request_hash'; end if;
  v_cost:=case p_feature
    when 'extract-candidate-ideas' then 1 when 'extract-candidate-ideas-image' then 5
    when 'analyze-idea-draft' then 1 when 'analyze-final-ideas' then 1
    when 'generate-mvp' then 2 when 'generate-presentation' then 4
    when 'workspace-presentation' then 4
    when 'workspace-compare' then 2 when 'workspace-feedback' then 2
    when 'workspace-topics' then 1 when 'workspace-resource' then 1
    when 'workspace-outline' then 1 when 'workspace-polish' then 1
    when 'workspace-expand' then 1 when 'workspace-shorten' then 1
    when 'workspace-continue' then 1 when 'workspace-tone' then 1
    when 'workspace-dialogue' then 1 when 'workspace-rewrite' then 1
    else null end;
  if v_cost is null or p_units<>v_cost then raise exception 'invalid_feature_cost'; end if;
  if p_project_id is null then raise exception 'project_required'; end if;
  if p_project_id is not null then
    select p.roomid into v_room from public.projects p where p.id=p_project_id and
      ((p.roomid is null and p.userid=p_user_id) or (p.roomid is not null and exists
        (select 1 from public.roommembers rm where rm.roomid=p.roomid and rm.userid=p_user_id)));
    if not found then raise exception 'project_access_denied'; end if;
    if p_room_id is not null and p_room_id is distinct from v_room then raise exception 'project_room_mismatch'; end if;
    p_room_id:=v_room;
  end if;
  if p_room_id is not null then
    if not exists(select 1 from public.roommembers where roomid=p_room_id and userid=p_user_id)
      and not exists(select 1 from public.rooms where id=p_room_id and ownerid=p_user_id)
      then raise exception 'room_access_denied'; end if;
    if (select count(*) from public.roommembers where roomid=p_room_id)>5 and exists (
      select 1 from public.watt_entitlements where room_id=p_room_id and state in ('active','cancel_scheduled') and ends_at>clock_timestamp() and product_id in ('team_30','team_120','trial_team')) then raise exception 'team_limit'; end if;
    v_type:='room'; v_owner:=p_room_id;
  else v_type:='user'; v_owner:=p_user_id; end if;
  perform pg_advisory_xact_lock(hashtextextended('watt:'||v_type||':'||v_owner::text,0));
  perform public.watt_recover_usage(100);
  select * into u from public.watt_usage where request_id=p_request_id for update;
  if found then
    if u.user_id<>p_user_id or u.feature<>p_feature or u.project_id is distinct from p_project_id
      or u.room_id is distinct from p_room_id or u.request_hash is distinct from p_request_hash
      then raise exception 'request_id_conflict'; end if;
    select response_status,response_body into v_response_status,v_response_body
      from public.watt_usage_responses where usage_id=u.id;
    return jsonb_build_object('usage_id',u.id,'state',u.state,'units',u.units,
      'response_status',v_response_status,'response_body',v_response_body);
  end if;
  perform public.watt_balance(p_user_id,p_room_id);
  select * into e from public.watt_entitlements
    where state in ('active','cancel_scheduled') and ends_at>clock_timestamp()
      and ((trial and product_id in ('trial_personal','trial_team'))
        or (not trial and product_id in ('personal_30','personal_120','team_30','team_120')))
      and ((p_room_id is null and room_id is null and user_id=p_user_id)
        or (p_room_id is not null and room_id=p_room_id))
    order by started_at desc limit 1;
  -- All AI kinds, including image and presentation, consume a concurrent slot.
  select count(*) into v_minute from public.watt_usage
    where user_id=p_user_id and room_id is not distinct from p_room_id
      and state in ('reserved','succeeded','refunded') and created_at>clock_timestamp()-interval '1 minute';
  if v_minute>=3 then raise exception 'rate_limited'; end if;
  select count(*) into v_slots from public.watt_usage
    where room_id is not distinct from p_room_id and state='reserved'
      and (p_room_id is not null or user_id=p_user_id);
  if (p_room_id is null and v_slots>=1) or (p_room_id is not null and v_slots>=3)
    then raise exception 'execution_limit'; end if;
  if p_feature not in ('extract-candidate-ideas-image','generate-presentation','workspace-presentation')
    and e.id is not null then
    if not e.trial then
      select count(*) into v_minute from public.watt_usage
        where user_id=p_user_id and room_id is not distinct from p_room_id
          and feature not in ('extract-candidate-ideas-image','generate-presentation','workspace-presentation')
          and state in ('reserved','succeeded') and created_at>clock_timestamp()-interval '1 minute';
      if v_minute>=3 then raise exception 'rate_limited'; end if;
      select count(*) into v_slots from public.watt_usage
        where room_id is not distinct from p_room_id and state='reserved'
          and feature not in ('extract-candidate-ideas-image','generate-presentation','workspace-presentation')
          and (p_room_id is not null or user_id=p_user_id);
      if (p_room_id is null and v_slots>=1) or (p_room_id is not null and v_slots>=3)
        then raise exception 'execution_limit'; end if;
    end if;
    v_day:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
    select count(*) into v_day_count from public.watt_usage
      where state in ('reserved','succeeded') and units=0
        and usage_kind=case when e.trial then 'trial_free' else 'subscription_free' end
        and ((p_room_id is null and room_id is null and user_id=p_user_id)
          or (p_room_id is not null and room_id=p_room_id))
        and (created_at at time zone 'Asia/Seoul')::date=v_day;
    select count(*) into v_user_count from public.watt_usage
      where state in ('reserved','succeeded') and units=0 and user_id=p_user_id
        and usage_kind=case when e.trial then 'trial_free' else 'subscription_free' end
        and room_id is not distinct from p_room_id
        and (created_at at time zone 'Asia/Seoul')::date=v_day;
    if e.trial then
      select count(*) into v_total from public.watt_usage
        where entitlement_id=e.id and usage_kind='trial_free' and state in ('reserved','succeeded');
      if (p_room_id is null and v_total<25 and v_day_count<10)
        or (p_room_id is not null and v_total<75 and v_day_count<30) then
        v_kind:='trial_free';
      end if;
    elsif (p_room_id is null and v_day_count<40)
      or (p_room_id is not null and v_day_count<120 and v_user_count<40) then
      v_kind:='subscription_free';
    end if;
    if v_kind='unit_charge' then
      if not p_consent then return jsonb_build_object('consent_required',true,'units',v_cost,'request_id',p_request_id); end if;
      v_kind:='limit_charge';
    end if;
  end if;
  v_units:=case when v_kind in ('subscription_free','trial_free') then 0 else v_cost end;
  insert into public.watt_usage(request_id,user_id,project_id,room_id,feature,units,state,
    usage_kind,entitlement_id,request_hash,lease_expires_at)
  values(p_request_id,p_user_id,p_project_id,p_room_id,p_feature,v_units,'reserved',
    v_kind,case when v_kind in ('subscription_free','trial_free','limit_charge') then e.id else null end,
    p_request_hash,clock_timestamp()+interval '5 minutes') returning * into u;
  v_left:=v_units;
  for g in select id,remaining_units from public.watt_grants
    where owner_type=v_type and owner_id=v_owner and remaining_units>0
      and available_at<=now() and (expires_at is null or expires_at>now())
    order by case source when 'recurring' then 1 when 'trial' then 2 when 'signup' then 3 else 4 end,created_at for update
  loop
    exit when v_left=0;
    declare v_take integer:=least(g.remaining_units,v_left); begin
      update public.watt_grants set remaining_units=remaining_units-v_take where id=g.id;
      insert into public.watt_usage_allocations(usage_id,grant_id,units) values(u.id,g.id,v_take);
      v_left:=v_left-v_take;
    end;
  end loop;
  if v_left>0 then raise exception 'insufficient_units'; end if;
  return jsonb_build_object('usage_id',u.id,'state','reserved','units',v_units,'usage_kind',v_kind);
end $$;

-- Store metering in the same transaction as the result and quota settlement.
-- Provider invoices are not available here; actual_cost_usd stays NULL.
create function public.watt_settle_usage(
  p_usage_id uuid,p_success boolean,p_error_code text,
  p_response_status integer,p_response_body text,p_provider_calls jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare u public.watt_usage%rowtype; c record; r public.watt_model_rates%rowtype;
  v_input integer; v_output integer; v_provider text; v_model text; v_status integer;
begin
  if jsonb_typeof(p_provider_calls) is distinct from 'array' or jsonb_array_length(p_provider_calls)>3
    then raise exception 'invalid_provider_calls'; end if;
  select * into u from public.watt_usage where id=p_usage_id for update;
  if not found then raise exception 'usage_not_found'; end if;
  if u.state<>'reserved' then return jsonb_build_object('state',u.state); end if;
  if p_success and (p_response_status is null or p_response_body is null)
    then raise exception 'response_required'; end if;
  for c in select value,ordinality from jsonb_array_elements(p_provider_calls) with ordinality loop
    v_provider:=c.value->>'provider'; v_model:=c.value->>'model';
    v_status:=(c.value->>'status')::integer;
    v_input:=(c.value->>'input_tokens')::integer;
    v_output:=(c.value->>'output_tokens')::integer;
    if v_provider not in ('deepseek','anthropic') or length(v_model) not between 1 and 100
      or v_status not between 0 and 599 or v_input<0 or v_output<0
      then raise exception 'invalid_provider_call'; end if;
    select * into r from public.watt_model_rates
      where provider=v_provider and model=v_model and effective_at<=u.created_at
      order by effective_at desc limit 1;
    insert into public.watt_provider_calls(usage_id,attempt,provider,model,http_status,input_tokens,output_tokens,
      estimated_cost_usd,cost_basis)
    values(u.id,c.ordinality,v_provider,v_model,v_status,v_input,v_output,
      case when r.model is not null and v_input is not null and v_output is not null
        then (v_input*r.input_usd_per_million+v_output*r.output_usd_per_million)/1000000 else null end,
      case when r.model is not null and v_input is not null and v_output is not null
        then 'model_rate_at_request' else 'rate_or_token_count_unavailable' end);
  end loop;
  if not p_success then
    update public.watt_grants g set remaining_units=least(g.granted_units,g.remaining_units+a.units)
      from public.watt_usage_allocations a where a.usage_id=u.id and g.id=a.grant_id;
  end if;
  update public.watt_usage set state=case when p_success then 'succeeded' else 'refunded' end,
    error_code=left(p_error_code,100),completed_at=clock_timestamp() where id=u.id;
  if p_success then
    insert into public.watt_usage_responses(usage_id,response_status,response_body)
      values(u.id,p_response_status,p_response_body);
  end if;
  return jsonb_build_object('state',case when p_success then 'succeeded' else 'refunded' end);
end $$;
revoke all on function public.watt_settle_usage(uuid,boolean,text,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.watt_settle_usage(uuid,boolean,text,integer,text,jsonb) to service_role;

-- Reaffirm service-only invocation after the replacement definition.
revoke all on function public.watt_reserve_usage(uuid,uuid,text,uuid,uuid,integer,text,boolean),
  public.watt_settle_usage(uuid,boolean,text,integer,text),public.watt_recover_usage(integer),
  public.watt_activate(uuid,text,uuid,boolean),public.watt_start_trial(uuid,text,uuid),
  public.watt_add_topup(uuid,text,uuid,uuid),public.watt_balance(uuid,uuid),
  public.watt_preview(uuid,text,uuid),public.watt_process_renewals()
  from public,anon,authenticated;



-- Stop simulated cron renewals when the server setting is disabled.
create or replace function public.watt_process_renewals()
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare e public.watt_entitlements%rowtype; p public.watt_products%rowtype; v_next_start timestamptz; v_next_end timestamptz; v_owner uuid; v_type text; v_count integer:=0; v_cycle integer;
begin
  if not coalesce((select simulated_billing_enabled from public.watt_billing_settings where id=true),false) then return 0; end if;
  -- Expire trials and canceled/legacy entitlements without taking away their history.
  update public.watt_entitlements set state='expired',auto_renew=false
    where ends_at<=now() and state in ('active','cancel_scheduled') and (not auto_renew or trial);
  for e in select * from public.watt_entitlements
    where state='active' and auto_renew and not trial and next_renewal_at<=now()
    order by next_renewal_at for update skip locked
  loop
    select * into p from public.watt_products where id=e.product_id and active;
    if not found or p.duration_days is null then
      update public.watt_entitlements set state='expired',auto_renew=false where id=e.id;
      continue;
    end if;
    while e.next_renewal_at<=now() and e.state='active' and e.auto_renew loop
      v_next_start:=e.next_renewal_at;
      v_next_end:=v_next_start+make_interval(days=>p.duration_days);
      update public.watt_entitlements set period_number=period_number+1,ends_at=v_next_end,
        next_renewal_at=v_next_end where id=e.id returning * into e;
      insert into public.watt_renewals(entitlement_id,period_number,period_started_at,period_ends_at,simulated)
        values(e.id,e.period_number,v_next_start,v_next_end,true) on conflict(entitlement_id,period_number) do nothing;
      insert into public.watt_purchases(user_id,room_id,product_id,entitlement_id,displayed_price_krw,demo_activation,status,request_id)
        values(e.user_id,e.room_id,e.product_id,e.id,p.price_krw,true,'activated',
          md5(e.id::text||':'||e.period_number::text)::uuid) on conflict(request_id) do nothing;
      if e.room_id is null then v_type:='user'; v_owner:=e.user_id;
      else v_type:='room'; v_owner:=e.room_id; end if;
      v_cycle:=case when p.cycle_days is null then e.period_number else e.period_number*4 end;
      insert into public.watt_grants(owner_type,owner_id,entitlement_id,source,cycle_index,granted_units,remaining_units,available_at,expires_at)
        values(v_type,v_owner,e.id,'recurring',v_cycle,p.included_units,p.included_units,v_next_start,
          case when p.cycle_days is null then v_next_end else least(v_next_end,v_next_start+make_interval(days=>p.cycle_days)) end)
        on conflict(entitlement_id,cycle_index) do nothing;
      v_count:=v_count+1;
    end loop;
  end loop;
  return v_count;
end $$;

revoke all on function public.watt_process_renewals() from public,anon,authenticated;
grant execute on function public.watt_process_renewals() to service_role;


-- Preserve phase 2 billing logic while allowing operations to disable demo grants.

create or replace function public.watt_activate(p_user_id uuid, p_product_id text, p_room_id uuid default null, p_student boolean default false)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare p public.watt_products%rowtype; e public.watt_entitlements%rowtype; v_price integer; v_end timestamptz; v_owner uuid; v_type text;
begin
  if not coalesce((select simulated_billing_enabled from public.watt_billing_settings where id=true),false) then raise exception 'simulated_billing_disabled'; end if;
  if p_room_id is not null then perform 1 from public.rooms where id=p_room_id for update; end if;
  perform public.watt_process_renewals();
  update public.watt_entitlements set state='expired', auto_renew=false
    where ends_at<=now() and state in ('active','cancel_scheduled') and (not auto_renew or trial);
  if p_product_id not in ('personal_30','personal_120','team_30','team_120') then raise exception 'invalid_product'; end if;
  select * into p from public.watt_products where id=p_product_id and active for share;
  if not found or p.duration_days is null or p.price_krw<=0 then raise exception 'invalid_product'; end if;
  if (p.scope='team') <> (p_room_id is not null) then raise exception 'invalid_scope'; end if;
  if p_room_id is not null then
    if not exists(select 1 from public.rooms r where r.id=p_room_id and r.ownerid=p_user_id) then raise exception 'room_owner_required'; end if;
    if (select count(*) from public.roommembers where roomid=p_room_id)>5 then raise exception 'team_limit'; end if;
    v_owner:=p_room_id; v_type:='room';
  else v_owner:=p_user_id; v_type:='user'; end if;
  if exists(select 1 from public.watt_entitlements where ends_at>now() and ((p_room_id is null and room_id is null and user_id=p_user_id) or room_id=p_room_id)) then raise exception 'active_entitlement_exists'; end if;
  if p_student then raise exception 'student_verification_required'; end if;
  v_price:=p.price_krw;
  v_end:=now()+make_interval(days=>p.duration_days);
  insert into public.watt_entitlements(user_id,room_id,product_id,state,ends_at,student_price_applied,auto_renew,next_renewal_at,period_number)
  values(p_user_id,p_room_id,p.id,'active',v_end,(p_student and p.student_price_krw is not null),true,v_end,0) returning * into e;
  insert into public.watt_purchases(user_id,room_id,product_id,entitlement_id,displayed_price_krw,status)
  values(p_user_id,p_room_id,p.id,e.id,v_price,'activated');
  insert into public.watt_grants(owner_type,owner_id,entitlement_id,source,cycle_index,granted_units,remaining_units,available_at,expires_at)
  values(v_type,v_owner,e.id,'recurring',0,p.included_units,p.included_units,e.started_at,
    case when p.cycle_days is null then e.ends_at else least(e.ends_at,e.started_at+make_interval(days=>p.cycle_days)) end);
  return jsonb_build_object('entitlement_id',e.id,'started_at',e.started_at,'ends_at',e.ends_at,
    'next_renewal_at',e.next_renewal_at,'price_krw',v_price,'units',p.included_units,'scope',p.scope,
    'auto_renew',e.auto_renew,'simulated',true);
end $$;

create or replace function public.watt_start_trial(p_user_id uuid,p_scope text,p_room_id uuid default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_product text; v_e public.watt_entitlements%rowtype; v_owner uuid; v_type text; v_units integer;
begin
  if not coalesce((select simulated_billing_enabled from public.watt_billing_settings where id=true),false) then raise exception 'simulated_billing_disabled'; end if;
  if p_room_id is not null then perform 1 from public.rooms where id=p_room_id for update; end if;
  perform public.watt_process_renewals();
  update public.watt_entitlements set state='expired',auto_renew=false where ends_at<=now() and state in ('active','cancel_scheduled') and (not auto_renew or trial);
  if p_scope not in ('personal','team') or ((p_scope='team') <> (p_room_id is not null)) then raise exception 'invalid_scope'; end if;
  if exists(select 1 from public.watt_trials where user_id=p_user_id) then raise exception 'trial_already_used'; end if;
  if p_room_id is not null and exists(select 1 from public.watt_trials where room_id=p_room_id) then raise exception 'trial_already_used'; end if;
  if p_room_id is not null then
    if not exists(select 1 from public.rooms where id=p_room_id and ownerid=p_user_id) then raise exception 'room_owner_required'; end if;
    if (select count(*) from public.roommembers where roomid=p_room_id)>5 then raise exception 'team_limit'; end if;
    v_product:='trial_team'; v_owner:=p_room_id; v_type:='room'; v_units:=60;
  else v_product:='trial_personal'; v_owner:=p_user_id; v_type:='user'; v_units:=20; end if;
  if exists(select 1 from public.watt_entitlements where ends_at>now() and ((p_room_id is null and room_id is null and user_id=p_user_id) or room_id=p_room_id)) then raise exception 'active_entitlement_exists'; end if;
  insert into public.watt_entitlements(user_id,room_id,product_id,state,ends_at,trial,auto_renew,next_renewal_at)
  values(p_user_id,p_room_id,v_product,'active',now()+interval '7 days',true,false,null) returning * into v_e;
  insert into public.watt_trials(user_id,scope,room_id,entitlement_id,ends_at) values(p_user_id,p_scope,p_room_id,v_e.id,v_e.ends_at);
  insert into public.watt_grants(owner_type,owner_id,entitlement_id,source,cycle_index,granted_units,remaining_units,expires_at)
  values(v_type,v_owner,v_e.id,'trial',0,v_units,v_units,v_e.ends_at);
  return jsonb_build_object('entitlement_id',v_e.id,'started_at',v_e.started_at,'ends_at',v_e.ends_at,'units',v_units,'auto_renew',false);
end $$;

create or replace function public.watt_add_topup(p_user_id uuid, p_product_id text, p_room_id uuid default null, p_request_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare p public.watt_products%rowtype; v_owner uuid; v_type text;
begin
  if not coalesce((select simulated_billing_enabled from public.watt_billing_settings where id=true),false) then raise exception 'simulated_billing_disabled'; end if;
  if exists(select 1 from public.watt_purchases where request_id=p_request_id) then raise exception 'duplicate_request'; end if;
  select * into p from public.watt_products where id=p_product_id and scope='topup' and active;
  if not found then raise exception 'invalid_product'; end if;
  if p_room_id is null then v_owner:=p_user_id; v_type:='user';
  else
    if not exists(select 1 from public.rooms where id=p_room_id and ownerid=p_user_id) then raise exception 'room_owner_required'; end if;
    v_owner:=p_room_id; v_type:='room';
  end if;
  insert into public.watt_grants(owner_type, owner_id, source, granted_units, remaining_units) values(v_type,v_owner,'topup',p.included_units,p.included_units);
  insert into public.watt_purchases(user_id,room_id,product_id,displayed_price_krw,status,request_id) values(p_user_id,p_room_id,p.id,p.price_krw,'activated',p_request_id);
  return jsonb_build_object('units',p.included_units,'scope',v_type);
end $$;

create or replace function public.watt_balance(p_user_id uuid,p_room_id uuid default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_type text:=case when p_room_id is null then 'user' else 'room' end; v_owner uuid:=coalesce(p_room_id,p_user_id);
begin
  perform public.watt_process_renewals();
  -- Generate due 30-day grants within the current 120-day billing period.
  if (select simulated_billing_enabled from public.watt_billing_settings where id=true) then
  insert into public.watt_grants(owner_type,owner_id,entitlement_id,source,cycle_index,granted_units,remaining_units,available_at,expires_at)
  select v_type,v_owner,e.id,'recurring',e.period_number*4+c.i,p.included_units,p.included_units,
    e.started_at+make_interval(days=>e.period_number*p.duration_days+c.i*30),
    least(e.started_at+make_interval(days=>(e.period_number+1)*p.duration_days),e.started_at+make_interval(days=>e.period_number*p.duration_days+(c.i+1)*30))
  from public.watt_entitlements e join public.watt_products p on p.id=e.product_id
  cross join lateral generate_series(1,least(3,greatest(0,floor(extract(epoch from (now()-(e.started_at+make_interval(days=>e.period_number*p.duration_days))))/2592000)::integer))) c(i)
  where e.ends_at>now() and p.cycle_days is not null
    and ((p_room_id is null and e.room_id is null and e.user_id=p_user_id) or e.room_id=p_room_id)
  on conflict(entitlement_id,cycle_index) do nothing;
  end if;
  update public.watt_entitlements set state='expired',auto_renew=false where ends_at<=now() and state in ('active','cancel_scheduled') and (not auto_renew or trial);
  return jsonb_build_object(
    'owner_type',v_type,'owner_id',v_owner,'server_now',clock_timestamp(),
    'total',coalesce((select sum(remaining_units) from public.watt_grants where owner_type=v_type and owner_id=v_owner and available_at<=now() and (expires_at is null or expires_at>now())),0),
    'grants',coalesce((select jsonb_agg(jsonb_build_object('source',source,'remaining',remaining_units,'total',granted_units,'expires_at',expires_at) order by case source when 'recurring' then 1 when 'trial' then 2 when 'signup' then 3 else 4 end,created_at) from public.watt_grants where owner_type=v_type and owner_id=v_owner and available_at<=now() and (expires_at is null or expires_at>now()) and remaining_units>0),'[]'::jsonb),
    'entitlements',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'product_id',e.product_id,'state',case when e.ends_at<=now() then 'expired' else e.state end,
      'started_at',e.started_at,'ends_at',e.ends_at,'room_id',e.room_id,'room_name',r.name,'trial',e.trial,'auto_renew',e.auto_renew,
      'next_renewal_at',e.next_renewal_at,'period_number',e.period_number,'next_grant_at',case when p.cycle_days is null then null else case when e.ends_at<=now() then null else least(e.ends_at,e.started_at+make_interval(days=>(e.period_number*p.duration_days+least(4,greatest(1,floor(extract(epoch from (now()-(e.started_at+make_interval(days=>e.period_number*p.duration_days))))/2592000)::integer+1))*30))) end end)
      order by e.created_at desc) from public.watt_entitlements e join public.watt_products p on p.id=e.product_id left join public.rooms r on r.id=e.room_id
      where (e.room_id=p_room_id and p_room_id is not null) or (e.room_id is null and e.user_id=p_user_id)),'[]'::jsonb)
  );
end $$;

revoke all on function public.watt_activate(uuid,text,uuid,boolean),public.watt_start_trial(uuid,text,uuid),public.watt_add_topup(uuid,text,uuid,uuid),public.watt_balance(uuid,uuid) from public,anon,authenticated;
grant execute on function public.watt_activate(uuid,text,uuid,boolean),public.watt_start_trial(uuid,text,uuid),public.watt_add_topup(uuid,text,uuid,uuid),public.watt_balance(uuid,uuid) to service_role;

-- SECURITY DEFINER must use the same current-membership rule as RLS.
create or replace function public.restart_blind_evaluation(target_project_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor_id uuid:=auth.uid();
begin
  if actor_id is null or not public.watt_can_access_project(target_project_id,actor_id) then
    raise exception 'project_access_denied' using errcode='42501';
  end if;
  update public.ideas set status='approved',updatedat=now()
    where projectid=target_project_id and status='selected';
  update public.projectflows set selectedideaid=null,coachresult=null,blindanalysis=null,
    evaluationround=evaluationround+1,updatedat=now() where projectid=target_project_id;
end $$;
revoke all on function public.restart_blind_evaluation(uuid) from public,anon;
grant execute on function public.restart_blind_evaluation(uuid) to authenticated;


-- A former room owner cannot send reminders after leaving.
create or replace function public.send_anonymous_reminder(p_projectid uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_room uuid; v_owner uuid; v_round integer; v_targets uuid[];
begin
  if v_user is null then return 'forbidden'; end if;
  select roomid, userid into v_room, v_owner from public.projects where id = p_projectid;
  if not found or v_room is null or not (exists (
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
revoke all on function public.send_anonymous_reminder(uuid) from public,anon;
grant execute on function public.send_anonymous_reminder(uuid) to authenticated;
