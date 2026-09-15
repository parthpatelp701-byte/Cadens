-- Cadens v2 — Tasks + calendar sync
-- Timed tasks create a linked calendar_event so they appear on Plan.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  status text not null default 'open'
    check (status in ('open', 'done', 'cancelled')),
  due_at timestamptz,
  all_day boolean not null default false,
  calendar_event_id uuid references public.calendar_events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_status_idx on public.tasks (user_id, status);
create index if not exists tasks_user_due_idx on public.tasks (user_id, due_at);

-- Link events back to tasks
alter table public.calendar_events
  add column if not exists task_id uuid references public.tasks(id) on delete set null;

alter table public.tasks enable row level security;

drop policy if exists "Owner tasks" on public.tasks;
create policy "Owner tasks" on public.tasks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Create task; if due_at set, also create calendar event and link both ways
create or replace function public.create_task(
  p_title text,
  p_notes text default null,
  p_due_at timestamptz default null,
  p_all_day boolean default false
)
returns public.tasks
language plpgsql
security invoker
as $$
declare
  t public.tasks;
  ev public.calendar_events;
  cid uuid;
  ends timestamptz;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if trim(p_title) = '' then raise exception 'Title required'; end if;

  insert into public.tasks (user_id, title, notes, due_at, all_day)
  values (
    auth.uid(),
    trim(p_title),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_due_at,
    coalesce(p_all_day, false)
  )
  returning * into t;

  if p_due_at is not null then
    cid := (select id from public.ensure_default_calendar());
    ends := case
      when coalesce(p_all_day, false) then p_due_at + interval '1 day'
      else p_due_at + interval '30 minutes'
    end;

    insert into public.calendar_events (
      calendar_id, user_id, title, notes, starts_at, ends_at, all_day, task_id
    ) values (
      cid,
      auth.uid(),
      trim(p_title),
      nullif(trim(coalesce(p_notes, '')), ''),
      p_due_at,
      ends,
      coalesce(p_all_day, false),
      t.id
    )
    returning * into ev;

    update public.tasks
    set calendar_event_id = ev.id, updated_at = now()
    where id = t.id
    returning * into t;
  end if;

  return t;
end;
$$;

create or replace function public.list_tasks(
  p_status text default null,
  p_limit int default 50
)
returns setof public.tasks
language sql
security invoker
stable
as $$
  select *
  from public.tasks
  where user_id = auth.uid()
    and (p_status is null or status = p_status)
  order by
    case when status = 'open' then 0 else 1 end,
    due_at nulls last,
    created_at desc
  limit least(coalesce(p_limit, 50), 100);
$$;

create or replace function public.set_task_status(
  p_task_id uuid,
  p_status text
)
returns public.tasks
language plpgsql
security invoker
as $$
declare
  t public.tasks;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_status not in ('open', 'done', 'cancelled') then
    raise exception 'Invalid status';
  end if;

  update public.tasks
  set status = p_status, updated_at = now()
  where id = p_task_id and user_id = auth.uid()
  returning * into t;

  if t.id is null then raise exception 'Task not found'; end if;

  -- Keep calendar title prefix when done (soft signal); do not delete event
  if t.calendar_event_id is not null and p_status = 'done' then
    update public.calendar_events
    set title = case
      when title like '✓ %' then title
      else '✓ ' || title
    end,
    updated_at = now()
    where id = t.calendar_event_id and user_id = auth.uid();
  end if;

  if t.calendar_event_id is not null and p_status = 'open' then
    update public.calendar_events
    set title = regexp_replace(title, '^✓\s*', ''),
        updated_at = now()
    where id = t.calendar_event_id and user_id = auth.uid();
  end if;

  return t;
end;
$$;

create or replace function public.delete_task(p_task_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  eid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select calendar_event_id into eid
  from public.tasks
  where id = p_task_id and user_id = auth.uid();

  delete from public.tasks
  where id = p_task_id and user_id = auth.uid();

  -- Remove linked calendar event so Plan stays accurate
  if eid is not null then
    delete from public.calendar_events
    where id = eid and user_id = auth.uid();
  end if;
end;
$$;

grant execute on function public.create_task(text, text, timestamptz, boolean) to authenticated;
grant execute on function public.list_tasks(text, int) to authenticated;
grant execute on function public.set_task_status(uuid, text) to authenticated;
grant execute on function public.delete_task(uuid) to authenticated;

-- Update task; sync calendar event (create / update / remove)
create or replace function public.update_task(
  p_task_id uuid,
  p_title text default null,
  p_notes text default null,
  p_due_at timestamptz default null,
  p_clear_due boolean default false,
  p_all_day boolean default null
)
returns public.tasks
language plpgsql
security invoker
as $$
declare
  t public.tasks;
  ev_id uuid;
  cid uuid;
  new_title text;
  new_notes text;
  new_due timestamptz;
  new_all_day boolean;
  ends timestamptz;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into t from public.tasks where id = p_task_id and user_id = auth.uid();
  if t.id is null then raise exception 'Task not found'; end if;

  new_title := coalesce(nullif(trim(p_title), ''), t.title);
  new_notes := case when p_notes is null then t.notes else nullif(trim(p_notes), '') end;
  new_all_day := coalesce(p_all_day, t.all_day);

  if p_clear_due then
    new_due := null;
  elsif p_due_at is not null then
    new_due := p_due_at;
  else
    new_due := t.due_at;
  end if;

  update public.tasks
  set
    title = new_title,
    notes = new_notes,
    due_at = new_due,
    all_day = coalesce(new_all_day, false),
    updated_at = now()
  where id = t.id
  returning * into t;

  ev_id := t.calendar_event_id;

  -- Clear due: remove linked event
  if new_due is null and ev_id is not null then
    delete from public.calendar_events where id = ev_id and user_id = auth.uid();
    update public.tasks set calendar_event_id = null, updated_at = now() where id = t.id returning * into t;
    return t;
  end if;

  if new_due is not null then
    ends := case
      when coalesce(new_all_day, false) then new_due + interval '1 day'
      else new_due + interval '30 minutes'
    end;

    if ev_id is not null then
      update public.calendar_events
      set
        title = case when t.status = 'done' and new_title not like '✓ %' then '✓ ' || new_title else new_title end,
        notes = new_notes,
        starts_at = new_due,
        ends_at = ends,
        all_day = coalesce(new_all_day, false),
        updated_at = now()
      where id = ev_id and user_id = auth.uid();
    else
      cid := (select id from public.ensure_default_calendar());
      insert into public.calendar_events (
        calendar_id, user_id, title, notes, starts_at, ends_at, all_day, task_id
      ) values (
        cid, auth.uid(),
        case when t.status = 'done' then '✓ ' || new_title else new_title end,
        new_notes, new_due, ends, coalesce(new_all_day, false), t.id
      ) returning id into ev_id;
      update public.tasks set calendar_event_id = ev_id, updated_at = now() where id = t.id returning * into t;
    end if;
  end if;

  return t;
end;
$$;

grant execute on function public.update_task(uuid, text, text, timestamptz, boolean, boolean) to authenticated;
