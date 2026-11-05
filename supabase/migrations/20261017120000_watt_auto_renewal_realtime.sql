-- Automatic renewal is simulation-only. Existing entitlements remain opted out;
-- new paid activations explicitly opt in through watt_activate.
alter table public.watt_entitlements
  add column if not exists auto_renew boolean not null default false,
  add column if not exists next_renewal_at timestamptz,
  add column if not exists period_number integer not null default 0;

create table if not exists public.watt_renewals (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.watt_entitlements(id) on delete cascade,
  period_number integer not null check (period_number > 0),
  period_started_at timestamptz not null,
  period_ends_at timestamptz not null,
  simulated boolean not null default true,
  created_at timestamptz not null default now(),
  unique (entitlement_id, period_number)
);
create index if not exists watt_renewals_entitlement_created
  on public.watt_renewals(entitlement_id, created_at desc);
alter table public.watt_renewals enable row level security;
revoke all on public.watt_renewals from anon, authenticated;
grant all on public.watt_renewals to service_role;

create or replace function public.watt_activate(p_user_id uuid, p_product_id text, p_room_id uuid default null, p_student boolean default false)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare p public.watt_products%rowtype; e public.watt_entitlements%rowtype; v_price integer; v_end timestamptz; v_owner uuid; v_type text;
begin
  update public.watt_entitlements set state='expired', auto_renew=false
    where ends_at<=now() and state in ('active','cancel_scheduled');
  select * into p from public.watt_products where id=p_product_id and active for share;
  if not found or p.scope='topup' or p.duration_days is null then raise exception 'invalid_product'; end if;
  if (p.scope='team') <> (p_room_id is not null) then raise exception 'invalid_scope'; end if;
  if p_room_id is not null then
    if not exists(select 1 from public.rooms r where r.id=p_room_id and r.ownerid=p_user_id) then raise exception 'room_owner_required'; end if;
    if (select count(*) from public.roommembers where roomid=p_room_id)>5 then raise exception 'team_limit'; end if;
    v_owner:=p_room_id; v_type:='room';
  else v_owner:=p_user_id; v_type:='user'; end if;
  if exists(select 1 from public.watt_entitlements where ends_at>now() and ((p_room_id is null and room_id is null and user_id=p_user_id) or room_id=p_room_id)) then raise exception 'active_entitlement_exists'; end if;
  v_price:=case when p_student and p.student_price_krw is not null then p.student_price_krw else p.price_krw end;
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
  update public.watt_entitlements set state='expired',auto_renew=false where ends_at<=now() and state in ('active','cancel_scheduled');
  if p_scope not in ('personal','team') or ((p_scope='team') <> (p_room_id is not null)) then raise exception 'invalid_scope'; end if;
  if exists(select 1 from public.watt_trials where user_id=p_user_id) then raise exception 'trial_already_used'; end if;
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

