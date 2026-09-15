-- Cadens v2 — Contact discovery (privacy-first)
-- Users opt in with hashed email/phone. Clients send only hashes; never raw contacts.

create table if not exists public.user_discovery (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Normalized SHA-256 hex digests (never store raw phone/email here)
  email_hash text,
  phone_hash text,
  display_name text,
  discoverable boolean not null default true,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_discovery_email_hash_idx
  on public.user_discovery (email_hash) where email_hash is not null and discoverable;
create index if not exists user_discovery_phone_hash_idx
  on public.user_discovery (phone_hash) where phone_hash is not null and discoverable;
create index if not exists user_discovery_last_active_idx
  on public.user_discovery (last_active_at desc);

alter table public.user_discovery enable row level security;

drop policy if exists "Users manage own discovery" on public.user_discovery;
create policy "Users manage own discovery"
  on public.user_discovery for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Upsert my discovery profile (opt-in)
create or replace function public.upsert_my_discovery(
  p_email_hash text default null,
  p_phone_hash text default null,
  p_display_name text default null,
  p_discoverable boolean default true
)
returns public.user_discovery
language plpgsql
security invoker
as $$
declare
  row public.user_discovery;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  insert into public.user_discovery as d (
    user_id, email_hash, phone_hash, display_name, discoverable, last_active_at, updated_at
  ) values (
    auth.uid(),
    nullif(lower(trim(p_email_hash)), ''),
    nullif(lower(trim(p_phone_hash)), ''),
    nullif(trim(p_display_name), ''),
    coalesce(p_discoverable, true),
    now(),
    now()
  )
  on conflict (user_id) do update set
    email_hash = coalesce(excluded.email_hash, d.email_hash),
    phone_hash = coalesce(excluded.phone_hash, d.phone_hash),
    display_name = coalesce(excluded.display_name, d.display_name),
    discoverable = excluded.discoverable,
    last_active_at = now(),
    updated_at = now()
  returning * into row;

  return row;
end;
$$;

-- Touch last_active (call periodically from client)
create or replace function public.touch_my_activity()
returns void
language plpgsql
security invoker
as $$
begin
  if auth.uid() is null then return; end if;
  update public.user_discovery
  set last_active_at = now(), updated_at = now()
  where user_id = auth.uid();
end;
$$;

-- Match contact hashes → registered, discoverable users (excludes self)
-- p_hashes: array of sha256 hex strings
create or replace function public.match_contact_hashes(p_hashes text[])
returns table (
  user_id uuid,
  display_name text,
  matched_via text,
  last_active_at timestamptz,
  is_active boolean
)
language sql
security invoker
stable
as $$
  select
    d.user_id,
    coalesce(d.display_name, 'Cadens user') as display_name,
    case
      when d.email_hash = any(p_hashes) and d.phone_hash = any(p_hashes) then 'both'
      when d.email_hash = any(p_hashes) then 'email'
      else 'phone'
    end as matched_via,
    d.last_active_at,
    (d.last_active_at > now() - interval '7 days') as is_active
  from public.user_discovery d
  where d.discoverable = true
    and d.user_id is distinct from auth.uid()
    and (
      (d.email_hash is not null and d.email_hash = any(p_hashes))
      or (d.phone_hash is not null and d.phone_hash = any(p_hashes))
    )
  order by d.last_active_at desc nulls last
  limit 100;
$$;

-- Active people you already share a group with (no contact access needed)
create or replace function public.list_active_group_peers(limit_count int default 20)
returns table (
  user_id uuid,
  display_name text,
  group_names text,
  last_active_at timestamptz
)
language sql
security invoker
stable
as $$
  with my_groups as (
    select m.group_id
    from public.daybook_members m
    where m.user_id = auth.uid() and m.status = 'active'
  ),
  peers as (
    select distinct m.user_id
    from public.daybook_members m
    where m.group_id in (select group_id from my_groups)
      and m.status = 'active'
      and m.user_id is distinct from auth.uid()
  )
  select
    p.user_id,
    coalesce(d.display_name, 'Member') as display_name,
    (
      select string_agg(distinct g.name, ', ')
      from public.daybook_members m2
      join public.daybook_groups g on g.id = m2.group_id
      where m2.user_id = p.user_id
        and m2.status = 'active'
        and m2.group_id in (select group_id from my_groups)
    ) as group_names,
    d.last_active_at
  from peers p
  left join public.user_discovery d on d.user_id = p.user_id
  order by d.last_active_at desc nulls last
  limit limit_count;
$$;

grant execute on function public.upsert_my_discovery(text, text, text, boolean) to authenticated;
grant execute on function public.touch_my_activity() to authenticated;
grant execute on function public.match_contact_hashes(text[]) to authenticated;
grant execute on function public.list_active_group_peers(int) to authenticated;
