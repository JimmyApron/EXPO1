create table if not exists public.mindmaps (
  id uuid primary key default gen_random_uuid(),
  projectid uuid not null unique references public.projects(id) on delete cascade,
  userid uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

alter table public.ideas add column if not exists legacystructural boolean not null default false;

update public.ideas
set legacystructural = true
where legacystructural = false
  and parentnodeid is null
  and side = 'center';

create table if not exists public.mind_map_nodes (
  id uuid primary key default gen_random_uuid(),
  mindmapid uuid not null references public.mindmaps(id) on delete cascade,
  userid uuid not null references auth.users(id) on delete cascade,
  parentnodeid uuid null references public.mind_map_nodes(id) on delete cascade,
  ideaid uuid null references public.ideas(id) on delete cascade,
  nodetype text not null check (nodetype in ('root', 'branch', 'idea')),
  title text not null default '',
  summary text not null default '',
  x integer not null default 0,
  y integer not null default 0,
  sortorder integer not null default 0,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now(),
  constraint mind_map_nodes_idea_type_check check (
    (nodetype = 'idea' and ideaid is not null) or
    (nodetype in ('root', 'branch') and ideaid is null)
  )
);

create unique index if not exists mind_map_nodes_one_root_idx on public.mind_map_nodes (mindmapid) where nodetype = 'root';
create unique index if not exists mind_map_nodes_one_idea_idx on public.mind_map_nodes (mindmapid, ideaid) where ideaid is not null;
create index if not exists mind_map_nodes_parent_idx on public.mind_map_nodes (mindmapid, parentnodeid, sortorder);

alter table public.mindmaps enable row level security;
alter table public.mind_map_nodes enable row level security;

create policy mindmaps_select on public.mindmaps for select to authenticated
using (exists (select 1 from public.projects p where p.id = projectid and (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));
create policy mindmaps_insert on public.mindmaps for insert to authenticated
with check (userid = auth.uid() and exists (select 1 from public.projects p where p.id = projectid and (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));
create policy mindmaps_update on public.mindmaps for update to authenticated
using (exists (select 1 from public.projects p where p.id = projectid and (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))))
with check (exists (select 1 from public.projects p where p.id = projectid and (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));
create policy mindmaps_delete on public.mindmaps for delete to authenticated
using (exists (select 1 from public.projects p where p.id = projectid and (p.userid = auth.uid() or exists (select 1 from public.roommembers rm where rm.roomid = p.roomid and rm.userid = auth.uid()))));

create policy mind_map_nodes_select on public.mind_map_nodes for select to authenticated
using (exists (select 1 from public.mindmaps m where m.id = mindmapid));
create policy mind_map_nodes_insert on public.mind_map_nodes for insert to authenticated
with check (userid = auth.uid() and exists (select 1 from public.mindmaps m where m.id = mindmapid));
create policy mind_map_nodes_update on public.mind_map_nodes for update to authenticated
using (exists (select 1 from public.mindmaps m where m.id = mindmapid))
with check (exists (select 1 from public.mindmaps m where m.id = mindmapid));
create policy mind_map_nodes_delete on public.mind_map_nodes for delete to authenticated
using (exists (select 1 from public.mindmaps m where m.id = mindmapid));

grant select, insert, update, delete on public.mindmaps, public.mind_map_nodes to authenticated;

-- Read-only-compatible migration of legacy idea coordinates. Existing ideas remain untouched.
insert into public.mindmaps (projectid, userid, title)
select p.id, p.userid, p.title
from public.projects p
where exists (select 1 from public.ideas i where i.projectid = p.id and not i.legacystructural and (i.parentnodeid is not null or i.side is not null))
on conflict (projectid) do nothing;

insert into public.mind_map_nodes (mindmapid, userid, nodetype, title, summary, x, y, sortorder)
select m.id, m.userid, 'root', m.title, '프로젝트의 중심 주제', 0, 0, 0
from public.mindmaps m
where exists (select 1 from public.ideas i where i.projectid = m.projectid and not i.legacystructural and (i.parentnodeid is not null or i.side is not null))
on conflict (mindmapid) where nodetype = 'root' do nothing;

insert into public.mind_map_nodes (mindmapid, userid, parentnodeid, nodetype, title, summary, x, y, sortorder)
select m.id, m.userid, root.id, 'branch', '기존 아이디어', '이전 마인드맵에서 가져온 아이디어', 360, 0, 0
from public.mindmaps m
join public.mind_map_nodes root on root.mindmapid = m.id and root.nodetype = 'root'
where exists (select 1 from public.ideas i where i.projectid = m.projectid and not i.legacystructural and (i.parentnodeid is not null or i.side is not null))
  and not exists (select 1 from public.mind_map_nodes branch where branch.mindmapid = m.id and branch.nodetype = 'branch' and branch.title = '기존 아이디어');

insert into public.mind_map_nodes (mindmapid, userid, parentnodeid, ideaid, nodetype, title, summary, x, y, sortorder)
select m.id, i.userid, branch.id, i.id, 'idea', i.title, coalesce(nullif(i.summary, ''), i.content), 720, (row_number() over (partition by m.id order by i.createdat) - 1)::integer * 150, row_number() over (partition by m.id order by i.createdat)::integer
from public.mindmaps m
join public.ideas i on i.projectid = m.projectid
join public.mind_map_nodes branch on branch.mindmapid = m.id and branch.nodetype = 'branch' and branch.title = '기존 아이디어'
where not i.legacystructural and (i.parentnodeid is not null or i.side is not null)
on conflict (mindmapid, ideaid) where ideaid is not null do nothing;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mindmaps') then
      alter publication supabase_realtime add table public.mindmaps;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mind_map_nodes') then
      alter publication supabase_realtime add table public.mind_map_nodes;
    end if;
  end if;
end
$$;