create or replace function public.watt_cancel(p_user_id uuid,p_entitlement_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare e public.watt_entitlements%rowtype;
begin
  select * into e from public.watt_entitlements where id=p_entitlement_id for update;
  if not found then raise exception 'entitlement_not_found'; end if;
  if e.room_id is null then
    if e.user_id<>p_user_id then raise exception 'forbidden'; end if;
  elsif not exists(select 1 from public.rooms where id=e.room_id and ownerid=p_user_id) then raise exception 'forbidden'; end if;
  if e.ends_at<=now() then update public.watt_entitlements set state='expired',auto_renew=false where id=e.id; raise exception 'entitlement_expired'; end if;
  if e.trial then raise exception 'trial_not_cancellable'; end if;
  update public.watt_entitlements set state='cancel_scheduled',auto_renew=false,cancel_requested_at=coalesce(cancel_requested_at,now()) where id=e.id returning * into e;
  return jsonb_build_object('state',e.state,'auto_renew',e.auto_renew,'ends_at',e.ends_at,'cancel_requested_at',e.cancel_requested_at);
end $$;

create or replace function public.watt_resume(p_user_id uuid,p_entitlement_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare e public.watt_entitlements%rowtype;
begin
  select * into e from public.watt_entitlements where id=p_entitlement_id for update;
  if not found then raise exception 'entitlement_not_found'; end if;
  if e.room_id is null then
    if e.user_id<>p_user_id then raise exception 'forbidden'; end if;
  elsif not exists(select 1 from public.rooms where id=e.room_id and ownerid=p_user_id) then raise exception 'forbidden'; end if;
  if e.ends_at<=now() or e.state='expired' then raise exception 'entitlement_expired'; end if;
  if e.trial then raise exception 'trial_not_cancellable'; end if;
  update public.watt_entitlements set state='active',auto_renew=true,cancel_requested_at=null,
    next_renewal_at=ends_at where id=e.id returning * into e;
  return jsonb_build_object('state',e.state,'auto_renew',e.auto_renew,'ends_at',e.ends_at,'next_renewal_at',e.next_renewal_at);
end $$;

create or replace function public.watt_preview(p_user_id uuid,p_product_id text,p_room_id uuid default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare p public.watt_products%rowtype; v_now timestamptz:=clock_timestamp(); v_start timestamptz; v_end timestamptz;
begin
  select * into p from public.watt_products where id=p_product_id and active and scope<>'topup';
  if not found then raise exception 'invalid_product'; end if;
  if (p.scope='team') <> (p_room_id is not null) then raise exception 'invalid_scope'; end if;
  if p_room_id is not null and not exists(select 1 from public.rooms where id=p_room_id and ownerid=p_user_id) then raise exception 'room_owner_required'; end if;
  v_start:=v_now; v_end:=v_start+make_interval(days=>p.duration_days);
  return jsonb_build_object('server_now',v_now,'starts_at',v_start,'ends_at',v_end,
    'next_renewal_at',v_end,'next_grant_at',case when p.cycle_days is null then null else v_start+make_interval(days=>p.cycle_days) end,
    'duration_days',p.duration_days,'included_units',p.included_units,'cycle_days',p.cycle_days,
    'price_krw',p.price_krw,'student_price_krw',p.student_price_krw,'auto_renew',true,'simulated',true);
end $$;

create or replace function public.watt_process_renewals()
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare e public.watt_entitlements%rowtype; p public.watt_products%rowtype; v_next_start timestamptz; v_next_end timestamptz; v_owner uuid; v_type text; v_count integer:=0; v_cycle integer;
begin
  -- Expire trials and canceled/legacy entitlements without taking away their history.
  update public.watt_entitlements set state='expired',auto_renew=false
    where ends_at<=now() and state in ('active','cancel_scheduled') and (not auto_renew or trial);
  for e in select * from public.watt_entitlements
    where state='active' and auto_renew and not trial and next_renewal_at<=now()
    order by next_renewal_at for update skip locked limit 100
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
  update public.watt_entitlements set state='expired',auto_renew=false where ends_at<=now() and state in ('active','cancel_scheduled');
  return jsonb_build_object(
    'owner_type',v_type,'owner_id',v_owner,'server_now',clock_timestamp(),
    'total',coalesce((select sum(remaining_units) from public.watt_grants where owner_type=v_type and owner_id=v_owner and available_at<=now() and (expires_at is null or expires_at>now())),0),
    'grants',coalesce((select jsonb_agg(jsonb_build_object('source',source,'remaining',remaining_units,'total',granted_units,'expires_at',expires_at) order by case source when 'recurring' then 1 when 'trial' then 2 when 'signup' then 3 else 4 end,created_at) from public.watt_grants where owner_type=v_type and owner_id=v_owner and available_at<=now() and (expires_at is null or expires_at>now()) and remaining_units>0),'[]'::jsonb),
    'entitlements',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'product_id',e.product_id,'state',case when e.ends_at<=now() then 'expired' else e.state end,
      'started_at',e.started_at,'ends_at',e.ends_at,'room_id',e.room_id,'room_name',r.name,'trial',e.trial,'auto_renew',e.auto_renew,
      'next_renewal_at',e.next_renewal_at,'period_number',e.period_number,'next_grant_at',case when p.cycle_days is null then null else e.started_at+make_interval(days=>(e.period_number*p.duration_days+30)) end)
      order by e.created_at desc) from public.watt_entitlements e join public.watt_products p on p.id=e.product_id left join public.rooms r on r.id=e.room_id
      where (e.room_id=p_room_id and p_room_id is not null) or (e.room_id is null and e.user_id=p_user_id)),'[]'::jsonb)
  );
end $$;

create or replace function public.watt_settle_usage(p_usage_id uuid,p_success boolean,p_error_code text default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare u public.watt_usage%rowtype; v_result jsonb;
begin
  select * into u from public.watt_usage where id=p_usage_id for update;
  if not found then raise exception 'usage_not_found'; end if;
  if u.state<>'reserved' then return jsonb_build_object('state',u.state); end if;
  if not p_success then
    update public.watt_grants g set remaining_units=least(g.granted_units,g.remaining_units+a.units)
      from public.watt_usage_allocations a where a.usage_id=u.id and g.id=a.grant_id;
  end if;
  update public.watt_usage set state=case when p_success then 'succeeded' else 'refunded' end,error_code=left(p_error_code,100),completed_at=now() where id=u.id;
  return jsonb_build_object('state',case when p_success then 'succeeded' else 'refunded' end);
end $$;

revoke all on function public.watt_resume(uuid,uuid),public.watt_preview(uuid,text,uuid),public.watt_process_renewals() from public,anon,authenticated;
grant execute on function public.watt_resume(uuid,uuid),public.watt_preview(uuid,text,uuid),public.watt_process_renewals() to service_role;
revoke all on function public.watt_activate(uuid,text,uuid,boolean),public.watt_start_trial(uuid,text,uuid),public.watt_cancel(uuid,uuid),public.watt_balance(uuid,uuid) from public,anon,authenticated;
grant execute on function public.watt_activate(uuid,text,uuid,boolean),public.watt_start_trial(uuid,text,uuid),public.watt_cancel(uuid,uuid),public.watt_balance(uuid,uuid) to service_role;

do $$
declare t text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['watt_entitlements','watt_grants','watt_purchases','watt_trials','watt_usage'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;

-- Supabase-managed Postgres supports pg_cron. Retry within one minute after a
-- transient failure; row locks and unique period keys keep the operation idempotent.
create extension if not exists pg_cron with schema pg_catalog;
do $$
begin
  if exists(select 1 from cron.job where jobname='watt-subscription-renewals') then
    perform cron.unschedule('watt-subscription-renewals');
  end if;
  perform cron.schedule('watt-subscription-renewals','* * * * *','select public.watt_process_renewals();');
end $$;
