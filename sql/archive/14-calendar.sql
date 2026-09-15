-- Cadens v2 — Calendar (lightweight planner, Zapier-inspired essentials)
-- Multiple calendars/layers, events, day/week/month friendly queries.

create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8B5CF6',
  kind text not null default 'personal'
    check (kind in ('personal', 'work', 'group', 'focus')),
  group_id uuid, -- optional link to daybook group
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists calendars_user_idx on public.calendars (user_id);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  location_label text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  -- optional links into Cadens objects
  progress_post_id uuid,
  journal_entry_id uuid,
  idea_board_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_events_user_starts_idx
  on public.calendar_events (user_id, starts_at);
create index if not exists calendar_events_cal_starts_idx
  on public.calendar_events (calendar_id, starts_at);

alter table public.calendars enable row level security;
alter table public.calendar_events enable row level security;

drop policy if exists "Owner calendars" on public.calendars;
create policy "Owner calendars" on public.calendars for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Owner events" on public.calendar_events;
create policy "Owner events" on public.calendar_events for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.ensure_default_calendar()
returns public.calendars
language plpgsql
security invoker
as $$
declare row public.calendars;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into row from public.calendars
  where user_id = auth.uid() and is_default limit 1;
  if row.id is not null then return row; end if;
  insert into public.calendars (user_id, name, color, kind, is_default)
  values (auth.uid(), 'Personal', '#8B5CF6', 'personal', true)
  returning * into row;
  return row;
end;
$$;

create or replace function public.create_calendar_event(
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz default null,
  p_all_day boolean default false,
  p_notes text default null,
  p_location_label text default null,
  p_calendar_id uuid default null
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

  insert into public.calendar_events (
    calendar_id, user_id, title, notes, location_label, starts_at, ends_at, all_day
  ) values (
    cid, auth.uid(), trim(p_title), nullif(trim(p_notes), ''), nullif(trim(p_location_label), ''),
    p_starts_at, p_ends_at, coalesce(p_all_day, false)
  ) returning * into row;
  return row;
end;
$$;

-- Events in a range (for month/week/day views)
create or replace function public.list_calendar_events(
  p_from timestamptz,
  p_to timestamptz,
  p_calendar_id uuid default null
)
returns table (
  id uuid,
  calendar_id uuid,
  title text,
  notes text,
  location_label text,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  calendar_name text,
  calendar_color text
)
language sql
security invoker
stable
as $$
  select
    e.id,
    e.calendar_id,
    e.title,
    e.notes,
    e.location_label,
    e.starts_at,
    e.ends_at,
    e.all_day,
    c.name as calendar_name,
    c.color as calendar_color
  from public.calendar_events e
  join public.calendars c on c.id = e.calendar_id
  where e.user_id = auth.uid()
    and e.starts_at < p_to
    and coalesce(e.ends_at, e.starts_at) >= p_from
    and (p_calendar_id is null or e.calendar_id = p_calendar_id)
  order by e.starts_at;
$$;

-- Upcoming (next N days) for widgets
create or replace function public.list_upcoming_events(p_days int default 7, p_limit int default 20)
returns setof public.calendar_events
language sql
security invoker
stable
as $$
  select e.*
  from public.calendar_events e
  where e.user_id = auth.uid()
    and e.starts_at >= now() - interval '1 hour'
    and e.starts_at <= now() + (least(coalesce(p_days, 7), 60) || ' days')::interval
  order by e.starts_at
  limit least(coalesce(p_limit, 20), 50);
$$;

grant execute on function public.ensure_default_calendar() to authenticated;
grant execute on function public.create_calendar_event(text, timestamptz, timestamptz, boolean, text, text, uuid) to authenticated;
grant execute on function public.list_calendar_events(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.list_upcoming_events(int, int) to authenticated;
