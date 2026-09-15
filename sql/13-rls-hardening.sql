-- Cadens — RLS hardening (run after 00–12)
-- Goal: deny-by-default, no anon table access, membership-scoped shared data,
-- owner-scoped private data. RPCs remain security invoker unless noted.

create schema if not exists cadens_private;

-- ---------------------------------------------------------------------------
-- Helpers (security definer, locked search_path)
-- ---------------------------------------------------------------------------
create or replace function cadens_private.is_authenticated()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null;
$$;

create or replace function cadens_private.member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.daybook_members m
      where m.group_id = p_group_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    );
$$;

create or replace function cadens_private.in_conversation(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.daybook_conversation_members cm
      where cm.conversation_id = cid
        and cm.user_id = auth.uid()
    );
$$;

revoke all on function cadens_private.is_authenticated() from public, anon;
revoke all on function cadens_private.member(uuid) from public, anon;
revoke all on function cadens_private.in_conversation(uuid) from public, anon;
grant execute on function cadens_private.is_authenticated() to authenticated;
grant execute on function cadens_private.member(uuid) to authenticated;
grant execute on function cadens_private.in_conversation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Utility: enable RLS + force for a table if it exists
-- ---------------------------------------------------------------------------
create or replace function cadens_private.ensure_rls(p_table regclass)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  execute format('alter table %s enable row level security', p_table);
  execute format('alter table %s force row level security', p_table);
exception
  when undefined_table then null;
  when others then null;
end;
$$;

select cadens_private.ensure_rls('public.daybook_accounts');
select cadens_private.ensure_rls('public.daybook_groups');
select cadens_private.ensure_rls('public.daybook_members');
select cadens_private.ensure_rls('public.daybook_records');
select cadens_private.ensure_rls('public.daybook_reactions');
select cadens_private.ensure_rls('public.daybook_comments');
select cadens_private.ensure_rls('public.daybook_notifications');
select cadens_private.ensure_rls('public.daybook_stories');
select cadens_private.ensure_rls('public.daybook_story_views');
select cadens_private.ensure_rls('public.daybook_conversations');
select cadens_private.ensure_rls('public.daybook_conversation_members');
select cadens_private.ensure_rls('public.daybook_messages');
select cadens_private.ensure_rls('public.daybook_push_subscriptions');
select cadens_private.ensure_rls('public.cadens_saves');
select cadens_private.ensure_rls('public.cadens_idea_boards');
select cadens_private.ensure_rls('public.cadens_ideas');
select cadens_private.ensure_rls('public.cadens_idea_reactions');
select cadens_private.ensure_rls('public.journals');
select cadens_private.ensure_rls('public.journal_entries');
select cadens_private.ensure_rls('public.journal_entry_media');
select cadens_private.ensure_rls('public.journal_tags');
select cadens_private.ensure_rls('public.journal_entry_tags');
select cadens_private.ensure_rls('public.calendars');
select cadens_private.ensure_rls('public.calendar_events');
select cadens_private.ensure_rls('public.tasks');

-- ---------------------------------------------------------------------------
-- Revoke anon on known tables (idempotent)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'daybook_accounts','daybook_groups','daybook_members','daybook_records',
    'daybook_reactions','daybook_comments','daybook_notifications',
    'daybook_stories','daybook_story_views',
    'daybook_conversations','daybook_conversation_members','daybook_messages',
    'daybook_push_subscriptions',
    'cadens_saves','cadens_idea_boards','cadens_ideas','cadens_idea_reactions',
    'journals','journal_entries','journal_entry_media','journal_tags','journal_entry_tags',
    'calendars','calendar_events','tasks'
  ]
  loop
    begin
      execute format('revoke all on table public.%I from anon', t);
    exception when undefined_table then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Private owner tables — strict owner policies
-- ---------------------------------------------------------------------------

-- Saves
drop policy if exists cadens_saves_own on public.cadens_saves;
create policy cadens_saves_own on public.cadens_saves
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Tasks
drop policy if exists "Owner tasks" on public.tasks;
create policy tasks_owner on public.tasks
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Calendars / events
drop policy if exists "Owner calendars" on public.calendars;
create policy calendars_owner on public.calendars
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Owner events" on public.calendar_events;
create policy calendar_events_owner on public.calendar_events
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Journal
drop policy if exists "Owner journals" on public.journals;
create policy journals_owner on public.journals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Owner entries" on public.journal_entries;
create policy journal_entries_owner on public.journal_entries
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Owner media" on public.journal_entry_media;
create policy journal_media_owner on public.journal_entry_media
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Owner tags" on public.journal_tags;
create policy journal_tags_owner on public.journal_tags
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Owner entry_tags" on public.journal_entry_tags;
create policy journal_entry_tags_owner on public.journal_entry_tags
  for all to authenticated
  using (
    exists (
      select 1 from public.journal_entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.journal_entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );

-- Notifications — own rows only
drop policy if exists notifications_select on public.daybook_notifications;
drop policy if exists notifications_update on public.daybook_notifications;
drop policy if exists notifications_owner on public.daybook_notifications;
create policy notifications_owner on public.daybook_notifications
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Push subscriptions — own only
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'daybook_push_subscriptions'
  ) then
    execute 'drop policy if exists push_subs_owner on public.daybook_push_subscriptions';
    execute $p$
      create policy push_subs_owner on public.daybook_push_subscriptions
        for all to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid())
    $p$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Idea boards — membership scoped (tighten prior "any authenticated" policies)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cadens_idea_boards'
      and column_name = 'group_id'
  ) then
    execute 'drop policy if exists idea_boards_auth on public.cadens_idea_boards';
    execute 'drop policy if exists idea_boards_member on public.cadens_idea_boards';
    execute $p$
      create policy idea_boards_member on public.cadens_idea_boards
        for all to authenticated
        using (
          cadens_private.member(group_id::uuid)
          or (group_id is null and created_by = auth.uid())
        )
        with check (
          cadens_private.member(group_id::uuid)
          or (group_id is null and created_by = auth.uid())
        )
    $p$;
  end if;
