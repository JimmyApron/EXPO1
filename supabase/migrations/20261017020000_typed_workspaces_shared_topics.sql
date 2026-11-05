-- Additive storage: original ideas, service flows and legacy stage text remain intact.
alter table public.projects add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.ideas add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.mindmaps add column if not exists defaultsinitialized boolean not null default false;

create table public.project_workspaces (
  projectid uuid not null references public.projects(id) on delete cascade,
  template text not null check (template in ('report_research', 'writing_creative')),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  revision integer not null default 1,
  updatedat timestamptz not null default now(),
  primary key (projectid, template)
);
alter table public.project_workspaces enable row level security;
revoke all on public.project_workspaces from public, anon, authenticated;
grant select, insert, update on public.project_workspaces to authenticated;
create policy workspace_read on public.project_workspaces for select to authenticated using (
  exists (select 1 from public.projects p where p.id = projectid));
create policy workspace_insert on public.project_workspaces for insert to authenticated with check (
  exists (select 1 from public.projects p where p.id = projectid and p.template = project_workspaces.template));
create policy workspace_update on public.project_workspaces for update to authenticated using (
  exists (select 1 from public.projects p where p.id = projectid and p.template = project_workspaces.template)) with check (
  exists (select 1 from public.projects p where p.id = projectid and p.template = project_workspaces.template));

-- Compare revisions under a row lock. A teammate's edits are never silently overwritten.
create function public.save_project_workspace(p_projectid uuid, p_template text, p_revision integer, p_data jsonb)
returns public.project_workspaces language plpgsql security invoker set search_path = public as $$
declare saved public.project_workspaces;
begin
  if auth.uid() is null or not exists (select 1 from public.projects where id = p_projectid and template = p_template) then
    raise exception '과제 접근 권한 또는 유형을 확인해 주세요.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_projectid::text || p_template, 0));
  select * into saved from public.project_workspaces where projectid = p_projectid and template = p_template for update;
  if coalesce(saved.revision, 0) <> p_revision then
    raise exception '다른 화면 또는 팀원이 먼저 저장했습니다. 현재 초안을 보관한 후 최신 내용을 불러와 주세요.' using errcode = '40001';
  end if;
  if p_data->>'selectedIdeaId' is not null and not exists (
    select 1 from public.ideas where id::text = p_data->>'selectedIdeaId' and projectid = p_projectid and not legacystructural
  ) then raise exception '같은 과제에 등록한 주제·소재를 선택해 주세요.'; end if;
  if saved.revision is not null then
    -- Keep explicit completion honest when its underlying work changes.
    if saved.data->'selectedIdeaId' is distinct from p_data->'selectedIdeaId' then
      update public.project_stage_progress set iscompleted = false, updatedat = now() where projectid = p_projectid and template = p_template;
    elsif (select jsonb_agg(item - 'collapsed' - 'completed') from jsonb_array_elements(coalesce(saved.data->'outline', '[]'::jsonb)) item)
      is distinct from (select jsonb_agg(item - 'collapsed' - 'completed') from jsonb_array_elements(coalesce(p_data->'outline', '[]'::jsonb)) item)
      or saved.data->'freeBody' is distinct from p_data->'freeBody'
      or saved.data->'title' is distinct from p_data->'title'
      or saved.data->'subtitle' is distinct from p_data->'subtitle' then
      update public.project_stage_progress set iscompleted = false, updatedat = now()
        where projectid = p_projectid and template = p_template and stageid in ('draft', 'revision', 'result', 'presentation');
    end if;
    if saved.data->'resources' is distinct from p_data->'resources' or saved.data->'evidence' is distinct from p_data->'evidence' then
      update public.project_stage_progress set iscompleted = false, updatedat = now()
        where projectid = p_projectid and template = p_template and stageid in ('selection', 'revision', 'presentation') and p_template = 'report_research';
    end if;
    if saved.data->'slides' is distinct from p_data->'slides' then
      update public.project_stage_progress set iscompleted = false, updatedat = now()
        where projectid = p_projectid and template = p_template and stageid = 'presentation';
    end if;
  end if;
  insert into public.project_workspaces(projectid, template, data, revision)
  values (p_projectid, p_template, p_data, 1)
  on conflict (projectid, template) do update set data = excluded.data, revision = project_workspaces.revision + 1, updatedat = now()
  returning * into saved;
  update public.projects set updatedat = now() where id = p_projectid;
  return saved;
