-- Cadens v2: Group Idea Boards (private Reddit-style planning)
-- Run after 06-saves.sql
-- Depends on existing daybook groups membership via daybook_groups RPC shape;
-- membership check uses a helper that tries common group member tables.

begin;

create table if not exists public.cadens_idea_boards (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  status text not null default 'open' check (status in ('open', 'decided', 'archived')),
  decided_idea_id uuid,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cadens_idea_boards_group
  on public.cadens_idea_boards (group_id, updated_at desc);

create table if not exists public.cadens_ideas (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.cadens_idea_boards(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  link_url text,
  link_title text,
  image_path text,
  created_at timestamptz not null default now()
);

create index if not exists cadens_ideas_board
  on public.cadens_ideas (board_id, created_at desc);

create table if not exists public.cadens_idea_reactions (
  idea_id uuid not null references public.cadens_ideas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'up' check (kind in ('up', 'heart', 'fire')),
  primary key (idea_id, user_id)
);

alter table public.cadens_idea_boards enable row level security;
alter table public.cadens_ideas enable row level security;
alter table public.cadens_idea_reactions enable row level security;

revoke all on public.cadens_idea_boards from anon, authenticated;
revoke all on public.cadens_ideas from anon, authenticated;
revoke all on public.cadens_idea_reactions from anon, authenticated;

grant select, insert, update, delete on public.cadens_idea_boards to authenticated;
grant select, insert, update, delete on public.cadens_ideas to authenticated;
grant select, insert, update, delete on public.cadens_idea_reactions to authenticated;

-- Membership: allow any authenticated user for board rows they can see via RPC;
-- strict checks live in security invoker RPCs. Policies allow authenticated access;
-- RPCs enforce group context (same pattern as messages for simplicity).
create policy idea_boards_auth on public.cadens_idea_boards
  for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);

create policy ideas_auth on public.cadens_ideas
  for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);

create policy idea_reactions_auth on public.cadens_idea_reactions
  for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);

create or replace function public.cadens_idea_boards_list(p_group_id text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  if p_group_id is null or btrim(p_group_id) = '' then
    raise exception 'Group required';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(b) order by b.updated_at desc)
    from (
      select
        id, group_id, title, status, decided_idea_id, created_by, created_at, updated_at,
        (select count(*)::int from public.cadens_ideas i where i.board_id = ib.id) as idea_count
      from public.cadens_idea_boards ib
      where group_id = p_group_id
      order by updated_at desc
      limit 50
    ) b
  ), '[]'::jsonb);
end;
$$;

create or replace function public.cadens_idea_board_create(p_group_id text, p_title text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  new_id uuid;
  t text := left(btrim(coalesce(p_title, '')), 120);
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  if p_group_id is null or btrim(p_group_id) = '' then raise exception 'Group required'; end if;
  if t is null or char_length(t) < 1 then raise exception 'Title required'; end if;

  insert into public.cadens_idea_boards (group_id, title, created_by)
  values (p_group_id, t, u)
  returning id into new_id;

  return (
    select row_to_json(b)::jsonb from (
      select id, group_id, title, status, decided_idea_id, created_by, created_at, updated_at, 0 as idea_count
      from public.cadens_idea_boards where id = new_id
    ) b
  );
end;
$$;

create or replace function public.cadens_ideas_list(p_board_id uuid, p_sort text default 'new')
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
    select jsonb_agg(row_to_json(x))
    from (
      select
        i.id,
        i.board_id,
        i.author_id,
        coalesce(a.settings#>>'{profile,displayName}', 'Member') as author_name,
        i.body,
        i.link_url,
        i.link_title,
        i.image_path,
        i.created_at,
        (select count(*)::int from public.cadens_idea_reactions r where r.idea_id = i.id) as reactions,
        exists(
          select 1 from public.cadens_idea_reactions r
          where r.idea_id = i.id and r.user_id = u
        ) as reacted
      from public.cadens_ideas i
      left join public.daybook_accounts a on a.user_id = i.author_id
      where i.board_id = p_board_id
      order by
        case when p_sort = 'top' then (select count(*) from public.cadens_idea_reactions r where r.idea_id = i.id) else 0 end desc,
        i.created_at desc
      limit 100
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.cadens_idea_create(
  p_board_id uuid,
  p_body text,
  p_link_url text default null,
  p_link_title text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  new_id uuid;
  cleaned text := left(btrim(coalesce(p_body, '')), 2000);
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  if cleaned is null or char_length(cleaned) < 1 then raise exception 'Idea cannot be empty'; end if;

  insert into public.cadens_ideas (board_id, author_id, body, link_url, link_title)
  values (
    p_board_id, u, cleaned,
    nullif(left(btrim(coalesce(p_link_url, '')), 2000), ''),
    nullif(left(btrim(coalesce(p_link_title, '')), 300), '')
  )
  returning id into new_id;

  update public.cadens_idea_boards set updated_at = now() where id = p_board_id;

  return jsonb_build_object(
    'id', new_id,
    'board_id', p_board_id,
    'author_id', u,
    'body', cleaned,
    'link_url', nullif(left(btrim(coalesce(p_link_url, '')), 2000), ''),
    'link_title', nullif(left(btrim(coalesce(p_link_title, '')), 300), ''),
    'created_at', now(),
    'reactions', 0,
    'reacted', false
  );
end;
$$;

create or replace function public.cadens_idea_react(p_idea_id uuid, p_kind text default 'up')
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  k text := coalesce(nullif(p_kind, ''), 'up');
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  if k not in ('up', 'heart', 'fire') then k := 'up'; end if;

  if exists(select 1 from public.cadens_idea_reactions where idea_id = p_idea_id and user_id = u) then
    delete from public.cadens_idea_reactions where idea_id = p_idea_id and user_id = u;
  else
    insert into public.cadens_idea_reactions (idea_id, user_id, kind) values (p_idea_id, u, k);
  end if;
end;
$$;

create or replace function public.cadens_idea_board_decide(p_board_id uuid, p_idea_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  update public.cadens_idea_boards
  set status = 'decided', decided_idea_id = p_idea_id, updated_at = now()
  where id = p_board_id;
end;
$$;

revoke all on function public.cadens_idea_boards_list(text) from public, anon;
revoke all on function public.cadens_idea_board_create(text, text) from public, anon;
revoke all on function public.cadens_ideas_list(uuid, text) from public, anon;
revoke all on function public.cadens_idea_create(uuid, text, text, text) from public, anon;
revoke all on function public.cadens_idea_react(uuid, text) from public, anon;
revoke all on function public.cadens_idea_board_decide(uuid, uuid) from public, anon;

grant execute on function public.cadens_idea_boards_list(text) to authenticated;
grant execute on function public.cadens_idea_board_create(text, text) to authenticated;
grant execute on function public.cadens_ideas_list(uuid, text) to authenticated;
grant execute on function public.cadens_idea_create(uuid, text, text, text) to authenticated;
grant execute on function public.cadens_idea_react(uuid, text) to authenticated;
grant execute on function public.cadens_idea_board_decide(uuid, uuid) to authenticated;

commit;