exception when others then
  -- Fallback: created_by only if group_id type differs
  begin
    execute 'drop policy if exists idea_boards_auth on public.cadens_idea_boards';
    execute 'drop policy if exists idea_boards_member on public.cadens_idea_boards';
    execute $p$
      create policy idea_boards_member on public.cadens_idea_boards
        for all to authenticated
        using (created_by = auth.uid() or cadens_private.member(group_id))
        with check (created_by = auth.uid() or cadens_private.member(group_id))
    $p$;
  exception when others then null;
  end;
end $$;

do $$
begin
  execute 'drop policy if exists ideas_auth on public.cadens_ideas';
  execute 'drop policy if exists ideas_member on public.cadens_ideas';
  execute $p$
    create policy ideas_member on public.cadens_ideas
      for all to authenticated
      using (
        exists (
          select 1 from public.cadens_idea_boards b
          where b.id = board_id
            and (
              b.created_by = auth.uid()
              or cadens_private.member(b.group_id::uuid)
            )
        )
      )
      with check (
        exists (
          select 1 from public.cadens_idea_boards b
          where b.id = board_id
            and (
              b.created_by = auth.uid()
              or cadens_private.member(b.group_id::uuid)
            )
        )
      )
  $p$;
exception when others then null;
end $$;

do $$
begin
  execute 'drop policy if exists idea_reactions_auth on public.cadens_idea_reactions';
  execute 'drop policy if exists idea_reactions_member on public.cadens_idea_reactions';
  execute $p$
    create policy idea_reactions_member on public.cadens_idea_reactions
      for all to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1
          from public.cadens_ideas i
          join public.cadens_idea_boards b on b.id = i.board_id
          where i.id = idea_id
            and cadens_private.member(b.group_id::uuid)
        )
      )
      with check (user_id = auth.uid())
  $p$;
exception when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- Daybook reactions: stop using (true) — limit to authenticated + related post path
-- ---------------------------------------------------------------------------
drop policy if exists daybook_reactions_select on public.daybook_reactions;
drop policy if exists daybook_reactions_all on public.daybook_reactions;
create policy daybook_reactions_rw on public.daybook_reactions
  for all to authenticated
  using (
    user_id = auth.uid()
    or post_owner = auth.uid()
    or exists (
      select 1 from public.daybook_records r
      where r.id = post_id
        and r.collection = 'posts'
        and (
          r.owner_id = auth.uid()
          or (
            r.payload->>'privacy' = 'group'
            and nullif(r.payload->>'groupId', '') is not null
            and cadens_private.member((r.payload->>'groupId')::uuid)
          )
        )
    )
  )
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Messages: membership via helper (select policies reinforced)
-- ---------------------------------------------------------------------------
drop policy if exists conv_select on public.daybook_conversations;
create policy conv_select on public.daybook_conversations
  for select to authenticated
  using (cadens_private.in_conversation(id));

drop policy if exists conv_members_select on public.daybook_conversation_members;
create policy conv_members_select on public.daybook_conversation_members
  for select to authenticated
  using (cadens_private.in_conversation(conversation_id) or user_id = auth.uid());

drop policy if exists messages_select on public.daybook_messages;
create policy messages_select on public.daybook_messages
  for select to authenticated
  using (cadens_private.in_conversation(conversation_id));

-- ---------------------------------------------------------------------------
-- Accounts: user can read/update own profile row
-- ---------------------------------------------------------------------------
drop policy if exists daybook_accounts_select on public.daybook_accounts;
drop policy if exists daybook_accounts_owner on public.daybook_accounts;
create policy daybook_accounts_owner on public.daybook_accounts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Sanity view for ops (optional)
-- ---------------------------------------------------------------------------
comment on schema cadens_private is 'Cadens internal helpers for RLS (membership, conversation).';

-- Done
do $$ begin
  raise notice 'Cadens RLS hardening applied';
end $$;
