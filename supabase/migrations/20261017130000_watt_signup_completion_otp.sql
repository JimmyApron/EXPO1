-- Delay Watt's one-time signup grant until a verified user has set a password
-- and the app has created its profile.
create table if not exists public.watt_signup_password_intents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null default 'infinity'::timestamptz
);

create table if not exists public.watt_signup_completions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now()
);

alter table public.watt_signup_password_intents enable row level security;
alter table public.watt_signup_completions enable row level security;
revoke all on public.watt_signup_password_intents, public.watt_signup_completions from public, anon, authenticated;
grant all on public.watt_signup_password_intents, public.watt_signup_completions to service_role;

drop trigger if exists watt_seed_signup_units_trigger on auth.users;

create or replace function public.watt_signup_can_set_password()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_encrypted_password text;
  v_confirmed_at timestamptz;
begin
  if v_user_id is null then raise exception 'authenticated_user_required'; end if;
  select encrypted_password, email_confirmed_at
    into v_encrypted_password, v_confirmed_at
    from auth.users where id = v_user_id;
  if not found or v_confirmed_at is null then raise exception 'email_verification_required'; end if;
  if exists(select 1 from public.watt_signup_completions where user_id = v_user_id) then
    raise exception 'signup_already_completed';
  end if;
  if coalesce(v_encrypted_password, '') <> '' and not exists (
    select 1 from public.watt_signup_password_intents
    where user_id = v_user_id and expires_at > now()
  ) then
    raise exception 'account_already_has_password';
  end if;
  if (
    exists(select 1 from public.watt_grants where owner_type = 'user' and owner_id = v_user_id and source = 'signup')
    or exists(select 1 from public.profiles where id = v_user_id)
  ) and not exists (
    select 1 from public.watt_signup_password_intents
    where user_id = v_user_id and expires_at > now()
  ) then
    raise exception 'account_already_registered';
  end if;
  insert into public.watt_signup_password_intents(user_id, expires_at)
  values (v_user_id, 'infinity'::timestamptz)
  on conflict (user_id) do update set expires_at = 'infinity'::timestamptz
  where public.watt_signup_password_intents.expires_at > now()
     or coalesce(v_encrypted_password, '') = '';
  if not found then raise exception 'signup_password_intent_expired'; end if;
  return true;
end;
$$;

create or replace function public.watt_complete_signup()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_confirmed_at timestamptz;
  v_encrypted_password text;
  v_created boolean := false;
begin
  if v_user_id is null then raise exception 'authenticated_user_required'; end if;
  select encrypted_password, email_confirmed_at
    into v_encrypted_password, v_confirmed_at
    from auth.users where id = v_user_id;
  if not found or v_confirmed_at is null then raise exception 'email_verification_required'; end if;
  if coalesce(v_encrypted_password, '') = '' then raise exception 'password_not_set'; end if;
  if not exists(select 1 from public.watt_signup_password_intents where user_id = v_user_id) then
    if exists(select 1 from public.watt_signup_completions where user_id = v_user_id) then
      return jsonb_build_object('completed', true, 'already_completed', true);
    end if;
    raise exception 'signup_password_intent_expired';
  end if;
  insert into public.watt_signup_completions(user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;
  v_created := found;
  if v_created then
    insert into public.watt_grants(owner_type, owner_id, source, granted_units, remaining_units)
    values ('user', v_user_id, 'signup', 12, 12);
  end if;
  delete from public.watt_signup_password_intents where user_id = v_user_id;
  return jsonb_build_object('completed', true, 'grant_units', case when v_created then 12 else 0 end);
end;
$$;

create or replace function public.watt_is_signup_completed()
returns boolean
language sql
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists(select 1 from public.watt_signup_completions where user_id = auth.uid());
$$;

revoke all on function public.watt_signup_can_set_password(), public.watt_complete_signup(), public.watt_is_signup_completed() from public, anon;
grant execute on function public.watt_signup_can_set_password(), public.watt_complete_signup(), public.watt_is_signup_completed() to authenticated;
