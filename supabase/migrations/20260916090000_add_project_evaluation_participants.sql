create table if not exists public.project_evaluation_participants (
  id uuid primary key default gen_random_uuid(),
  projectid uuid not null references public.projects(id) on delete cascade,
  userid uuid not null references auth.users(id) on delete cascade,
  completedat timestamptz not null default now(),
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now(),
  constraint project_evaluation_participants_project_user_key unique (projectid, userid)
);

create index if not exists project_evaluation_participants_project_idx
  on public.project_evaluation_participants (projectid, completedat desc);

alter table public.project_evaluation_participants enable row level security;

drop policy if exists project_evaluation_participants_select on public.project_evaluation_participants;
create policy project_evaluation_participants_select
  on public.project_evaluation_participants for select to authenticated
  using (exists (
    select 1
    from public.projects p
    where p.id = projectid
      and (p.userid = auth.uid() or exists (
        select 1 from public.roommembers rm
        where rm.roomid = p.roomid and rm.userid = auth.uid()
      ))
  ));

drop policy if exists project_evaluation_participants_insert on public.project_evaluation_participants;
create policy project_evaluation_participants_insert
  on public.project_evaluation_participants for insert to authenticated
  with check (
    userid = auth.uid()
    and exists (
      select 1
      from public.projects p
      where p.id = projectid
        and (p.userid = auth.uid() or exists (
          select 1 from public.roommembers rm
          where rm.roomid = p.roomid and rm.userid = auth.uid()
        ))
    )
  );

drop policy if exists project_evaluation_participants_update on public.project_evaluation_participants;
create policy project_evaluation_participants_update
  on public.project_evaluation_participants for update to authenticated
  using (userid = auth.uid())
  with check (userid = auth.uid());

grant select, insert, update on public.project_evaluation_participants to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'project_evaluation_participants'
    ) then
    alter publication supabase_realtime add table public.project_evaluation_participants;
  end if;
end
$$;
