-- Keep previous purchases, grants and usage rows; add a dated execution ledger.
alter table public.watt_usage drop constraint if exists watt_usage_units_check;
alter table public.watt_usage add constraint watt_usage_units_check check (units >= 0);
alter table public.watt_usage
  add column if not exists usage_kind text not null default 'unit_charge',
  add column if not exists entitlement_id uuid references public.watt_entitlements(id) on delete set null,
  add column if not exists request_hash text,
  add column if not exists lease_expires_at timestamptz;
alter table public.watt_usage add constraint watt_usage_kind_check
  check (usage_kind in ('unit_charge','subscription_free','trial_free','limit_charge'));
create index if not exists watt_usage_scope_day on public.watt_usage(room_id,created_at,state);
create index if not exists watt_usage_user_day on public.watt_usage(user_id,created_at,state);
create index if not exists watt_usage_expiring on public.watt_usage(lease_expires_at) where state='reserved';
create table if not exists public.watt_usage_responses (
  usage_id uuid primary key references public.watt_usage(id) on delete cascade,
  response_status integer not null,
  response_body text not null,
  created_at timestamptz not null default now()
);
alter table public.watt_usage_responses enable row level security;
revoke all on public.watt_usage_responses from public,anon,authenticated;
grant all on public.watt_usage_responses to service_role;

-- A refunded request ID remains in the ledger and can never trigger the model again.
create or replace function public.watt_recover_usage(p_limit integer default 100)
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare u public.watt_usage%rowtype; v_count integer:=0;
begin
  for u in select * from public.watt_usage
    where state='reserved' and lease_expires_at<clock_timestamp()
    order by lease_expires_at for update skip locked limit least(greatest(p_limit,1),500)
  loop
    update public.watt_grants g set remaining_units=least(g.granted_units,g.remaining_units+a.units)
      from public.watt_usage_allocations a where a.usage_id=u.id and g.id=a.grant_id;
    update public.watt_usage set state='refunded',error_code='reservation_expired',completed_at=clock_timestamp()
      where id=u.id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

-- The function name is unchanged for existing Edge Functions. Cost is checked here,
-- and the owner lock serializes quota, slot and grant reservations in one transaction.
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
  if p_project_id is not null then
    select p.roomid into v_room from public.projects p where p.id=p_project_id and
      (p.userid=p_user_id or (p.roomid is not null and exists
        (select 1 from public.roommembers rm where rm.roomid=p.roomid and rm.userid=p_user_id)));
    if not found then raise exception 'project_access_denied'; end if;
    if p_room_id is not null and p_room_id is distinct from v_room then raise exception 'project_room_mismatch'; end if;
    p_room_id:=v_room;
  end if;
  if p_room_id is not null then
    if not exists(select 1 from public.roommembers where roomid=p_room_id and userid=p_user_id)
      and not exists(select 1 from public.rooms where id=p_room_id and ownerid=p_user_id)
      then raise exception 'room_access_denied'; end if;
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

