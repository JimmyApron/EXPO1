-- Watt subscription and AI usage foundation. Existing user content is not changed.
create table if not exists public.watt_products (
  id text primary key,
  scope text not null check (scope in ('personal', 'team', 'topup')),
  label text not null,
  price_krw integer not null check (price_krw >= 0),
  student_price_krw integer,
  duration_days integer,
  included_units integer not null check (included_units >= 0),
  cycle_days integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.watt_products (id, scope, label, price_krw, student_price_krw, duration_days, included_units, cycle_days) values
  ('personal_30', 'personal', '개인 30일권', 5900, 4900, 30, 100, null),
  ('personal_120', 'personal', '개인 120일권', 19900, 17900, 120, 100, 30),
  ('team_30', 'team', '팀 30일권', 16900, 14900, 30, 300, null),
  ('team_120', 'team', '팀 120일권', 59900, 49900, 120, 300, 30),
  ('trial_personal', 'personal', '개인 무료체험', 0, null, 7, 20, null),
  ('trial_team', 'team', '팀 무료체험', 0, null, 7, 60, null),
  ('topup_s', 'topup', 'AI 추가 S', 1900, null, null, 10, null),
  ('topup_m', 'topup', 'AI 추가 M', 3900, null, null, 30, null)
on conflict (id) do update set scope = excluded.scope, label = excluded.label, price_krw = excluded.price_krw,
  student_price_krw = excluded.student_price_krw, duration_days = excluded.duration_days,
  included_units = excluded.included_units, cycle_days = excluded.cycle_days;

create table if not exists public.watt_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete cascade,
  product_id text not null references public.watt_products(id),
  state text not null check (state in ('active', 'cancel_scheduled', 'expired')),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  cancel_requested_at timestamptz,
  student_price_applied boolean not null default false,
  trial boolean not null default false,
  created_at timestamptz not null default now(),
  check ((room_id is null) = (product_id like 'personal_%' or product_id like 'trial_personal%'))
);
create unique index if not exists watt_one_live_personal_entitlement
  on public.watt_entitlements(user_id) where room_id is null and state in ('active','cancel_scheduled');
create unique index if not exists watt_one_live_room_entitlement
  on public.watt_entitlements(room_id) where room_id is not null and state in ('active','cancel_scheduled');
create index if not exists watt_entitlements_user_end on public.watt_entitlements(user_id, ends_at desc);

create table if not exists public.watt_grants (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('user', 'room')),
  owner_id uuid not null,
  entitlement_id uuid references public.watt_entitlements(id) on delete set null,
  source text not null check (source in ('signup', 'recurring', 'trial', 'topup')),
  cycle_index integer,
  granted_units integer not null check (granted_units >= 0),
  remaining_units integer not null check (remaining_units >= 0 and remaining_units <= granted_units),
  available_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (entitlement_id, cycle_index)
);
create index if not exists watt_grants_owner_available on public.watt_grants(owner_type, owner_id, available_at, expires_at);

create table if not exists public.watt_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  product_id text not null references public.watt_products(id),
  entitlement_id uuid references public.watt_entitlements(id) on delete set null,
  displayed_price_krw integer not null,
  demo_activation boolean not null default true,
  status text not null check (status in ('activated', 'rejected')),
  request_id uuid unique,
  created_at timestamptz not null default now()
);
create index if not exists watt_purchases_user_created on public.watt_purchases(user_id, created_at desc);

create table if not exists public.watt_trials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('personal', 'team')),
  room_id uuid references public.rooms(id) on delete cascade,
  entitlement_id uuid references public.watt_entitlements(id) on delete set null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  unique(user_id)
);

