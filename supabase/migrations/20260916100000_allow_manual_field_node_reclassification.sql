alter table public.mind_map_nodes
  add column if not exists ismanualposition boolean not null default false;

create index if not exists mind_map_nodes_manual_position_idx
  on public.mind_map_nodes (mindmapid, ismanualposition);
