-- Cadens v2 — Nearby Productive Peers
-- GitHub-backed productivity tier + opt-in coarse location discovery sessions

-- Productivity tiers derived from GitHub (and optional Cadens activity later)
-- spark < builder < shipper < architect
create table if not exists public.productivity_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  github_username text,
  github_score int not null default 0,
  tier text not null default 'spark'
    check (tier in ('spark', 'builder', 'shipper', 'architect')),
  bio_line text,
  -- Coarse location only while discovery session is active (privacy)
  session_active boolean not null default false,
  coarse_lat double precision,
  coarse_lng double precision,
  session_radius_m int not null default 2000
    check (session_radius_m between 200 and 50000),
  session_started_at timestamptz,
  session_expires_at timestamptz,
  discoverable boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists productivity_profiles_tier_idx
  on public.productivity_profiles (tier);
create index if not exists productivity_profiles_session_idx
  on public.productivity_profiles (session_active, session_expires_at)
  where session_active = true;

alter table public.productivity_profiles enable row level security;

drop policy if exists "Users manage own productivity profile" on public.productivity_profiles;
create policy "Users manage own productivity profile"
  on public.productivity_profiles for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Others can read limited public fields of active sessions only via RPC (not direct table)

-- Upsert GitHub-derived tier
create or replace function public.upsert_productivity_profile(
  p_github_username text,
  p_github_score int,
  p_tier text,
  p_bio_line text default null
)
returns public.productivity_profiles
language plpgsql
security invoker
as $$
declare
  row public.productivity_profiles;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_tier not in ('spark', 'builder', 'shipper', 'architect') then
    raise exception 'Invalid tier';
  end if;

  insert into public.productivity_profiles as p (
    user_id, github_username, github_score, tier, bio_line, last_synced_at, updated_at
  ) values (
    auth.uid(),
    lower(trim(p_github_username)),
    greatest(0, p_github_score),
    p_tier,
    nullif(trim(p_bio_line), ''),
    now(),
    now()
  )
  on conflict (user_id) do update set
    github_username = excluded.github_username,
    github_score = excluded.github_score,
    tier = excluded.tier,
    bio_line = coalesce(excluded.bio_line, p.bio_line),
    last_synced_at = now(),
    updated_at = now()
  returning * into row;

  return row;
end;
$$;

-- Start / refresh discovery session with coarse location
create or replace function public.start_discovery_session(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int default 2000,
  p_duration_minutes int default 60
)
returns public.productivity_profiles
language plpgsql
security invoker
as $$
declare
  row public.productivity_profiles;
  -- Round to ~1.1km grid (2 decimal degrees ≈ 1.1km)
  clat double precision := round(p_lat::numeric, 2)::double precision;
  clng double precision := round(p_lng::numeric, 2)::double precision;
  rad int := least(50000, greatest(200, coalesce(p_radius_m, 2000)));
  dur int := least(240, greatest(15, coalesce(p_duration_minutes, 60)));
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  insert into public.productivity_profiles as p (
    user_id, session_active, coarse_lat, coarse_lng, session_radius_m,
    session_started_at, session_expires_at, discoverable, updated_at
  ) values (
    auth.uid(), true, clat, clng, rad,
    now(), now() + (dur || ' minutes')::interval, true, now()
  )
  on conflict (user_id) do update set
    session_active = true,
    coarse_lat = excluded.coarse_lat,
    coarse_lng = excluded.coarse_lng,
    session_radius_m = excluded.session_radius_m,
    session_started_at = now(),
    session_expires_at = now() + (dur || ' minutes')::interval,
    discoverable = true,
    updated_at = now()
  returning * into row;

  return row;
end;
$$;

create or replace function public.stop_discovery_session()
returns void
language plpgsql
security invoker
as $$
begin
  if auth.uid() is null then return; end if;
  update public.productivity_profiles
  set session_active = false,
      coarse_lat = null,
      coarse_lng = null,
      session_expires_at = now(),
      updated_at = now()
  where user_id = auth.uid();
end;
$$;

-- Haversine distance in meters
create or replace function public.haversine_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Find nearby peers with similar productivity tier
create or replace function public.find_nearby_peers(limit_count int default 30)
returns table (
  user_id uuid,
  display_name text,
  github_username text,
  tier text,
  github_score int,
  bio_line text,
  distance_m double precision,
  tier_match text
)
language plpgsql
security invoker
stable
as $$
declare
  me public.productivity_profiles;
  tier_rank int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into me from public.productivity_profiles where user_id = auth.uid();
  if me is null or not me.session_active or me.session_expires_at < now() then
    raise exception 'Start a discovery session first';
  end if;
  if me.coarse_lat is null or me.coarse_lng is null then
    raise exception 'Location required';
  end if;

  tier_rank := case me.tier
    when 'spark' then 1 when 'builder' then 2 when 'shipper' then 3 when 'architect' then 4
    else 1 end;

  return query
  select
    p.user_id,
    coalesce(d.display_name, p.github_username, 'Builder') as display_name,
    p.github_username,
    p.tier,
    p.github_score,
    p.bio_line,
    public.haversine_m(me.coarse_lat, me.coarse_lng, p.coarse_lat, p.coarse_lng) as distance_m,
    case
      when p.tier = me.tier then 'same'
      when abs(
        (case p.tier when 'spark' then 1 when 'builder' then 2 when 'shipper' then 3 when 'architect' then 4 else 1 end)
        - tier_rank
      ) = 1 then 'adjacent'
      else 'other'
    end as tier_match
  from public.productivity_profiles p
  left join public.user_discovery d on d.user_id = p.user_id
  where p.user_id is distinct from auth.uid()
    and p.session_active = true
    and p.discoverable = true
    and p.session_expires_at > now()
    and p.coarse_lat is not null
    and p.coarse_lng is not null
    and public.haversine_m(me.coarse_lat, me.coarse_lng, p.coarse_lat, p.coarse_lng)
        <= greatest(me.session_radius_m, p.session_radius_m)
    -- Prefer similar tier: same or adjacent
    and abs(
      (case p.tier when 'spark' then 1 when 'builder' then 2 when 'shipper' then 3 when 'architect' then 4 else 1 end)
      - tier_rank
    ) <= 1
  order by
    abs(
      (case p.tier when 'spark' then 1 when 'builder' then 2 when 'shipper' then 3 when 'architect' then 4 else 1 end)
      - tier_rank
    ),
    distance_m
  limit limit_count;
end;
$$;

grant execute on function public.upsert_productivity_profile(text, int, text, text) to authenticated;
grant execute on function public.start_discovery_session(double precision, double precision, int, int) to authenticated;
grant execute on function public.stop_discovery_session() to authenticated;
grant execute on function public.find_nearby_peers(int) to authenticated;
grant execute on function public.haversine_m(double precision, double precision, double precision, double precision) to authenticated;
