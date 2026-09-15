-- Cadens: Stories (24-hour, group-scoped)
-- Run in Supabase SQL editor after notifications migration

begin;

create table if not exists public.daybook_stories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.daybook_groups(id) on delete cascade,
  audience text not null default 'group' check (audience in ('group', 'family', 'private')),
  media_path text,                          -- storage path in cadens-photos
  media_type text not null default 'image' check (media_type in ('image', 'text')),
  text_content text check (text_content is null or char_length(text_content) <= 500),
  background text default '#8B5CF6',         -- for text-only stories
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists daybook_stories_active
  on public.daybook_stories (expires_at desc)
  where expires_at > now();

create index if not exists daybook_stories_owner
  on public.daybook_stories (owner_id, created_at desc);

-- Who has viewed a story
create table if not exists public.daybook_story_views (
  story_id uuid not null references public.daybook_stories(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

alter table public.daybook_stories enable row level security;
alter table public.daybook_story_views enable row level security;

revoke all on public.daybook_stories from anon, authenticated;
revoke all on public.daybook_story_views from anon, authenticated;
grant select on public.daybook_stories to authenticated;
grant select, insert on public.daybook_story_views to authenticated;

-- Can read if: owner, or active member of the story's group, or family audience + shared family
create or replace function cadens_private.can_read_story(owner uuid, aud text, gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    owner = auth.uid()
    or (aud = 'group' and gid is not null and cadens_private.member(gid))
    or (aud = 'family' and exists (
      select 1 from public.daybook_groups f
      join public.daybook_members x on x.group_id = f.id and x.user_id = owner and x.status = 'active'
      join public.daybook_members y on y.group_id = f.id and y.user_id = auth.uid() and y.status = 'active'
      where f.kind = 'family'
    ))
    or aud = 'private' and owner = auth.uid()
  );
$$;

create policy stories_select on public.daybook_stories
  for select to authenticated
  using (
    expires_at > now()
    and cadens_private.can_read_story(owner_id, audience, group_id)
  );

create policy story_views_select on public.daybook_story_views
  for select to authenticated
  using (
    viewer_id = auth.uid()
    or exists (
      select 1 from public.daybook_stories s
      where s.id = story_id and s.owner_id = auth.uid()
    )
  );

create policy story_views_insert on public.daybook_story_views
  for insert to authenticated
  with check (viewer_id = auth.uid());

-- List active stories grouped by author (for the rail)
create or replace function public.daybook_stories_feed()
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
    select jsonb_agg(author_row order by is_me desc, latest desc)
    from (
      select
        s.owner_id,
        coalesce(a.settings#>>'{profile,displayName}', 'Member') as author,
        max(s.created_at) as latest,
        (s.owner_id = u) as is_me,
        jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'media_type', s.media_type,
            'media_path', s.media_path,
            'text_content', s.text_content,
            'background', s.background,
            'created_at', s.created_at,
            'expires_at', s.expires_at,
            'viewed', exists (
              select 1 from public.daybook_story_views v
              where v.story_id = s.id and v.viewer_id = u
            )
          ) order by s.created_at asc
        ) as stories
      from public.daybook_stories s
      left join public.daybook_accounts a on a.user_id = s.owner_id
      where s.expires_at > now()
        and cadens_private.can_read_story(s.owner_id, s.audience, s.group_id)
      group by s.owner_id, a.settings
    ) author_row
  ), '[]'::jsonb);
end;
$$;

-- Create a text or image story
create or replace function public.daybook_story_create(
  p_media_type text default 'text',
  p_text_content text default null,
  p_background text default '#8B5CF6',
  p_media_path text default null,
  p_audience text default 'group',
  p_group_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  new_id uuid;
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  if p_media_type not in ('image', 'text') then raise exception 'Invalid media type'; end if;
  if p_media_type = 'text' and (p_text_content is null or btrim(p_text_content) = '') then
    raise exception 'Text is required for text stories';
  end if;
  if p_audience = 'group' and p_group_id is not null and not cadens_private.member(p_group_id) then
    raise exception 'You must be an approved group member' using errcode = '42501';
  end if;

  insert into public.daybook_stories (owner_id, group_id, audience, media_path, media_type, text_content, background)
  values (
    u,
    p_group_id,
    p_audience,
    p_media_path,
    p_media_type,
    case when p_media_type = 'text' then left(btrim(p_text_content), 500) else null end,
    coalesce(p_background, '#8B5CF6')
  )
  returning id into new_id;

  return jsonb_build_object('id', new_id);
end;
$$;

-- Mark story as viewed
create or replace function public.daybook_story_view(p_story_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  insert into public.daybook_story_views (story_id, viewer_id)
  values (p_story_id, u)
  on conflict do nothing;
end;
$$;

revoke all on function public.daybook_stories_feed() from public, anon;
revoke all on function public.daybook_story_create(text, text, text, text, text, uuid) from public, anon;
revoke all on function public.daybook_story_view(uuid) from public, anon;

grant execute on function public.daybook_stories_feed() to authenticated;
grant execute on function public.daybook_story_create(text, text, text, text, text, uuid) to authenticated;
grant execute on function public.daybook_story_view(uuid) to authenticated;

commit;
