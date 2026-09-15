-- Cadens v2 — Retention habits: recurring events + journal daily stats helper

-- Recurrence on calendar events (simple)
alter table public.calendar_events
  add column if not exists recur_rule text
    check (recur_rule is null or recur_rule in ('daily', 'weekly'));

alter table public.calendar_events
  add column if not exists recur_until date;

-- Update create function to accept recurrence
create or replace function public.create_calendar_event(
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz default null,
  p_all_day boolean default false,
  p_notes text default null,
  p_location_label text default null,
  p_calendar_id uuid default null,
  p_recur_rule text default null,
  p_recur_until date default null
)
returns public.calendar_events
language plpgsql
security invoker
as $$
declare
  row public.calendar_events;
  cid uuid := p_calendar_id;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if cid is null then
    cid := (select id from public.ensure_default_calendar());
  end if;
  if not exists (select 1 from public.calendars c where c.id = cid and c.user_id = auth.uid()) then
    raise exception 'Calendar not found';
  end if;
  if p_recur_rule is not null and p_recur_rule not in ('daily', 'weekly') then
    raise exception 'Invalid recur_rule';
  end if;

  insert into public.calendar_events (
    calendar_id, user_id, title, notes, location_label, starts_at, ends_at, all_day,
    recur_rule, recur_until
  ) values (
    cid, auth.uid(), trim(p_title), nullif(trim(p_notes), ''), nullif(trim(p_location_label), ''),
    p_starts_at, p_ends_at, coalesce(p_all_day, false),
    p_recur_rule, p_recur_until
  ) returning * into row;
  return row;
end;
$$;

grant execute on function public.create_calendar_event(text, timestamptz, timestamptz, boolean, text, text, uuid, text, date) to authenticated;

-- Did I journal today? + streak snapshot for widgets
create or replace function public.journal_today_status()
returns jsonb
language sql
security invoker
stable
as $$
  select jsonb_build_object(
    'wrote_today', exists (
      select 1 from public.journal_entries e
      where e.user_id = auth.uid()
        and e.entry_date = (timezone('utc', now()))::date
    ),
    'entries_today', (
      select count(*)::int from public.journal_entries e
      where e.user_id = auth.uid()
        and e.entry_date = (timezone('utc', now()))::date
    ),
    'current_streak', coalesce((public.journal_streak()->>'current')::int, 0),
    'longest_streak', coalesce((public.journal_streak()->>'longest')::int, 0)
  );
$$;

grant execute on function public.journal_today_status() to authenticated;