end $$;
revoke all on function public.save_project_workspace(uuid, text, integer, jsonb) from public, anon;
grant execute on function public.save_project_workspace(uuid, text, integer, jsonb) to authenticated;

-- One linked card per generic map. Branches remain independent structural records.
create function public.sync_topic_map(p_projectid uuid, p_ideaids uuid[], p_topic text, p_branches text[], p_target uuid default null)
returns void language plpgsql security invoker set search_path = public as $$
declare m public.mindmaps; r uuid; b uuid; branch_title text; i public.ideas; n uuid; pos integer := 0;
begin
  if auth.uid() is null or not exists (select 1 from public.projects where id = p_projectid and template <> 'service_app') then
    raise exception '조사·창작 과제 접근 권한을 확인해 주세요.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_projectid::text || ':topic-map', 0));
  insert into public.mindmaps(projectid, userid, title) values(p_projectid, auth.uid(), p_topic)
    on conflict (projectid) do nothing;
  select * into m from public.mindmaps where projectid = p_projectid for update;
  insert into public.mind_map_nodes(mindmapid, userid, nodetype, title) values(m.id, auth.uid(), 'root', p_topic)
    on conflict (mindmapid) where nodetype = 'root' do nothing;
  select id into r from public.mind_map_nodes where mindmapid = m.id and nodetype = 'root';
  update public.mindmaps set title = p_topic, updatedat = now() where id = m.id and title is distinct from p_topic;
  update public.mind_map_nodes set title = p_topic where id = r and title is distinct from p_topic;
  if not m.defaultsinitialized then
    foreach branch_title in array p_branches loop
      if not exists (select 1 from public.mind_map_nodes where mindmapid = m.id and nodetype = 'branch' and mind_map_nodes.title = branch_title) then
        insert into public.mind_map_nodes(mindmapid, userid, parentnodeid, nodetype, title, sortorder)
          values(m.id, auth.uid(), r, 'branch', branch_title, pos);
      end if;
      pos := pos + 1;
    end loop;
    update public.mindmaps set defaultsinitialized = true where id = m.id;
  end if;
  if p_target is not null and not exists (select 1 from public.mind_map_nodes where id = p_target and mindmapid = m.id and nodetype = 'branch') then
    raise exception '같은 마인드맵의 분류를 선택해 주세요.';
  end if;
  select coalesce(p_target, (select id from public.mind_map_nodes where mindmapid = m.id and nodetype = 'branch' order by sortorder, id limit 1)) into b;
  if b is null and cardinality(p_ideaids) > 0 then
    insert into public.mind_map_nodes(mindmapid, userid, parentnodeid, nodetype, title)
      values(m.id, auth.uid(), r, 'branch', '미분류') returning id into b;
  end if;
  for i in select * from public.ideas where id = any(p_ideaids) and projectid = p_projectid and not legacystructural loop
    select id into n from public.mind_map_nodes where mindmapid = m.id and ideaid = i.id and nodetype = 'idea' order by createdat, id limit 1;
    if n is null then
      insert into public.mind_map_nodes(mindmapid, userid, parentnodeid, ideaid, nodetype, title, summary, x)
        values(m.id, auth.uid(), b, i.id, 'idea', i.title, i.content, 720);
    else
      update public.mind_map_nodes set title = i.title, summary = i.content,
        parentnodeid = coalesce(p_target, parentnodeid, b), ismanualposition = case when p_target is not null then true else ismanualposition end
        where id = n;
    end if;
  end loop;
end $$;
revoke all on function public.sync_topic_map(uuid, uuid[], text, text[], uuid) from public, anon;
grant execute on function public.sync_topic_map(uuid, uuid[], text, text[], uuid) to authenticated;

