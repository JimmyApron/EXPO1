-- Keep submitted blind votes immutable during normal app operations, while
-- allowing the existing foreign key cascade to clean them up with an idea.
create or replace function public.reject_idea_evaluation_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  raise exception using errcode = 'P0001', message = 'Submitted blind evaluations are locked.';
end;
$$;

-- An AI comparison is tied to the complete candidate set. Removing any idea
-- invalidates the stored comparison so the remaining ideas must be analyzed again.
create or replace function public.invalidate_coach_result_after_idea_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.projectflows
  set coachresult = null,
      updatedat = now()
  where projectid = old.projectid;

  return old;
end;
$$;

drop trigger if exists ideasinvalidatecoachresultafterdelete on public.ideas;
create trigger ideasinvalidatecoachresultafterdelete
  after delete on public.ideas
  for each row execute function public.invalidate_coach_result_after_idea_delete();
