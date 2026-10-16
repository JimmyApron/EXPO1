-- Existing projects retain the original service/app workflow and presentation stage.
-- Preserve values from the earlier snake_case project schema when it is present.
do $$
begin
  if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'projects' and column_name = 'has_presentation')
    and not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'projects' and column_name = 'haspresentation') then
    alter table public.projects rename column has_presentation to haspresentation;
  end if;
end $$;

alter table public.projects
  add column if not exists template text not null default 'service_app',
  add column if not exists haspresentation boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint
      where conrelid = 'public.projects'::regclass and conname = 'projects_template_check') then
    alter table public.projects add constraint projects_template_check
      check (template in ('service_app', 'report_research', 'writing_creative'));
  end if;
end $$;

-- Favorite is a per-user relation, not a project-wide flag.
create table if not exists public.project_favorites (
  userid uuid not null references auth.users(id) on delete cascade,
  projectid uuid not null references public.projects(id) on delete cascade,
  createdat timestamptz not null default now(),
  primary key (userid, projectid)
);
-- The remote database already has this table with user_id/project_id/created_at.
-- Rename its columns so existing favorite rows remain usable by the app.
do $$
begin
  if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'project_favorites' and column_name = 'user_id')
    and not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'project_favorites' and column_name = 'userid') then
    alter table public.project_favorites rename column user_id to userid;
  end if;
  if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'project_favorites' and column_name = 'project_id')
    and not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'project_favorites' and column_name = 'projectid') then
    alter table public.project_favorites rename column project_id to projectid;
  end if;
  if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'project_favorites' and column_name = 'created_at')
    and not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'project_favorites' and column_name = 'createdat') then
    alter table public.project_favorites rename column created_at to createdat;
  end if;
end $$;

create index if not exists project_favorites_project_idx on public.project_favorites(projectid);
alter table public.project_favorites enable row level security;
revoke all on public.project_favorites from public, anon, authenticated;
grant select, insert, delete on public.project_favorites to authenticated;
drop policy if exists "Users can view their own project favorites" on public.project_favorites;
drop policy if exists "Users can create their own project favorites" on public.project_favorites;
drop policy if exists "Users can delete their own project favorites" on public.project_favorites;
create policy project_favorites_select on public.project_favorites for select to authenticated
  using (userid = auth.uid() and exists (
    select 1 from public.projects p where p.id = projectid and
      (p.userid = auth.uid() or exists (
        select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));
create policy project_favorites_insert on public.project_favorites for insert to authenticated
  with check (userid = auth.uid() and exists (
    select 1 from public.projects p where p.id = projectid and
      (p.userid = auth.uid() or exists (
        select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));
create policy project_favorites_delete on public.project_favorites for delete to authenticated
  using (userid = auth.uid() and exists (
    select 1 from public.projects p where p.id = projectid and
      (p.userid = auth.uid() or exists (
        select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));

-- Non-service templates use shared stage content and explicit completion.
create table public.project_stage_progress (
  projectid uuid not null references public.projects(id) on delete cascade,
  template text not null check (template in ('report_research', 'writing_creative')),
  stageid text not null check (stageid in ('extraction', 'selection', 'mvp', 'draft', 'revision', 'result', 'presentation')),
  content text not null default '',
  iscompleted boolean not null default false,
  updatedat timestamptz not null default now(),
  primary key (projectid, template, stageid)
);
alter table public.project_stage_progress enable row level security;
revoke all on public.project_stage_progress from public, anon, authenticated;
grant select, insert, update on public.project_stage_progress to authenticated;
create policy project_stage_progress_select on public.project_stage_progress for select to authenticated
  using (exists (select 1 from public.projects p where p.id = projectid and
    (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));
create policy project_stage_progress_insert on public.project_stage_progress for insert to authenticated
  with check (exists (select 1 from public.projects p where p.id = projectid and
    (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));
create policy project_stage_progress_update on public.project_stage_progress for update to authenticated
  using (exists (select 1 from public.projects p where p.id = projectid and
    (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))))
  with check (exists (select 1 from public.projects p where p.id = projectid and
    (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));
