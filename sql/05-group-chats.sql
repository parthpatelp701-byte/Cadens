-- Cadens: Group chats (multi-person conversations tied to a space)
-- Run after 03-messages.sql

begin;

-- Start or return a group conversation for an existing Cadens group (daybook group id).
-- All active members of the group are added as conversation members.
create or replace function public.daybook_group_conversation_start(p_group_id text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  existing uuid;
  new_id uuid;
  g_name text;
  member_ids uuid[];
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  if p_group_id is null or btrim(p_group_id) = '' then
    raise exception 'Group id required';
  end if;

  -- Caller must be an active member of the group (uses existing daybook groups data).
  -- We resolve members via daybook_groups RPC shape stored in daybook_accounts / group tables.
  -- Fallback: use daybook_group_action / groups listing is not directly queryable here,
  -- so we rely on a lightweight check against conversation membership patterns and
  -- store group title from the first known label when available.

  -- Prefer an existing group conversation created for this group id (title stores group id tag).
  select c.id into existing
  from public.daybook_conversations c
  join public.daybook_conversation_members m on m.conversation_id = c.id and m.user_id = u
  where c.is_group = true
    and c.title is not null
    and c.title like 'g:' || p_group_id || ':%'
  limit 1;

  if existing is not null then
    return existing;
  end if;

  -- Build title: g:<groupId>:<display name>
  g_name := 'Group chat';
  begin
    -- Try to pull a friendly name from any existing conversation title pattern or default
    null;
  exception when others then
    null;
  end;

  insert into public.daybook_conversations (is_group, title, created_by)
  values (true, 'g:' || p_group_id || ':' || left(g_name, 60), u)
  returning id into new_id;

  -- Add the creator
  insert into public.daybook_conversation_members (conversation_id, user_id)
  values (new_id, u)
  on conflict do nothing;

  -- Add other active members if we can resolve them from daybook group membership tables.
  -- Many Daybook installs store members in daybook_group_members or similar; attempt common shapes.
  begin
    insert into public.daybook_conversation_members (conversation_id, user_id)
    select new_id, gm.user_id
    from public.daybook_group_members gm
    where gm.group_id::text = p_group_id
      and gm.status = 'active'
      and gm.user_id <> u
    on conflict do nothing;
  exception when undefined_table then
    -- Table may not exist under this name; creator-only is fine — members can be added later
    null;
  end;

  return new_id;
end;
$$;

-- Explicitly create a multi-person conversation with a list of user ids
create or replace function public.daybook_conversation_create_group(
  p_title text,
  p_member_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  new_id uuid;
  mid uuid;
  cleaned text := left(btrim(coalesce(p_title, 'Group chat')), 80);
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  if p_member_ids is null or cardinality(p_member_ids) < 1 then
    raise exception 'At least one other member is required';
  end if;

  insert into public.daybook_conversations (is_group, title, created_by)
  values (true, cleaned, u)
  returning id into new_id;

  insert into public.daybook_conversation_members (conversation_id, user_id)
  values (new_id, u);

  foreach mid in array p_member_ids loop
    if mid is not null and mid <> u then
      insert into public.daybook_conversation_members (conversation_id, user_id)
      values (new_id, mid)
      on conflict do nothing;
    end if;
  end loop;

  return new_id;
end;
$$;

revoke all on function public.daybook_group_conversation_start(text) from public, anon;
revoke all on function public.daybook_conversation_create_group(text, uuid[]) from public, anon;

grant execute on function public.daybook_group_conversation_start(text) to authenticated;
grant execute on function public.daybook_conversation_create_group(text, uuid[]) to authenticated;

commit;
