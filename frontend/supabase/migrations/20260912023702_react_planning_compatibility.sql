-- Additive planning schema. Does not replace or migrate existing Daybook records.
-- Apply only after the transactional access checks pass in a staging database.
begin;

create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  color text not null default '#22C55E' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  kind text not null default 'personal' check (kind in ('personal','work','group','focus')),
  group_id uuid references public.daybook_groups(id) on delete cascade,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  check ((kind='group') = (group_id is not null)),
  check (not is_default or kind='personal')
);
create unique index if not exists calendars_one_default on public.calendars(user_id) where is_default;
create index if not exists calendars_owner on public.calendars(user_id);
create index if not exists calendars_group on public.calendars(group_id) where group_id is not null;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 300),
  notes text check (length(notes)<=20000),
  location_label text check (length(location_label)<=500),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  recur_rule text check (recur_rule in ('daily','weekly')),
  recur_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  check (ends_at is null or ends_at > starts_at),
  check (recur_until is null or (recur_rule is not null and recur_until >= (starts_at at time zone 'America/Vancouver')::date))
);
create index if not exists calendar_events_range on public.calendar_events(calendar_id,starts_at);
create index if not exists calendar_events_recurring on public.calendar_events(calendar_id,recur_until) where recur_rule is not null;
create index if not exists calendar_events_creator on public.calendar_events(user_id);

alter table public.calendars enable row level security;
alter table public.calendar_events enable row level security;
revoke all on public.calendars, public.calendar_events from anon, authenticated;
grant select, insert, update, delete on public.calendars, public.calendar_events to authenticated;

-- Reuse the live helper: checks auth.uid() against active Daybook membership.
drop policy if exists calendars_read on public.calendars;
drop policy if exists calendars_create on public.calendars;
drop policy if exists calendars_update on public.calendars;
drop policy if exists calendars_delete on public.calendars;
drop policy if exists events_read on public.calendar_events;
drop policy if exists events_create on public.calendar_events;
drop policy if exists events_update on public.calendar_events;
drop policy if exists events_delete on public.calendar_events;
create policy calendars_read on public.calendars for select to authenticated using (
  (group_id is null and user_id=(select auth.uid())) or
  (group_id is not null and cadens_private.member(group_id))
);
create policy calendars_create on public.calendars for insert to authenticated with check (
  user_id=(select auth.uid()) and (group_id is null or exists (
    select 1 from public.daybook_groups g where g.id=group_id and g.owner_id=(select auth.uid())
  ))
);
create policy calendars_update on public.calendars for update to authenticated
  using (user_id=(select auth.uid()) and (group_id is null or cadens_private.member(group_id)))
  with check (user_id=(select auth.uid()) and (group_id is null or cadens_private.member(group_id)));
create policy calendars_delete on public.calendars for delete to authenticated
  using (user_id=(select auth.uid()) and (group_id is null or cadens_private.member(group_id)));

-- A visible calendar grants approved members event editing, never membership administration.
create policy events_read on public.calendar_events for select to authenticated
  using (exists (select 1 from public.calendars c where c.id=calendar_id));
create policy events_create on public.calendar_events for insert to authenticated
  with check (user_id=(select auth.uid()) and exists (select 1 from public.calendars c where c.id=calendar_id));
create policy events_update on public.calendar_events for update to authenticated
  using (exists (select 1 from public.calendars c where c.id=calendar_id))
  with check (exists (select 1 from public.calendars c where c.id=calendar_id));
create policy events_delete on public.calendar_events for delete to authenticated
  using (exists (select 1 from public.calendars c where c.id=calendar_id));

create or replace function cadens_private.guard_calendar() returns trigger language plpgsql set search_path='' as $$
begin
  if new.id<>old.id or new.user_id<>old.user_id or new.group_id is distinct from old.group_id or new.is_default<>old.is_default then
    raise exception 'Calendar ownership and sharing cannot be changed' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists calendar_identity on public.calendars;