-- The response is persisted with settlement so replay never calls the provider again.
create or replace function public.watt_settle_usage(
  p_usage_id uuid,p_success boolean,p_error_code text default null,
  p_response_status integer default null,p_response_body text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare u public.watt_usage%rowtype;
begin
  select * into u from public.watt_usage where id=p_usage_id for update;
  if not found then raise exception 'usage_not_found'; end if;
  if u.state<>'reserved' then return jsonb_build_object('state',u.state); end if;
  if not p_success then
    update public.watt_grants g set remaining_units=least(g.granted_units,g.remaining_units+a.units)
      from public.watt_usage_allocations a where a.usage_id=u.id and g.id=a.grant_id;
  end if;
  update public.watt_usage set state=case when p_success then 'succeeded' else 'refunded' end,
    error_code=left(p_error_code,100),completed_at=clock_timestamp()
    where id=u.id;
  if p_success then
    if p_response_status is null or p_response_body is null then raise exception 'response_required'; end if;
    insert into public.watt_usage_responses(usage_id,response_status,response_body)
      values(u.id,p_response_status,p_response_body);
  end if;
  return jsonb_build_object('state',case when p_success then 'succeeded' else 'refunded' end);
end $$;

-- Existing RPC signatures remain callable only by the service role; new overloads too.
revoke all on function public.watt_reserve_usage(uuid,uuid,text,uuid,uuid,integer,text,boolean),
  public.watt_settle_usage(uuid,boolean,text,integer,text),public.watt_recover_usage(integer)
  from public,anon,authenticated;
grant execute on function public.watt_reserve_usage(uuid,uuid,text,uuid,uuid,integer,text,boolean),
  public.watt_settle_usage(uuid,boolean,text,integer,text),public.watt_recover_usage(integer) to service_role;
-- Remove unsafe old overloads; defaults on the replacement preserve ordinary calls.
drop function if exists public.watt_reserve_usage(uuid,uuid,text,uuid,uuid,integer);
drop function if exists public.watt_settle_usage(uuid,boolean,text);

create unique index if not exists watt_one_trial_per_room on public.watt_trials(room_id) where room_id is not null;

do $$
begin
  if exists(select 1 from cron.job where jobname='watt-usage-recovery') then
    perform cron.unschedule('watt-usage-recovery');
  end if;
  perform cron.schedule('watt-usage-recovery','* * * * *','select public.watt_recover_usage();');
end $$;

-- Correct paid activation, trial entry and renewal-aware balance without altering old migrations.
create or replace function public.watt_activate(p_user_id uuid, p_product_id text, p_room_id uuid default null, p_student boolean default false)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare p public.watt_products%rowtype; e public.watt_entitlements%rowtype; v_price integer; v_end timestamptz; v_owner uuid; v_type text;
begin
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

create or replace function public.watt_preview(p_user_id uuid,p_product_id text,p_room_id uuid default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare p public.watt_products%rowtype; v_now timestamptz:=clock_timestamp(); v_start timestamptz; v_end timestamptz;
begin
  select * into p from public.watt_products where id=p_product_id and active and id in ('personal_30','personal_120','team_30','team_120');
  if not found then raise exception 'invalid_product'; end if;
  if (p.scope='team') <> (p_room_id is not null) then raise exception 'invalid_scope'; end if;
  if p_room_id is not null and not exists(select 1 from public.rooms where id=p_room_id and ownerid=p_user_id) then raise exception 'room_owner_required'; end if;
  v_start:=v_now; v_end:=v_start+make_interval(days=>p.duration_days);
  return jsonb_build_object('server_now',v_now,'starts_at',v_start,'ends_at',v_end,
    'next_renewal_at',v_end,'next_grant_at',case when p.cycle_days is null then null else v_start+make_interval(days=>p.cycle_days) end,
    'duration_days',p.duration_days,'included_units',p.included_units,'cycle_days',p.cycle_days,
    'price_krw',p.price_krw,'student_price_krw',p.student_price_krw,'auto_renew',true,'simulated',true);
end $$;

create or replace function public.watt_balance(p_user_id uuid,p_room_id uuid default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_type text:=case when p_room_id is null then 'user' else 'room' end; v_owner uuid:=coalesce(p_room_id,p_user_id);
begin
  perform public.watt_process_renewals();
  -- Generate due 30-day grants within the current 120-day billing period.
  insert into public.watt_grants(owner_type,owner_id,entitlement_id,source,cycle_index,granted_units,remaining_units,available_at,expires_at)
  select v_type,v_owner,e.id,'recurring',e.period_number*4+c.i,p.included_units,p.included_units,
    e.started_at+make_interval(days=>e.period_number*p.duration_days+c.i*30),
    least(e.started_at+make_interval(days=>(e.period_number+1)*p.duration_days),e.started_at+make_interval(days=>e.period_number*p.duration_days+(c.i+1)*30))
  from public.watt_entitlements e join public.watt_products p on p.id=e.product_id
  cross join lateral generate_series(1,least(3,greatest(0,floor(extract(epoch from (now()-(e.started_at+make_interval(days=>e.period_number*p.duration_days))))/2592000)::integer))) c(i)
  where e.ends_at>now() and p.cycle_days is not null
    and ((p_room_id is null and e.room_id is null and e.user_id=p_user_id) or e.room_id=p_room_id)
  on conflict(entitlement_id,cycle_index) do nothing;
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

-- A delayed renewal must not wait behind a fixed batch before scope lookup.
create or replace function public.watt_process_renewals()
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare e public.watt_entitlements%rowtype; p public.watt_products%rowtype; v_next_start timestamptz; v_next_end timestamptz; v_owner uuid; v_type text; v_count integer:=0; v_cycle integer;
begin
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
