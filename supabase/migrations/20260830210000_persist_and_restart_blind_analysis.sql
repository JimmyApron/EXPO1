alter table public.projectflows
  add column if not exists blindanalysis jsonb null,
  add column if not exists evaluationround integer not null default 1;

alter table public.projectflows
  drop constraint if exists projectflowsevaluationroundcheck;

alter table public.projectflows
  add constraint projectflowsevaluationroundcheck check (evaluationround >= 1);

alter table public.ideaevaluations
  add column if not exists evaluationround integer not null default 1;

alter table public.ideaevaluations
  drop constraint if exists ideaevaluations_projectid_ideaid_userid_key,
  drop constraint if exists ideaevaluationsprojectideaiduseridroundkey;

alter table public.ideaevaluations
  add constraint ideaevaluationsprojectideaiduseridroundkey
  unique (projectid, ideaid, userid, evaluationround);

drop index if exists public.ideaevaluationsprojectidideaididx;
create index ideaevaluationsprojectidideaididx
  on public.ideaevaluations (projectid, evaluationround, ideaid);

create or replace function public.restart_blind_evaluation(target_project_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not exists (
    select 1
    from public.projects as p
    where p.id = target_project_id
      and (
        p.userid = actor_id
        or (p.roomid is not null and public.is_room_member(p.roomid, actor_id))
      )
  ) then
    raise exception using errcode = '42501', message = '프로젝트 멤버만 블라인드 평가를 다시 시작할 수 있습니다.';
  end if;

  update public.ideas
  set status = 'approved', updatedat = now()
  where projectid = target_project_id and status = 'selected';

  update public.projectflows
  set selectedideaid = null,
      coachresult = null,
      blindanalysis = null,
      evaluationround = evaluationround + 1,
      updatedat = now()
  where projectid = target_project_id;
end;
$$;

revoke all on function public.restart_blind_evaluation(uuid) from public, anon;
grant execute on function public.restart_blind_evaluation(uuid) to authenticated;
