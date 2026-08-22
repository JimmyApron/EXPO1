-- Blind idea votes are append-only so a submitted pass/pick cannot be changed.
-- All identifiers follow the project's lowercase, no-underscore convention.
create table if not exists public.ideaevaluations (
  id uuid primary key default gen_random_uuid(),
  projectid uuid not null references public.projects(id) on delete cascade,
  ideaid uuid not null references public.ideas(id) on delete cascade,
  userid uuid not null references auth.users(id) on delete cascade,
  choice text not null check (choice in ('pass', 'pick')),
  locked boolean not null default true check (locked),
  createdat timestamptz not null default now(),
  unique (projectid, ideaid, userid)
);

create index if not exists ideaevaluationsprojectidideaididx
  on public.ideaevaluations (projectid, ideaid);

alter table public.ideaevaluations enable row level security;

create policy "ideaevaluations_select_project_members"
  on public.ideaevaluations for select to authenticated
  using (true);

create policy "ideaevaluations_insert_self"
  on public.ideaevaluations for insert to authenticated
  with check (userid = auth.uid());

create or replace function public.reject_idea_evaluation_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = 'P0001', message = 'Submitted blind evaluations are locked.';
end;
$$;

drop trigger if exists ideaevaluationsimmutable on public.ideaevaluations;
create trigger ideaevaluationsimmutable
  before update or delete on public.ideaevaluations
  for each row execute function public.reject_idea_evaluation_change();

grant select, insert on table public.ideaevaluations to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'ideaevaluations'
    ) then
    alter publication supabase_realtime add table public.ideaevaluations;
  end if;
end
$$;
