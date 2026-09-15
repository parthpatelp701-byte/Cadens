-- Cadens v2 — Journal mode (Day One–inspired, private)
-- Owner-only RLS. Multiple journals, entries, tags, media, streaks helpers.

create table if not exists public.journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text default '#8B5CF6',
  icon text default 'book',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists journals_user_idx on public.journals (user_id);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  body text not null default '',
  entry_date date not null default (timezone('utc', now()))::date,
  is_favorite boolean not null default false,
  mood text check (mood is null or mood in ('great','good','ok','low','hard')),
  location_label text,
  coarse_lat double precision,
  coarse_lng double precision,
  weather_summary text,
  template_key text,
  word_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists journal_entries_user_date_idx
  on public.journal_entries (user_id, entry_date desc);
create index if not exists journal_entries_journal_idx
  on public.journal_entries (journal_id, entry_date desc);
create index if not exists journal_entries_favorite_idx
  on public.journal_entries (user_id) where is_favorite = true;
create index if not exists journal_entries_body_fts
  on public.journal_entries using gin (to_tsvector('english', coalesce(title,'') || ' ' || body));

create table if not exists public.journal_entry_media (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  media_type text not null default 'image' check (media_type in ('image','audio','video')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists journal_entry_media_entry_idx on public.journal_entry_media (entry_id);

create table if not exists public.journal_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  unique (user_id, name)
);

create table if not exists public.journal_entry_tags (
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  tag_id uuid not null references public.journal_tags(id) on delete cascade,
  primary key (entry_id, tag_id)
);

-- RLS: private to owner
alter table public.journals enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_entry_media enable row level security;
alter table public.journal_tags enable row level security;
alter table public.journal_entry_tags enable row level security;

drop policy if exists "Owner journals" on public.journals;
create policy "Owner journals" on public.journals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Owner entries" on public.journal_entries;
create policy "Owner entries" on public.journal_entries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Owner media" on public.journal_entry_media;
create policy "Owner media" on public.journal_entry_media for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Owner tags" on public.journal_tags;
create policy "Owner tags" on public.journal_tags for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Owner entry_tags" on public.journal_entry_tags;
create policy "Owner entry_tags" on public.journal_entry_tags for all to authenticated
  using (
    exists (select 1 from public.journal_entries e where e.id = entry_id and e.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.journal_entries e where e.id = entry_id and e.user_id = auth.uid())
  );

-- Ensure default journal
create or replace function public.ensure_default_journal()
returns public.journals
language plpgsql
security invoker
as $$
declare
  row public.journals;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into row from public.journals
  where user_id = auth.uid() and is_default = true limit 1;
  if row.id is not null then return row; end if;

  insert into public.journals (user_id, name, color, icon, is_default)
  values (auth.uid(), 'Personal', '#8B5CF6', 'book', true)
  returning * into row;
  return row;
end;
$$;

create or replace function public.create_journal(p_name text, p_color text default '#8B5CF6')
returns public.journals
language plpgsql
security invoker
as $$
declare row public.journals;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.journals (user_id, name, color)
  values (auth.uid(), trim(p_name), coalesce(p_color, '#8B5CF6'))
  returning * into row;
  return row;
end;
$$;

create or replace function public.create_journal_entry(
  p_journal_id uuid,
  p_body text,
  p_title text default null,
  p_entry_date date default null,
  p_mood text default null,
  p_location_label text default null,
  p_template_key text default null
)
returns public.journal_entries
language plpgsql
security invoker
as $$
declare
  row public.journal_entries;
  jid uuid := p_journal_id;
  words int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if jid is null then
    jid := (select id from public.ensure_default_journal());
  end if;
  if not exists (select 1 from public.journals j where j.id = jid and j.user_id = auth.uid()) then
    raise exception 'Journal not found' using errcode = '42501';
  end if;

  words := coalesce(array_length(regexp_split_to_array(trim(p_body), '\s+'), 1), 0);
  if trim(p_body) = '' then words := 0; end if;

  insert into public.journal_entries (
    journal_id, user_id, title, body, entry_date, mood, location_label, template_key, word_count
  ) values (
    jid, auth.uid(), nullif(trim(p_title), ''), coalesce(p_body, ''),
    coalesce(p_entry_date, (timezone('utc', now()))::date),
    p_mood, nullif(trim(p_location_label), ''), p_template_key, words
  ) returning * into row;
  return row;
end;
$$;

create or replace function public.list_journal_entries(
  p_journal_id uuid default null,
  p_limit int default 40,
  p_offset int default 0,
  p_query text default null
)
returns setof public.journal_entries
language sql
security invoker
stable
as $$
  select e.*
  from public.journal_entries e
  where e.user_id = auth.uid()
    and (p_journal_id is null or e.journal_id = p_journal_id)
    and (
      p_query is null or length(trim(p_query)) = 0
      or to_tsvector('english', coalesce(e.title,'') || ' ' || e.body)
         @@ plainto_tsquery('english', p_query)
      or e.body ilike '%' || p_query || '%'
      or coalesce(e.title,'') ilike '%' || p_query || '%'
    )
  order by e.entry_date desc, e.created_at desc
  limit least(coalesce(p_limit, 40), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- On This Day (same month-day in prior years)
create or replace function public.journal_on_this_day(p_date date default current_date)
returns setof public.journal_entries
language sql
security invoker
stable
as $$
  select e.*
  from public.journal_entries e
  where e.user_id = auth.uid()
    and extract(month from e.entry_date) = extract(month from p_date)
    and extract(day from e.entry_date) = extract(day from p_date)
    and e.entry_date < p_date
  order by e.entry_date desc
  limit 20;
$$;

-- Streak: consecutive days with ≥1 entry ending today or yesterday
create or replace function public.journal_streak()
returns jsonb
language plpgsql
security invoker
stable
as $$
declare
  d date;
  streak int := 0;
  longest int := 0;
  total int := 0;
  prev date;
  run int := 0;
  days date[];
  ordered date[];
begin
  select count(*) into total from public.journal_entries where user_id = auth.uid();
  select array_agg(distinct entry_date order by entry_date desc)
    into days
  from public.journal_entries
  where user_id = auth.uid();

  if days is null or coalesce(array_length(days, 1), 0) = 0 then
    return jsonb_build_object('current', 0, 'longest', 0, 'total_entries', 0);
  end if;

  -- current streak from most recent day
  if days[1] >= current_date - 1 then
    prev := days[1];
    streak := 1;
    for i in 2 .. array_length(days, 1) loop
      if days[i] = prev - 1 then
        streak := streak + 1;
        prev := days[i];
      else
        exit;
      end if;
    end loop;
  end if;

  -- longest streak (ascending)
  select array_agg(x order by x) into ordered from unnest(days) as x;
  prev := null;
  run := 0;
  foreach d in array ordered loop
    if prev is null or d = prev + 1 then
      run := run + 1;
    else
      if run > longest then longest := run; end if;
      run := 1;
    end if;
    prev := d;
  end loop;
  if run > longest then longest := run; end if;

  return jsonb_build_object(
    'current', streak,
    'longest', longest,
    'total_entries', total
  );
end;
$$;

-- Calendar heatmap data for a month
create or replace function public.journal_calendar_month(p_year int, p_month int)
returns table (entry_date date, entry_count bigint)
language sql
security invoker
stable
as $$
  select e.entry_date, count(*)::bigint
  from public.journal_entries e
  where e.user_id = auth.uid()
    and extract(year from e.entry_date) = p_year
    and extract(month from e.entry_date) = p_month
  group by e.entry_date
  order by e.entry_date;
$$;

grant execute on function public.ensure_default_journal() to authenticated;
grant execute on function public.create_journal(text, text) to authenticated;
grant execute on function public.create_journal_entry(uuid, text, text, date, text, text, text) to authenticated;
grant execute on function public.list_journal_entries(uuid, int, int, text) to authenticated;
grant execute on function public.journal_on_this_day(date) to authenticated;
grant execute on function public.journal_streak() to authenticated;
grant execute on function public.journal_calendar_month(int, int) to authenticated;
