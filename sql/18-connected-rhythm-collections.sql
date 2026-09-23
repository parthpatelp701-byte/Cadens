-- Connected Rhythm collection contract.
-- Run after 17-builder-dna-read.sql.
-- This keeps the proven daybook_records JSON store as the Phase A backend
-- while explicitly allowing the PRD v5 collections needed for Habits,
-- Focus, Mood, and badges.

begin;

create or replace function public.daybook_load()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  u uuid := auth.uid();
  r bigint;
begin
  if u is null then raise exception 'Login required' using errcode='42501'; end if;

  insert into public.daybook_accounts(user_id) values(u) on conflict do nothing;
  insert into public.daybook_revisions(user_id) values(u) on conflict do nothing;
  select revision into r from public.daybook_revisions where user_id = u;

  return jsonb_build_object(
    'revision', r,
    'settings', coalesce((select settings from public.daybook_accounts where user_id = u), '{}'::jsonb),
    'records', coalesce((
      select jsonb_agg(
        jsonb_build_object('collection', collection, 'id', id, 'payload', payload)
        order by updated_at desc
      )
      from public.daybook_records
      where owner_id = u
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.daybook_load() to authenticated;

create or replace function public.daybook_sync(
  expected bigint,
  changes jsonb,
  preferences jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  u uuid := auth.uid();
  current_rev bigint;
  c jsonb;
  p jsonb;
  v_collection text;
  v_record_id text;
  allowed text[] := array[
    'tasks',
    'events',
    'posts',
    'notes',
    'places',
    'lists',
    'links',
    'habits',
    'reviews',
    'log',
    'focus_sessions',
    'mood_checkins',
    'badges'
  ];
begin
  if u is null then raise exception 'Login required' using errcode='42501'; end if;
  if jsonb_typeof(changes) <> 'array' then raise exception 'changes must be an array'; end if;
  if coalesce(jsonb_typeof(preferences), 'null') <> 'object' then raise exception 'preferences must be an object'; end if;

  insert into public.daybook_accounts(user_id, settings) values(u, coalesce(preferences, '{}'::jsonb))
    on conflict (user_id) do update set settings = coalesce(preferences, '{}'::jsonb), updated_at = now();
  insert into public.daybook_revisions(user_id) values(u) on conflict do nothing;
  select revision into current_rev from public.daybook_revisions where user_id = u for update;
  if current_rev <> expected then raise exception 'Revision conflict: expected %, current %', expected, current_rev using errcode='40001'; end if;

  for c in select value from jsonb_array_elements(changes) loop
    v_collection := coalesce(c->>'collection', '');
    v_record_id := nullif(c->>'id', '');
    if v_collection <> all(allowed) or v_record_id is null then raise exception 'Invalid record'; end if;

    if coalesce((c->>'deleted')::boolean, false) then
      delete from public.daybook_records
      where owner_id = u and id = v_record_id and collection = v_collection;
      continue;
    end if;

    p := coalesce(c->'payload', '{}'::jsonb);
    if jsonb_typeof(p) <> 'object' then raise exception 'payload must be an object'; end if;
    if char_length(p::text) > 100000 then raise exception 'payload too large'; end if;

    if v_collection = 'posts' then
      if char_length(coalesce(p->>'text', '')) > 10000 then raise exception 'Post text too long'; end if;
      if p->>'privacy' not in ('private', 'group', 'circle') then raise exception 'Invalid post privacy'; end if;
      if p->>'privacy' = 'group' then
        if nullif(p->>'groupId', '') is null or not exists (
          select 1
          from public.daybook_members m
          where m.group_id = (p->>'groupId')::uuid
            and m.user_id = u
            and m.status = 'active'
        ) then
          raise exception 'You must be an active group member';
        end if;
      end if;
    end if;

    insert into public.daybook_records(owner_id, id, collection, payload, created_at, updated_at)
      values(u, v_record_id, v_collection, p, coalesce((p->>'created_at')::timestamptz, now()), now())
      on conflict (owner_id, id) do update
        set collection = excluded.collection,
            payload = excluded.payload,
            updated_at = now();
  end loop;

  update public.daybook_revisions
    set revision = revision + 1, updated_at = now()
    where user_id = u
    returning revision into current_rev;
  return current_rev;
end;
$$;

grant execute on function public.daybook_sync(bigint, jsonb, jsonb) to authenticated;

commit;
