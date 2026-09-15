-- Cadens v2: Saves (memory) + keyword/AI search foundation
-- Run after 05-group-chats.sql

begin;

create table if not exists public.cadens_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('link', 'note', 'image')),
  title text check (title is null or char_length(title) <= 300),
  body text check (body is null or char_length(body) <= 8000),
  url text check (url is null or char_length(url) <= 2000),
  domain text,
  image_path text,
  collection text check (collection is null or char_length(collection) <= 60),
  ai_summary text check (ai_summary is null or char_length(ai_summary) <= 1000),
  -- search document (title + body + summary + domain) maintained by trigger/app
  search_text text,
  -- optional embedding as float array JSON until pgvector enabled
  embedding_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cadens_saves_user_created
  on public.cadens_saves (user_id, created_at desc);

create index if not exists cadens_saves_user_collection
  on public.cadens_saves (user_id, collection);

create index if not exists cadens_saves_search
  on public.cadens_saves using gin (to_tsvector('english', coalesce(search_text, '')));

alter table public.cadens_saves enable row level security;

revoke all on public.cadens_saves from anon, authenticated;
grant select, insert, update, delete on public.cadens_saves to authenticated;

create policy cadens_saves_own on public.cadens_saves
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- List saves (newest first), optional collection filter
create or replace function public.cadens_saves_list(p_collection text default null, p_limit int default 50)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(s) order by s.created_at desc)
    from (
      select
        id, kind, title, body, url, domain, image_path, collection,
        ai_summary, created_at, updated_at
      from public.cadens_saves
      where user_id = u
        and (p_collection is null or p_collection = '' or collection = p_collection)
      order by created_at desc
      limit least(coalesce(p_limit, 50), 100)
    ) s
  ), '[]'::jsonb);
end;
$$;

-- Keyword search (full-text + ilike fallback)
create or replace function public.cadens_saves_search(p_query text, p_limit int default 30)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  q text := btrim(coalesce(p_query, ''));
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  if char_length(q) < 1 then
    return public.cadens_saves_list(null, p_limit);
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(s) order by s.rank desc, s.created_at desc)
    from (
      select
        id, kind, title, body, url, domain, image_path, collection,
        ai_summary, created_at, updated_at,
        ts_rank(
          to_tsvector('english', coalesce(search_text, '')),
          plainto_tsquery('english', q)
        ) as rank
      from public.cadens_saves
      where user_id = u
        and (
          to_tsvector('english', coalesce(search_text, '')) @@ plainto_tsquery('english', q)
          or search_text ilike '%' || q || '%'
          or title ilike '%' || q || '%'
          or body ilike '%' || q || '%'
          or url ilike '%' || q || '%'
          or coalesce(ai_summary, '') ilike '%' || q || '%'
        )
      order by rank desc, created_at desc
      limit least(coalesce(p_limit, 30), 50)
    ) s
  ), '[]'::jsonb);
end;
$$;

-- Create save
create or replace function public.cadens_save_create(
  p_kind text,
  p_title text default null,
  p_body text default null,
  p_url text default null,
  p_domain text default null,
  p_image_path text default null,
  p_collection text default null,
  p_ai_summary text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  new_id uuid;
  st text;
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  if p_kind not in ('link', 'note', 'image') then
    raise exception 'Invalid kind';
  end if;

  st := trim(both ' ' from concat_ws(' ', p_title, p_body, p_ai_summary, p_domain, p_url));

  insert into public.cadens_saves (
    user_id, kind, title, body, url, domain, image_path, collection, ai_summary, search_text
  ) values (
    u,
    p_kind,
    nullif(left(btrim(coalesce(p_title, '')), 300), ''),
    nullif(left(btrim(coalesce(p_body, '')), 8000), ''),
    nullif(left(btrim(coalesce(p_url, '')), 2000), ''),
    nullif(left(btrim(coalesce(p_domain, '')), 200), ''),
    p_image_path,
    nullif(left(btrim(coalesce(p_collection, '')), 60), ''),
    nullif(left(btrim(coalesce(p_ai_summary, '')), 1000), ''),
    st
  )
  returning id into new_id;

  return (
    select row_to_json(s)::jsonb
    from (
      select id, kind, title, body, url, domain, image_path, collection, ai_summary, created_at, updated_at
      from public.cadens_saves where id = new_id
    ) s
  );
end;
$$;

create or replace function public.cadens_save_delete(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  delete from public.cadens_saves where id = p_id and user_id = u;
end;
$$;

create or replace function public.cadens_save_update(
  p_id uuid,
  p_title text default null,
  p_body text default null,
  p_collection text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;

  update public.cadens_saves
  set
    title = coalesce(nullif(left(btrim(coalesce(p_title, '')), 300), ''), title),
    body = coalesce(nullif(left(btrim(coalesce(p_body, '')), 8000), ''), body),
    collection = case when p_collection is null then collection else nullif(left(btrim(p_collection), 60), '') end,
    search_text = trim(both ' ' from concat_ws(' ',
      coalesce(nullif(left(btrim(coalesce(p_title, '')), 300), ''), title),
      coalesce(nullif(left(btrim(coalesce(p_body, '')), 8000), ''), body),
      ai_summary, domain, url
    )),
    updated_at = now()
  where id = p_id and user_id = u;

  return (
    select row_to_json(s)::jsonb
    from (
      select id, kind, title, body, url, domain, image_path, collection, ai_summary, created_at, updated_at
      from public.cadens_saves where id = p_id and user_id = u
    ) s
  );
end;
$$;

-- Store embedding JSON for AI search (client/edge fills this)
create or replace function public.cadens_save_set_embedding(p_id uuid, p_embedding jsonb, p_summary text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  update public.cadens_saves
  set
    embedding_json = p_embedding,
    ai_summary = coalesce(nullif(left(btrim(coalesce(p_summary, '')), 1000), ''), ai_summary),
    search_text = trim(both ' ' from concat_ws(' ', title, body, coalesce(nullif(left(btrim(coalesce(p_summary, '')), 1000), ''), ai_summary), domain, url)),
    updated_at = now()
  where id = p_id and user_id = u;
end;
$$;

-- Semantic-ish search: rank by simple overlap if embeddings missing; edge can replace later
create or replace function public.cadens_saves_search_ai(p_query text, p_limit int default 20)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Until vector index is live, reuse enhanced keyword search
  return public.cadens_saves_search(p_query, p_limit);
end;
$$;

revoke all on function public.cadens_saves_list(text, int) from public, anon;
revoke all on function public.cadens_saves_search(text, int) from public, anon;
revoke all on function public.cadens_save_create(text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.cadens_save_delete(uuid) from public, anon;
revoke all on function public.cadens_save_update(uuid, text, text, text) from public, anon;
revoke all on function public.cadens_save_set_embedding(uuid, jsonb, text) from public, anon;
revoke all on function public.cadens_saves_search_ai(text, int) from public, anon;

grant execute on function public.cadens_saves_list(text, int) to authenticated;
grant execute on function public.cadens_saves_search(text, int) to authenticated;
grant execute on function public.cadens_save_create(text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.cadens_save_delete(uuid) to authenticated;
grant execute on function public.cadens_save_update(uuid, text, text, text) to authenticated;
grant execute on function public.cadens_save_set_embedding(uuid, jsonb, text) to authenticated;
grant execute on function public.cadens_saves_search_ai(text, int) to authenticated;

commit;