-- Database-side sync also covers changes made by another team member or screen.
create function public.sync_topic_card_nodes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.mind_map_nodes set title = new.title, summary = new.content, updatedat = now()
    where ideaid = new.id and nodetype = 'idea';
  update public.mindmaps m set title = new.title, updatedat = now()
    where m.projectid = new.projectid and exists (select 1 from public.project_workspaces w
      where w.projectid = new.projectid and w.data->>'selectedIdeaId' = new.id::text);
  update public.mind_map_nodes n set title = new.title where n.nodetype = 'root' and exists (
    select 1 from public.mindmaps m join public.project_workspaces w on w.projectid = m.projectid
    where n.mindmapid = m.id and m.projectid = new.projectid and w.data->>'selectedIdeaId' = new.id::text);
  if (new.title, new.content, new.details, new.keywords) is distinct from (old.title, old.content, old.details, old.keywords) then
    update public.project_stage_progress s set iscompleted = false, updatedat = now()
      where s.projectid = new.projectid and s.template <> 'service_app' and exists (
        select 1 from public.project_workspaces w where w.projectid = new.projectid and w.data->>'selectedIdeaId' = new.id::text);
  end if;
  return new;
end $$;

-- Older migrations created fixed service fields in every map. Convert only
-- non-service maps to editable classifications and one linked node per card.
update public.mind_map_nodes n set branchfield = null
from public.mindmaps m join public.projects p on p.id = m.projectid
where n.mindmapid = m.id and n.nodetype = 'branch' and p.template <> 'service_app';
with ranked as (
  select n.id, row_number() over (partition by n.mindmapid, n.ideaid order by n.createdat, n.id) as position
  from public.mind_map_nodes n join public.mindmaps m on m.id = n.mindmapid join public.projects p on p.id = m.projectid
  where p.template <> 'service_app' and n.ideaid is not null
)
delete from public.mind_map_nodes n using ranked r where n.id = r.id and r.position > 1;
update public.mind_map_nodes n set nodetype = 'idea', ideafield = null, title = i.title, summary = i.content
from public.ideas i join public.projects p on p.id = i.projectid
where n.ideaid = i.id and p.template <> 'service_app';

-- Prevent cross-project node and card links even when both projects are visible.
create function public.validate_topic_node_links() returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.parentnodeid is not null and not exists (select 1 from public.mind_map_nodes where id = new.parentnodeid and mindmapid = new.mindmapid) then
    raise exception '같은 마인드맵의 부모 노드를 선택해 주세요.';
  end if;
  if new.ideaid is not null and not exists (
    select 1 from public.ideas i join public.mindmaps m on m.projectid = i.projectid where i.id = new.ideaid and m.id = new.mindmapid
  ) then raise exception '같은 과제의 카드를 선택해 주세요.'; end if;
  return new;
end $$;
create trigger validate_topic_node_links before insert or update of parentnodeid, ideaid, mindmapid on public.mind_map_nodes
for each row execute function public.validate_topic_node_links();
revoke all on function public.validate_topic_node_links() from public, anon;
grant execute on function public.validate_topic_node_links() to authenticated;
create trigger sync_topic_card_nodes after update of title, content, details, keywords on public.ideas
  for each row execute function public.sync_topic_card_nodes();
revoke all on function public.sync_topic_card_nodes() from public, anon, authenticated;

-- A removed card detaches the selection, rather than leaving an invisible selected item.
create function public.detach_workspace_topic() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.project_workspaces set data = jsonb_set(data, '{selectedIdeaId}', 'null'::jsonb), revision = revision + 1, updatedat = now()
    where projectid = old.projectid and data->>'selectedIdeaId' = old.id::text;
  if found then
    update public.project_stage_progress set iscompleted = false, updatedat = now()
      where projectid = old.projectid and template <> 'service_app';
  end if;
  return old;
end $$;
create trigger detach_workspace_topic after delete on public.ideas for each row execute function public.detach_workspace_topic();
revoke all on function public.detach_workspace_topic() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.project_workspaces;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_stage_progress') then
      alter publication supabase_realtime add table public.project_stage_progress;
    end if;
  end if;
end $$;