create trigger calendar_identity before update on public.calendars for each row execute function cadens_private.guard_calendar();

create or replace function cadens_private.guard_calendar_event() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' and (new.id<>old.id or new.user_id<>old.user_id or new.calendar_id<>old.calendar_id or new.created_at<>old.created_at) then
    raise exception 'Event creator and calendar cannot be changed' using errcode='42501';
  end if;
  new.updated_at=clock_timestamp(); new.updated_by=auth.uid();
  if tg_op='INSERT' then new.created_at=now(); end if;
  return new;
end $$;
drop trigger if exists calendar_event_identity on public.calendar_events;
create trigger calendar_event_identity before insert or update on public.calendar_events for each row execute function cadens_private.guard_calendar_event();
revoke all on function cadens_private.guard_calendar(), cadens_private.guard_calendar_event() from public,anon,authenticated;

create or replace function public.ensure_default_calendar() returns public.calendars
language plpgsql security invoker set search_path='' as $$
declare result public.calendars;
begin
  if auth.uid() is null then raise exception 'Login required' using errcode='42501'; end if;
  insert into public.calendars(user_id,name,is_default) values(auth.uid(),'Personal',true)
    on conflict (user_id) where is_default do nothing;
  select * into strict result from public.calendars where user_id=auth.uid() and is_default;
  return result;
end $$;

create or replace function public.list_calendar_events(p_from timestamptz,p_to timestamptz,p_calendar_id uuid default null)
returns table(id uuid,calendar_id uuid,title text,notes text,location_label text,starts_at timestamptz,ends_at timestamptz,all_day boolean,calendar_name text,calendar_color text,recur_rule text,recur_until date,updated_at timestamptz)
language sql stable security invoker set search_path='' as $$
  select e.id,e.calendar_id,e.title,e.notes,e.location_label,e.starts_at,e.ends_at,e.all_day,c.name,c.color,e.recur_rule,e.recur_until,e.updated_at
  from public.calendar_events e join public.calendars c on c.id=e.calendar_id
  where p_to>p_from and (p_calendar_id is null or c.id=p_calendar_id) and e.starts_at<p_to
    and (coalesce(e.ends_at,e.starts_at)>=p_from or
      (e.recur_rule is not null and (e.recur_until is null or e.recur_until>=((p_from-coalesce(e.ends_at-e.starts_at,interval '0')) at time zone 'America/Vancouver')::date)))
  order by e.starts_at,e.id;
$$;

create or replace function public.create_calendar_event(p_title text,p_starts_at timestamptz,p_ends_at timestamptz default null,
 p_all_day boolean default false,p_notes text default null,p_location_label text default null,p_calendar_id uuid default null,
 p_recur_rule text default null,p_recur_until date default null)
returns public.calendar_events language plpgsql security invoker set search_path='' as $$
declare cid uuid:=p_calendar_id; result public.calendar_events; cal public.calendars;
begin
  if cid is null then cal=public.ensure_default_calendar(); cid=cal.id; end if;
  insert into public.calendar_events(calendar_id,user_id,title,starts_at,ends_at,all_day,notes,location_label,recur_rule,recur_until)
    values(cid,auth.uid(),btrim(p_title),p_starts_at,p_ends_at,p_all_day,p_notes,p_location_label,p_recur_rule,p_recur_until)
    returning * into result;
  return result;
end $$;
revoke all on function public.ensure_default_calendar(), public.list_calendar_events(timestamptz,timestamptz,uuid),
 public.create_calendar_event(text,timestamptz,timestamptz,boolean,text,text,uuid,text,date) from public,anon;
grant execute on function public.ensure_default_calendar(), public.list_calendar_events(timestamptz,timestamptz,uuid),
 public.create_calendar_event(text,timestamptz,timestamptz,boolean,text,text,uuid,text,date) to authenticated;

commit;
