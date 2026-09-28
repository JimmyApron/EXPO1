-- Publish the app's client-facing tables so Supabase Postgres Changes can
-- deliver INSERT, UPDATE, and DELETE events to subscribed clients.
do $$
declare
  table_name text;
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  foreach table_name in array array[
    'profiles',
    'projects',
    'rooms',
    'roommembers',
    'ideas',
    'ideacategories',
    'idealikes',
    'feedbacks',
    'projectflows'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end
$$;