create table if not exists public.watt_usage (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  feature text not null,
  units integer not null check (units > 0),
  state text not null check (state in ('reserved', 'succeeded', 'refunded')),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists watt_usage_user_created on public.watt_usage(user_id, created_at desc);
create table if not exists public.watt_usage_allocations (
  usage_id uuid not null references public.watt_usage(id) on delete cascade,
  grant_id uuid not null references public.watt_grants(id) on delete restrict,
  units integer not null check (units > 0),
  primary key (usage_id, grant_id)
);

create or replace function public.watt_seed_signup_units()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  insert into public.watt_grants(owner_type, owner_id, source, granted_units, remaining_units)
  values ('user', new.id, 'signup', 12, 12) on conflict do nothing;
  return new;
end $$;
drop trigger if exists watt_seed_signup_units_trigger on auth.users;
create trigger watt_seed_signup_units_trigger after insert on auth.users
for each row execute function public.watt_seed_signup_units();
-- Existing accounts get the same one-time baseline without overwriting usage.
insert into public.watt_grants(owner_type, owner_id, source, granted_units, remaining_units)
select 'user', u.id, 'signup', 12, 12 from auth.users u
where not exists (select 1 from public.watt_grants g where g.owner_type = 'user' and g.owner_id = u.id and g.source = 'signup');

create or replace function public.watt_activate(p_user_id uuid, p_product_id text, p_room_id uuid default null, p_student boolean default false)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare p public.watt_products%rowtype; e public.watt_entitlements%rowtype; v_price integer; v_end timestamptz; v_owner uuid; v_type text;
begin
  update public.watt_entitlements set state='expired' where ends_at<=now() and state in ('active','cancel_scheduled');
  select * into p from public.watt_products where id = p_product_id and active for share;
  if not found or p.scope = 'topup' then raise exception 'invalid_product'; end if;
  if (p.scope = 'team') <> (p_room_id is not null) then raise exception 'invalid_scope'; end if;
  if p_room_id is not null then
    if not exists(select 1 from public.rooms r where r.id = p_room_id and r.ownerid = p_user_id) then raise exception 'room_owner_required'; end if;
    if (select count(*) from public.roommembers where roomid=p_room_id) > 5 then raise exception 'team_limit'; end if;
    v_owner := p_room_id; v_type := 'room';
  else v_owner := p_user_id; v_type := 'user'; end if;
  if exists(select 1 from public.watt_entitlements where ends_at > now() and ((p_room_id is null and room_id is null and user_id = p_user_id) or room_id = p_room_id)) then raise exception 'active_entitlement_exists'; end if;
  v_price := case when p_student and p.student_price_krw is not null then p.student_price_krw else p.price_krw end;
  v_end := now() + make_interval(days => p.duration_days);
  insert into public.watt_entitlements(user_id, room_id, product_id, state, ends_at, student_price_applied)
  values (p_user_id, p_room_id, p.id, 'active', v_end, (p_student and p.student_price_krw is not null)) returning * into e;
  insert into public.watt_purchases(user_id, room_id, product_id, entitlement_id, displayed_price_krw, status)
  values (p_user_id, p_room_id, p.id, e.id, v_price, 'activated');
  insert into public.watt_grants(owner_type, owner_id, entitlement_id, source, cycle_index, granted_units, remaining_units, available_at, expires_at)
  values (v_type, v_owner, e.id, 'recurring', 0, p.included_units, p.included_units, e.started_at,
    case when p.cycle_days is null then e.ends_at else least(e.ends_at, e.started_at + make_interval(days => p.cycle_days)) end);
  return jsonb_build_object('entitlement_id', e.id, 'ends_at', e.ends_at, 'price_krw', v_price, 'units', p.included_units, 'scope', p.scope);
end $$;

create or replace function public.watt_start_trial(p_user_id uuid, p_scope text, p_room_id uuid default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_product text; v_e public.watt_entitlements%rowtype; v_owner uuid; v_type text; v_units integer;
begin
  update public.watt_entitlements set state='expired' where ends_at<=now() and state in ('active','cancel_scheduled');
  if p_scope not in ('personal','team') or ((p_scope = 'team') <> (p_room_id is not null)) then raise exception 'invalid_scope'; end if;
  if exists(select 1 from public.watt_trials where user_id = p_user_id) then raise exception 'trial_already_used'; end if;
  if p_room_id is not null then
    if not exists(select 1 from public.rooms where id = p_room_id and ownerid = p_user_id) then raise exception 'room_owner_required'; end if;
    if (select count(*) from public.roommembers where roomid=p_room_id) > 5 then raise exception 'team_limit'; end if;
    v_product := 'trial_team'; v_owner := p_room_id; v_type := 'room'; v_units := 60;
  else v_product := 'trial_personal'; v_owner := p_user_id; v_type := 'user'; v_units := 20; end if;
  if exists(select 1 from public.watt_entitlements where ends_at > now() and ((p_room_id is null and room_id is null and user_id = p_user_id) or room_id = p_room_id)) then raise exception 'active_entitlement_exists'; end if;
  insert into public.watt_entitlements(user_id, room_id, product_id, state, ends_at, trial)
  values(p_user_id, p_room_id, v_product, 'active', now() + interval '7 days', true) returning * into v_e;
  insert into public.watt_trials(user_id, scope, room_id, entitlement_id, ends_at) values(p_user_id, p_scope, p_room_id, v_e.id, v_e.ends_at);
  insert into public.watt_grants(owner_type, owner_id, entitlement_id, source, cycle_index, granted_units, remaining_units, expires_at)
  values(v_type, v_owner, v_e.id, 'trial', 0, v_units, v_units, v_e.ends_at);
  return jsonb_build_object('entitlement_id', v_e.id, 'ends_at', v_e.ends_at, 'units', v_units);
end $$;

create or replace function public.watt_cancel(p_user_id uuid, p_entitlement_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare e public.watt_entitlements%rowtype;
begin
  select * into e from public.watt_entitlements where id = p_entitlement_id for update;
  if not found then raise exception 'entitlement_not_found'; end if;
  if e.room_id is null then
    if e.user_id <> p_user_id then raise exception 'forbidden'; end if;
  elsif not exists(select 1 from public.rooms where id = e.room_id and ownerid = p_user_id) then raise exception 'forbidden'; end if;
  if e.ends_at <= now() then update public.watt_entitlements set state='expired' where id=e.id; raise exception 'entitlement_expired'; end if;
  update public.watt_entitlements set state='cancel_scheduled', cancel_requested_at=coalesce(cancel_requested_at, now()) where id=e.id returning * into e;
  return jsonb_build_object('state', e.state, 'ends_at', e.ends_at, 'cancel_requested_at', e.cancel_requested_at);
end $$;

create or replace function public.watt_add_topup(p_user_id uuid, p_product_id text, p_room_id uuid default null, p_request_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare p public.watt_products%rowtype; v_owner uuid; v_type text;
begin
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

create or replace function public.watt_balance(p_user_id uuid, p_room_id uuid default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_type text := case when p_room_id is null then 'user' else 'room' end; v_owner uuid := coalesce(p_room_id,p_user_id);
begin
  -- Each 120-day entitlement receives a fresh non-carrying grant at each 30-day boundary.
  insert into public.watt_grants(owner_type,owner_id,entitlement_id,source,cycle_index,granted_units,remaining_units,available_at,expires_at)
  select v_type,v_owner,e.id,'recurring',c.i,p.included_units,p.included_units,
    e.started_at + make_interval(days => c.i*30),least(e.ends_at,e.started_at + make_interval(days => (c.i+1)*30))
  from public.watt_entitlements e join public.watt_products p on p.id=e.product_id
  cross join lateral generate_series(0, greatest(0, floor(extract(epoch from (now()-e.started_at))/2592000)::integer)) c(i)
  where e.ends_at > now() and p.cycle_days is not null
    and ((p_room_id is null and e.room_id is null and e.user_id=p_user_id) or e.room_id=p_room_id)
  on conflict(entitlement_id,cycle_index) do nothing;
  update public.watt_entitlements set state='expired' where ends_at <= now() and state in ('active','cancel_scheduled');
  return jsonb_build_object(
    'owner_type',v_type,'owner_id',v_owner,
    'total',coalesce((select sum(remaining_units) from public.watt_grants where owner_type=v_type and owner_id=v_owner and available_at<=now() and (expires_at is null or expires_at>now())),0),
    'grants',coalesce((select jsonb_agg(jsonb_build_object('source',source,'remaining',remaining_units,'total',granted_units,'expires_at',expires_at) order by case source when 'recurring' then 1 when 'trial' then 2 when 'signup' then 3 else 4 end,created_at) from public.watt_grants where owner_type=v_type and owner_id=v_owner and available_at<=now() and (expires_at is null or expires_at>now()) and remaining_units>0),'[]'::jsonb),
    'entitlements',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'product_id',e.product_id,'state',case when e.ends_at<=now() then 'expired' else e.state end,'started_at',e.started_at,'ends_at',e.ends_at,'room_id',e.room_id,'room_name',r.name,'trial',e.trial)) from public.watt_entitlements e left join public.rooms r on r.id=e.room_id where (e.room_id=p_room_id and p_room_id is not null) or (e.room_id is null and e.user_id=p_user_id)),'[]'::jsonb)
  );
end $$;

create or replace function public.watt_reserve_usage(p_user_id uuid,p_request_id uuid,p_feature text,p_project_id uuid,p_room_id uuid,p_units integer)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_usage public.watt_usage%rowtype; v_type text; v_owner uuid; v_left integer; g record; v_room uuid; v_recent integer;
begin
  if p_units<=0 or p_units>20 then raise exception 'invalid_units'; end if;
  if p_project_id is not null then
    select p.roomid into v_room from public.projects p where p.id=p_project_id and
      (p.userid=p_user_id or (p.roomid is not null and exists(select 1 from public.roommembers rm where rm.roomid=p.roomid and rm.userid=p_user_id)));
    if not found then raise exception 'project_access_denied'; end if;
    if p_room_id is not null and v_room is distinct from p_room_id then raise exception 'project_room_mismatch'; end if;
    p_room_id:=v_room;
  end if;
  if p_room_id is not null then
    if not exists(select 1 from public.roommembers where roomid=p_room_id and userid=p_user_id) then raise exception 'room_access_denied'; end if;
    v_type:='room';v_owner:=p_room_id;
  else v_type:='user';v_owner:=p_user_id;
  end if;
  perform public.watt_balance(p_user_id,p_room_id);
  select count(*) into v_recent from public.watt_usage where user_id=p_user_id and created_at > now()-interval '10 seconds';
  if v_recent >= 8 then raise exception 'rate_limited'; end if;
  insert into public.watt_usage(request_id,user_id,project_id,room_id,feature,units,state)
  values(p_request_id,p_user_id,p_project_id,p_room_id,p_feature,p_units,'reserved')
  on conflict(request_id) do nothing returning * into v_usage;
  if not found then raise exception 'duplicate_request'; end if;
  v_left:=p_units;
  for g in select id,remaining_units from public.watt_grants where owner_type=v_type and owner_id=v_owner and remaining_units>0 and available_at<=now() and (expires_at is null or expires_at>now())
      order by case source when 'recurring' then 1 when 'trial' then 2 when 'signup' then 3 else 4 end, created_at for update
  loop
    exit when v_left=0;
    declare v_take integer := least(g.remaining_units,v_left); begin
      update public.watt_grants set remaining_units=remaining_units-v_take where id=g.id;
      insert into public.watt_usage_allocations(usage_id,grant_id,units) values(v_usage.id,g.id,v_take);
      v_left:=v_left-v_take;
    end;
  end loop;
  if v_left>0 then
    delete from public.watt_usage where id=v_usage.id;
    raise exception 'insufficient_units' using detail=jsonb_build_object('required',p_units,'available',p_units-v_left)::text;
  end if;
  return jsonb_build_object('usage_id',v_usage.id,'reserved',p_units);
end $$;

create or replace function public.watt_settle_usage(p_usage_id uuid,p_success boolean,p_error_code text default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare u public.watt_usage%rowtype;
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

alter table public.watt_products enable row level security;
alter table public.watt_entitlements enable row level security;
alter table public.watt_grants enable row level security;
alter table public.watt_purchases enable row level security;
alter table public.watt_trials enable row level security;
alter table public.watt_usage enable row level security;
alter table public.watt_usage_allocations enable row level security;
drop policy if exists watt_products_read on public.watt_products;
create policy watt_products_read on public.watt_products for select to authenticated using (active);
drop policy if exists watt_entitlements_read on public.watt_entitlements;
create policy watt_entitlements_read on public.watt_entitlements for select to authenticated using (user_id=auth.uid() or (room_id is not null and exists(select 1 from public.roommembers rm where rm.roomid=room_id and rm.userid=auth.uid())));
drop policy if exists watt_grants_read on public.watt_grants;
create policy watt_grants_read on public.watt_grants for select to authenticated using ((owner_type='user' and owner_id=auth.uid()) or (owner_type='room' and exists(select 1 from public.roommembers rm where rm.roomid=owner_id and rm.userid=auth.uid())));
drop policy if exists watt_purchases_read on public.watt_purchases;
create policy watt_purchases_read on public.watt_purchases for select to authenticated using (user_id=auth.uid() or (room_id is not null and exists(select 1 from public.rooms r where r.id=room_id and r.ownerid=auth.uid())));
drop policy if exists watt_trials_read on public.watt_trials;
create policy watt_trials_read on public.watt_trials for select to authenticated using (user_id=auth.uid());
drop policy if exists watt_usage_read on public.watt_usage;
create policy watt_usage_read on public.watt_usage for select to authenticated using (user_id=auth.uid() or (room_id is not null and exists(select 1 from public.roommembers rm where rm.roomid=room_id and rm.userid=auth.uid())));
revoke all on public.watt_products,public.watt_entitlements,public.watt_grants,public.watt_purchases,public.watt_trials,public.watt_usage,public.watt_usage_allocations from anon,authenticated;
grant all on public.watt_products,public.watt_entitlements,public.watt_grants,public.watt_purchases,public.watt_trials,public.watt_usage,public.watt_usage_allocations to service_role;
grant select on public.watt_products,public.watt_entitlements,public.watt_grants,public.watt_purchases,public.watt_trials,public.watt_usage to authenticated;
grant select on public.watt_products to anon;
revoke all on function public.watt_activate(uuid,text,uuid,boolean), public.watt_start_trial(uuid,text,uuid), public.watt_cancel(uuid,uuid), public.watt_add_topup(uuid,text,uuid,uuid), public.watt_balance(uuid,uuid), public.watt_reserve_usage(uuid,uuid,text,uuid,uuid,integer), public.watt_settle_usage(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.watt_activate(uuid,text,uuid,boolean), public.watt_start_trial(uuid,text,uuid), public.watt_cancel(uuid,uuid), public.watt_add_topup(uuid,text,uuid,uuid), public.watt_balance(uuid,uuid), public.watt_reserve_usage(uuid,uuid,text,uuid,uuid,integer), public.watt_settle_usage(uuid,boolean,text) to service_role;
