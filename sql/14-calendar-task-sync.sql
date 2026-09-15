-- Phase 7 — Edit calendar event; keep linked task in sync when task_id set

create or replace function public.update_calendar_event(
  p_event_id uuid,
  p_title text default null,
  p_notes text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_all_day boolean default null
)
returns public.calendar_events
language plpgsql
security invoker
as $$
declare
  ev public.calendar_events;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  update public.calendar_events
  set
    title = coalesce(nullif(trim(p_title), ''), title),
    notes = case when p_notes is null then notes else nullif(trim(p_notes), '') end,
    starts_at = coalesce(p_starts_at, starts_at),
    ends_at = case when p_ends_at is null then ends_at else p_ends_at end,
    all_day = coalesce(p_all_day, all_day),
    updated_at = now()
  where id = p_event_id and user_id = auth.uid()
  returning * into ev;

  if ev.id is null then raise exception 'Event not found'; end if;

  -- Mirror to linked task
  if ev.task_id is not null then
    update public.tasks
    set
      title = ev.title,
      notes = ev.notes,
      due_at = ev.starts_at,
      all_day = ev.all_day,
      updated_at = now()
    where id = ev.task_id and user_id = auth.uid();
  end if;

  return ev;
end;
$$;

grant execute on function public.update_calendar_event(uuid, text, text, timestamptz, timestamptz, boolean) to authenticated;
