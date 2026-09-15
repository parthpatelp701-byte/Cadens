-- Cadens v2 — Iteration: tighter group RLS for progress + idea boards
-- Depends on: daybook_members, cadens_private.member(uuid) from existing Daybook schema
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Helper: is active member of a group (uses existing private helper when present)
-- ---------------------------------------------------------------------------
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.daybook_members m
    where m.group_id = p_group_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

grant execute on function public.is_group_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Progress posts — group members can read group/family posts
-- ---------------------------------------------------------------------------
drop policy if exists "Group members can read group progress" on public.progress_posts;
create policy "Group members can read group progress"
  on public.progress_posts for select
  to authenticated
  using (
    audience in ('group', 'family')
    and group_id is not null
    and public.is_group_member(group_id)
  );

-- Authors still fully manage own (existing policy)

-- ---------------------------------------------------------------------------
-- Idea boards — only group members
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated manage idea_boards" on public.idea_boards;
drop policy if exists "Creators manage own boards" on public.idea_boards;
drop policy if exists "Group members read idea_boards" on public.idea_boards;
drop policy if exists "Group members insert idea_boards" on public.idea_boards;
drop policy if exists "Group members update idea_boards" on public.idea_boards;
drop policy if exists "Creators delete idea_boards" on public.idea_boards;

create policy "Group members read idea_boards"
  on public.idea_boards for select
  to authenticated
  using (public.is_group_member(group_id));

create policy "Group members insert idea_boards"
  on public.idea_boards for insert
  to authenticated
  with check (
    public.is_group_member(group_id)
    and created_by = auth.uid()
  );

create policy "Group members update idea_boards"
  on public.idea_boards for update
  to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "Creators delete idea_boards"
  on public.idea_boards for delete
  to authenticated
  using (created_by = auth.uid() or public.is_group_member(group_id));

-- ---------------------------------------------------------------------------
-- Ideas — group members via board
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated manage ideas" on public.ideas;
drop policy if exists "Authors manage own ideas" on public.ideas;
drop policy if exists "Group members read ideas" on public.ideas;
drop policy if exists "Group members insert ideas" on public.ideas;
drop policy if exists "Authors update ideas" on public.ideas;
drop policy if exists "Authors delete ideas" on public.ideas;

create policy "Group members read ideas"
  on public.ideas for select
  to authenticated
  using (
    exists (
      select 1 from public.idea_boards b
      where b.id = ideas.board_id
        and public.is_group_member(b.group_id)
    )
  );

create policy "Group members insert ideas"
  on public.ideas for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.idea_boards b
      where b.id = board_id
        and b.status = 'open'
        and public.is_group_member(b.group_id)
    )
  );

create policy "Authors update ideas"
  on public.ideas for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "Authors delete ideas"
  on public.ideas for delete
  to authenticated
  using (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Idea reactions — group members
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated manage idea_reactions" on public.idea_reactions;
drop policy if exists "Users manage own reactions" on public.idea_reactions;
drop policy if exists "Group members read idea_reactions" on public.idea_reactions;
drop policy if exists "Group members write own idea_reactions" on public.idea_reactions;
drop policy if exists "Users delete own idea_reactions" on public.idea_reactions;

create policy "Group members read idea_reactions"
  on public.idea_reactions for select
  to authenticated
  using (
    exists (
      select 1
      from public.ideas i
      join public.idea_boards b on b.id = i.board_id
      where i.id = idea_reactions.idea_id
        and public.is_group_member(b.group_id)
    )
  );

create policy "Group members write own idea_reactions"
  on public.idea_reactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.ideas i
      join public.idea_boards b on b.id = i.board_id
      where i.id = idea_id
        and public.is_group_member(b.group_id)
    )
  );

create policy "Users update own idea_reactions"
  on public.idea_reactions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users delete own idea_reactions"
  on public.idea_reactions for delete
  to authenticated
  using (user_id = auth.uid());

-- Tighten create_progress_post to require membership
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
  else
    if p_group_id is null then
      raise exception 'group_id required for group/family audience';
    end if;
    if not public.is_group_member(p_group_id) then
      raise exception 'You must be an active group member' using errcode = '42501';
    end if;
  end if;

  insert into public.progress_posts (author_id, body, audience, group_id, media_path)
  values (auth.uid(), trim(p_body), p_audience, p_group_id, p_media_path)
  returning * into row;

  return row;
end;
$$;

-- Tighten create_idea_board
create or replace function public.create_idea_board(
  p_group_id uuid,
  p_title text,
  p_emoji text default null
)
returns public.idea_boards
language plpgsql
security invoker
as $$
declare
  row public.idea_boards;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_group_member(p_group_id) then
    raise exception 'You must be an active group member' using errcode = '42501';
  end if;
  insert into public.idea_boards (group_id, title, emoji, created_by)
  values (p_group_id, trim(p_title), nullif(trim(p_emoji), ''), auth.uid())
  returning * into row;
  return row;
end;
$$;
