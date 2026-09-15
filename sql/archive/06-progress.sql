-- Cadens v2 — Progress posts (Phase 3)
-- Sparse accountability feed. Re-run safe (IF NOT EXISTS / OR REPLACE).

create table if not exists public.progress_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  audience text not null default 'me' check (audience in ('me', 'group', 'family')),
  group_id uuid, -- nullable for audience = 'me'
  media_path text,
  created_at timestamptz not null default now()
);

create index if not exists progress_posts_author_idx on public.progress_posts (author_id);
create index if not exists progress_posts_group_idx on public.progress_posts (group_id) where group_id is not null;
create index if not exists progress_posts_created_at_idx on public.progress_posts (created_at desc);

alter table public.progress_posts enable row level security;

-- Authors can always manage their own posts
drop policy if exists "Authors manage own progress" on public.progress_posts;
create policy "Authors manage own progress"
  on public.progress_posts for all
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- Group members can read group/family posts (adjust table name if your schema differs)
-- Uncomment when daybook_group_members (or equivalent) exists:
/*
drop policy if exists "Group members can read group progress" on public.progress_posts;
create policy "Group members can read group progress"
  on public.progress_posts for select
  using (
    audience in ('group', 'family')
    and group_id is not null
    and exists (
      select 1 from public.daybook_group_members m
      where m.group_id = progress_posts.group_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );
*/

-- Feed RPC: returns posts visible to the current user
create or replace function public.list_progress_feed(limit_count int default 50)
returns setof public.progress_posts
language plpgsql
security invoker
stable
as $$
declare
  my_group_ids uuid[];
begin
  begin
    select coalesce(array_agg((g->>'id')::uuid), '{}')
    into my_group_ids
    from jsonb_array_elements(
      coalesce((select to_jsonb(daybook_groups()) ), '[]'::jsonb)
    ) as g
    where (g->>'status') = 'active';
  exception when others then
    my_group_ids := '{}';
  end;

  return query
  select p.*
  from public.progress_posts p
  where p.author_id = auth.uid()
     or (
       p.audience in ('group', 'family')
       and p.group_id is not null
       and p.group_id = any(my_group_ids)
     )
  order by p.created_at desc
  limit limit_count;
end;
$$;

grant execute on function public.list_progress_feed(int) to authenticated;

create or replace function public.create_progress_post(
  p_body text,
  p_audience text default 'me',
  p_group_id uuid default null,
  p_media_path text default null
)
returns public.progress_posts
language plpgsql
security invoker
as $$
declare
  row public.progress_posts;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_audience not in ('me', 'group', 'family') then
    raise exception 'Invalid audience';
  end if;
  if p_audience = 'me' then
    p_group_id := null;
  elsif p_group_id is null then
    raise exception 'group_id required for group/family audience';
  end if;

  insert into public.progress_posts (author_id, body, audience, group_id, media_path)
  values (auth.uid(), trim(p_body), p_audience, p_group_id, p_media_path)
  returning * into row;

  return row;
end;
$$;

grant execute on function public.create_progress_post(text, text, uuid, text) to authenticated;
