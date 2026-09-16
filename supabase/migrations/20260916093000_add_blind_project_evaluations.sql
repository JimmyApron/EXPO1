create table if not exists public.project_evaluations (
  id uuid primary key default gen_random_uuid(),
  projectid uuid not null references public.projects(id) on delete cascade,
  ideaid uuid not null references public.ideas(id) on delete cascade,
  evaluatorid uuid not null references auth.users(id) on delete cascade,
  scores jsonb not null default '{}'::jsonb,
  submittedat timestamptz not null default now(),
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now(),
  constraint project_evaluations_project_idea_evaluator_key unique (projectid, ideaid, evaluatorid)
);

create index if not exists project_evaluations_project_idea_idx
  on public.project_evaluations (projectid, ideaid);

alter table public.project_evaluations enable row level security;

drop policy if exists project_evaluations_select on public.project_evaluations;
create policy project_evaluations_select
  on public.project_evaluations for select to authenticated
  using (evaluatorid = auth.uid());

drop policy if exists project_evaluations_insert on public.project_evaluations;
create policy project_evaluations_insert
  on public.project_evaluations for insert to authenticated
  with check (
    evaluatorid = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = projectid
        and (p.userid = auth.uid() or exists (
          select 1 from public.roommembers rm
          where rm.roomid = p.roomid and rm.userid = auth.uid()
        ))
    )
    and exists (select 1 from public.ideas i where i.id = ideaid and i.projectid = projectid)
  );

drop policy if exists project_evaluations_update on public.project_evaluations;
create policy project_evaluations_update
  on public.project_evaluations for update to authenticated
  using (evaluatorid = auth.uid())
  with check (evaluatorid = auth.uid());

grant select, insert, update on public.project_evaluations to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'project_evaluations'
    ) then
    alter publication supabase_realtime add table public.project_evaluations;
  end if;
end
$$;
