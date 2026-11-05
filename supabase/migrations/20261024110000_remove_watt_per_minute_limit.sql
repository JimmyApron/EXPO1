-- Remove the per-minute AI request cap; concurrent slots and daily/unit limits remain.
create or replace function public.watt_reserve_usage(
  p_user_id uuid,p_request_id uuid,p_feature text,p_project_id uuid,p_room_id uuid,p_units integer,
  p_request_hash text default null,p_consent boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  u public.watt_usage%rowtype; e public.watt_entitlements%rowtype;
  v_room uuid; v_owner uuid; v_type text; v_cost integer; v_units integer;
  v_kind text:='unit_charge'; v_day date; v_day_count integer; v_total integer;
  v_user_count integer; v_slots integer; v_left integer; g record;
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
  select count(*) into v_slots from public.watt_usage
    where room_id is not distinct from p_room_id and state='reserved'
      and (p_room_id is not null or user_id=p_user_id);
  if (p_room_id is null and v_slots>=1) or (p_room_id is not null and v_slots>=3)
    then raise exception 'execution_limit'; end if;
  if p_feature not in ('extract-candidate-ideas-image','generate-presentation','workspace-presentation')
    and e.id is not null then
    if not e.trial then
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
