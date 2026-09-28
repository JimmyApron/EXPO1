-- Expand project mind maps from one node per idea to one node per populated idea field.
-- Existing ideas are never changed or deleted by this migration.
alter table public.mind_map_nodes
  add column if not exists ideafield text null,
  add column if not exists branchfield text null;

drop index if exists public.mind_map_nodes_one_idea_idx;

alter table public.mind_map_nodes
  drop constraint if exists mind_map_nodes_nodetype_check,
  drop constraint if exists mind_map_nodes_idea_type_check,
  drop constraint if exists mind_map_nodes_ideafield_check,
  drop constraint if exists mind_map_nodes_branchfield_check;

alter table public.mind_map_nodes
  add constraint mind_map_nodes_ideafield_check check (
    ideafield is null or ideafield in ('problem', 'targetusers', 'solution', 'corefeatures', 'keywords')
  ) not valid,
  add constraint mind_map_nodes_branchfield_check check (
    branchfield is null or branchfield in ('problem', 'targetusers', 'solution', 'corefeatures', 'keywords')
  ) not valid,
  add constraint mind_map_nodes_nodetype_check check (
    nodetype in ('root', 'branch', 'idea', 'idea_field')
  ) not valid,
  add constraint mind_map_nodes_idea_type_check check (
    (nodetype = 'root' and ideaid is null and ideafield is null and branchfield is null) or
    (nodetype = 'branch' and ideaid is null and ideafield is null) or
    (nodetype = 'idea' and ideaid is not null and ideafield is null and branchfield is null) or
    (nodetype = 'idea_field' and ideaid is not null and ideafield is not null and branchfield is null)
  ) not valid;

-- Reuse one matching legacy branch per map as the fixed branch instead of duplicating it.
with branch_candidates as (
  select
    node.id,
    definition.field,
    row_number() over (
      partition by node.mindmapid, definition.field
      order by (node.branchfield = definition.field) desc, node.sortorder, node.createdat, node.id
    ) as candidate_order
  from public.mind_map_nodes node
  join (values
    ('problem', '문제'),
    ('targetusers', '대상 사용자'),
    ('solution', '해결 방법'),
    ('corefeatures', '핵심 기능'),
    ('keywords', '키워드')
  ) as definition(field, title)
    on node.nodetype = 'branch' and node.title = definition.title
)
update public.mind_map_nodes node
set branchfield = candidate.field
from branch_candidates candidate
where node.id = candidate.id and candidate.candidate_order = 1;

create unique index if not exists mind_map_nodes_one_field_branch_idx
  on public.mind_map_nodes (mindmapid, branchfield);

create unique index if not exists mind_map_nodes_one_idea_field_idx
  on public.mind_map_nodes (mindmapid, ideaid, ideafield);

-- A valid map always needs a root before fixed branches can be created.
insert into public.mind_map_nodes (mindmapid, userid, nodetype, title, summary, x, y, sortorder)
select map.id, map.userid, 'root', map.title, '프로젝트의 중심 주제', 0, 0, 0
from public.mindmaps map
where not exists (
  select 1 from public.mind_map_nodes root
  where root.mindmapid = map.id and root.nodetype = 'root'
)
on conflict (mindmapid) where nodetype = 'root' do nothing;

insert into public.mind_map_nodes (
  mindmapid, userid, parentnodeid, branchfield, nodetype, title, summary, x, y, sortorder
)
select
  map.id,
  map.userid,
  root.id,
  definition.field,
  'branch',
  definition.title,
  definition.summary,
  360,
  0,
  definition.sortorder
from public.mindmaps map
join public.mind_map_nodes root
  on root.mindmapid = map.id and root.nodetype = 'root'
cross join (values
  ('problem', '문제', '아이디어가 해결하려는 문제', 0),
  ('targetusers', '대상 사용자', '아이디어의 대상 사용자', 1),
  ('solution', '해결 방법', '아이디어가 제안하는 해결 방법', 2),
  ('corefeatures', '핵심 기능', '아이디어의 핵심 기능', 3),
  ('keywords', '키워드', '아이디어의 핵심 키워드', 4)
) as definition(field, title, summary, sortorder)
on conflict (mindmapid, branchfield) do update
set
  parentnodeid = excluded.parentnodeid,
  title = excluded.title,
  summary = excluded.summary,
  sortorder = excluded.sortorder,
  updatedat = now();

-- Backfill every populated structured field for ideas belonging to an existing map.
insert into public.mind_map_nodes (
  mindmapid, userid, parentnodeid, ideaid, ideafield, nodetype, title, summary, x, y, sortorder
)
select
  map.id,
  idea.userid,
  branch.id,
  idea.id,
  field_value.field,
  'idea_field',
  idea.title,
  field_value.summary,
  720,
  0,
  0
from public.mindmaps map
join public.ideas idea on idea.projectid = map.projectid and not idea.legacystructural
cross join lateral (values
  ('problem', nullif(btrim(idea.problem), '')),
  ('targetusers', (
    select string_agg('• ' || btrim(value), E'\n')
    from unnest(coalesce(idea.targetusers, '{}'::text[])) as item(value)
    where btrim(value) <> ''
  )),
  ('solution', nullif(btrim(idea.solution), '')),
  ('corefeatures', (
    select string_agg('• ' || btrim(value), E'\n')
    from unnest(coalesce(idea.corefeatures, '{}'::text[])) as item(value)
    where btrim(value) <> ''
  )),
  ('keywords', (
    select string_agg('• ' || btrim(value), E'\n')
    from unnest(coalesce(idea.keywords, '{}'::text[])) as item(value)
    where btrim(value) <> ''
  ))
) as field_value(field, summary)
join public.mind_map_nodes branch
  on branch.mindmapid = map.id
  and branch.nodetype = 'branch'
  and branch.branchfield = field_value.field
where field_value.summary is not null
on conflict (mindmapid, ideaid, ideafield) do update
set
  parentnodeid = excluded.parentnodeid,
  nodetype = excluded.nodetype,
  title = excluded.title,
  summary = excluded.summary,
  updatedat = now();

-- Remove an old automatic single-idea node only after replacement field nodes exist.
delete from public.mind_map_nodes old_node
using public.mind_map_nodes branch
where old_node.nodetype = 'idea'
  and old_node.parentnodeid = branch.id
  and branch.branchfield is not null
  and exists (
    select 1
    from public.mind_map_nodes field_node
    where field_node.mindmapid = old_node.mindmapid
      and field_node.ideaid = old_node.ideaid
      and field_node.nodetype = 'idea_field'
  );

alter table public.mind_map_nodes
  validate constraint mind_map_nodes_ideafield_check,
  validate constraint mind_map_nodes_branchfield_check,
  validate constraint mind_map_nodes_nodetype_check,
  validate constraint mind_map_nodes_idea_type_check;

comment on column public.mind_map_nodes.ideafield is
  'Structured idea field represented by an idea_field node.';
comment on column public.mind_map_nodes.branchfield is
  'Structured field owned by a protected fixed branch; null for custom branches.';
