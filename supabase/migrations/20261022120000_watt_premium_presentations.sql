-- Premium presentation rights are determined from the current project scope and
-- server-owned entitlements. Top-up grants do not confer a subscription.
create or replace function public.watt_can_use_premium_presentation(p_project_id uuid)
returns boolean language sql volatile security definer set search_path = pg_catalog as $$
  select auth.uid() is not null
    and public.watt_can_access_project(p_project_id, auth.uid())
    and exists (
      select 1 from public.projects p
      join public.watt_entitlements e on
        ((p.roomid is null and e.room_id is null and e.user_id = auth.uid())
          or (p.roomid is not null and e.room_id = p.roomid))
      where p.id = p_project_id
        and e.state in ('active', 'cancel_scheduled')
        and e.ends_at > clock_timestamp()
        and e.product_id in ('personal_30', 'personal_120', 'team_30', 'team_120',
          'trial_personal', 'trial_team')
        and ((p.roomid is null and e.product_id in ('personal_30', 'personal_120', 'trial_personal'))
          or (p.roomid is not null and e.product_id in ('team_30', 'team_120', 'trial_team')))
    );
$$;
revoke all on function public.watt_can_use_premium_presentation(uuid) from public, anon;
grant execute on function public.watt_can_use_premium_presentation(uuid) to authenticated;

-- The persisted row is the authority for grandfathered themes and snapshots.
-- Clients cannot create an old version in the same write and then restore it.
create or replace function public.watt_presentation_core(p_data jsonb)
returns jsonb language sql immutable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'presentationTitle', p_data->'presentationTitle', 'settings', p_data->'settings',
    'slides', p_data->'slides', 'expectedQna', p_data->'expectedQna',
    'businessPlanDraft', p_data->'businessPlanDraft', 'finalReport', p_data->'finalReport');
$$;
revoke all on function public.watt_presentation_core(jsonb) from public, anon, authenticated;

create or replace function public.watt_guard_presentation_theme() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare
  old_data jsonb := '{}'::jsonb;
  new_data jsonb;
  old_theme text;
  new_theme text;
  entry jsonb;
  entitled boolean;
  project_id uuid;
begin
  if tg_table_name = 'projectflows' then
    project_id := new.projectid;
    new_data := coalesce(new.presentationdata, '{}'::jsonb);
    if tg_op = 'UPDATE' then old_data := coalesce(old.presentationdata, '{}'::jsonb); end if;
  else
    project_id := new.projectid;
    new_data := coalesce(new.data, '{}'::jsonb);
    if tg_op = 'UPDATE' then old_data := coalesce(old.data, '{}'::jsonb); end if;
  end if;
  if tg_table_name = 'projectflows' and new_data = '{}'::jsonb then return new; end if;

  old_theme := case when tg_table_name = 'projectflows'
    then coalesce(old_data #>> '{settings,theme}', 'minimal-light')
    else coalesce(old_data #>> '{presentation,theme}', 'minimal-light') end;
  new_theme := case when tg_table_name = 'projectflows'
    then coalesce(new_data #>> '{settings,theme}', 'minimal-light')
    else coalesce(new_data #>> '{presentation,theme}', 'minimal-light') end;
  if new_theme not in ('minimal-light','soft-color','modern-dark','business') then
    raise exception 'invalid_presentation_theme' using errcode = '23514';
  end if;
  entitled := public.watt_can_use_premium_presentation(project_id);
  if new_theme in ('modern-dark','business') and not entitled then
    if new_theme is distinct from old_theme then
      if tg_table_name <> 'projectflows' or not exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(old_data->'versionHistory')='array'
          then old_data->'versionHistory' else '[]'::jsonb end) as previous(item)
        where previous.item #>> '{snapshot,settings,theme}' = new_theme
          and public.watt_presentation_core(new_data) = public.watt_presentation_core(previous.item->'snapshot')
      ) then raise exception 'premium_presentation_subscription_required' using errcode = '42501'; end if;
    end if;
  end if;

  if tg_table_name = 'projectflows' and not entitled then
    for entry in select next_version.item from jsonb_array_elements(case when jsonb_typeof(new_data->'versionHistory')='array'
      then new_data->'versionHistory' else '[]'::jsonb end) as next_version(item) loop
      if entry #>> '{snapshot,settings,theme}' in ('modern-dark','business') then
        if entry->'snapshot' = public.watt_presentation_core(old_data)
          and old_theme in ('modern-dark','business') then continue; end if;
        if exists (select 1 from jsonb_array_elements(case when jsonb_typeof(old_data->'versionHistory')='array'
            then old_data->'versionHistory' else '[]'::jsonb end) as previous(item)
            where previous.item->>'id' = entry->>'id' and previous.item->'snapshot' = entry->'snapshot') then continue; end if;
        raise exception 'premium_presentation_history_immutable' using errcode = '42501';
      end if;
    end loop;
  end if;
  return new;
end $$;
revoke all on function public.watt_guard_presentation_theme() from public, anon, authenticated;
create trigger watt_flow_presentation_theme before insert or update of presentationdata
  on public.projectflows for each row execute function public.watt_guard_presentation_theme();
create trigger watt_workspace_presentation_theme before insert or update of data
  on public.project_workspaces for each row execute function public.watt_guard_presentation_theme();
