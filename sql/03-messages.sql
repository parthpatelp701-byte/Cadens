-- Cadens: Direct Messages
-- Run in Supabase SQL editor after stories migration

begin;

create table if not exists public.daybook_conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text check (title is null or char_length(title) <= 80),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daybook_conversation_members (
  conversation_id uuid not null references public.daybook_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists daybook_conv_members_user
  on public.daybook_conversation_members (user_id, conversation_id);

create table if not exists public.daybook_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.daybook_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists daybook_messages_conv_created
  on public.daybook_messages (conversation_id, created_at desc);

alter table public.daybook_conversations enable row level security;
alter table public.daybook_conversation_members enable row level security;
alter table public.daybook_messages enable row level security;

revoke all on public.daybook_conversations from anon, authenticated;
revoke all on public.daybook_conversation_members from anon, authenticated;
revoke all on public.daybook_messages from anon, authenticated;

grant select on public.daybook_conversations to authenticated;
grant select on public.daybook_conversation_members to authenticated;
grant select on public.daybook_messages to authenticated;

create or replace function cadens_private.in_conversation(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.daybook_conversation_members
    where conversation_id = cid and user_id = auth.uid()
  );
$$;

create policy conv_select on public.daybook_conversations
  for select to authenticated
  using (cadens_private.in_conversation(id));

create policy conv_members_select on public.daybook_conversation_members
  for select to authenticated
  using (cadens_private.in_conversation(conversation_id));

create policy messages_select on public.daybook_messages
  for select to authenticated
  using (cadens_private.in_conversation(conversation_id));

-- List my conversations with last message + unread
create or replace function public.daybook_conversations_list()
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
    select jsonb_agg(row_to_json(c) order by c.updated_at desc)
    from (
      select
        conv.id,
        conv.is_group,
        conv.title,
        conv.updated_at,
        (
          select jsonb_build_object(
            'body', m.body,
            'sender_id', m.sender_id,
            'created_at', m.created_at
          )
          from public.daybook_messages m
          where m.conversation_id = conv.id
          order by m.created_at desc
          limit 1
        ) as last_message,
        (
          select count(*)::int
          from public.daybook_messages m
          where m.conversation_id = conv.id
            and m.created_at > coalesce(mem.last_read_at, '1970-01-01'::timestamptz)
            and m.sender_id <> u
        ) as unread,
        (
          select jsonb_agg(jsonb_build_object(
            'id', cm.user_id,
            'name', coalesce(a.settings#>>'{profile,displayName}', 'Member')
          ))
          from public.daybook_conversation_members cm
          left join public.daybook_accounts a on a.user_id = cm.user_id
          where cm.conversation_id = conv.id and cm.user_id <> u
        ) as members
      from public.daybook_conversations conv
      join public.daybook_conversation_members mem
        on mem.conversation_id = conv.id and mem.user_id = u
    ) c
  ), '[]'::jsonb);
end;
$$;

-- Get or create a 1:1 conversation with another user
create or replace function public.daybook_conversation_start(other_user_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  existing uuid;
  new_id uuid;
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  if other_user_id is null or other_user_id = u then
    raise exception 'Invalid user';
  end if;

  -- Find existing 1:1
  select c.id into existing
  from public.daybook_conversations c
  join public.daybook_conversation_members m1 on m1.conversation_id = c.id and m1.user_id = u
  join public.daybook_conversation_members m2 on m2.conversation_id = c.id and m2.user_id = other_user_id
  where c.is_group = false
  limit 1;

  if existing is not null then return existing; end if;

  insert into public.daybook_conversations (is_group, created_by)
  values (false, u)
  returning id into new_id;

  insert into public.daybook_conversation_members (conversation_id, user_id)
  values (new_id, u), (new_id, other_user_id);

  return new_id;
end;
$$;

-- Send a message
create or replace function public.daybook_message_send(p_conversation_id uuid, p_body text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  new_id uuid;
  cleaned text := btrim(p_body);
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  if not cadens_private.in_conversation(p_conversation_id) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;
  if cleaned is null or char_length(cleaned) < 1 then
    raise exception 'Message cannot be empty';
  end if;

  insert into public.daybook_messages (conversation_id, sender_id, body)
  values (p_conversation_id, u, left(cleaned, 4000))
  returning id into new_id;

  update public.daybook_conversations
  set updated_at = now()
  where id = p_conversation_id;

  -- Notify other members
  perform cadens_private.notify(
    cm.user_id,
    'message',
    'New message',
    left(cleaned, 120),
    p_conversation_id::text,
    'conversation'
  )
  from public.daybook_conversation_members cm
  where cm.conversation_id = p_conversation_id and cm.user_id <> u;

  return jsonb_build_object(
    'id', new_id,
    'conversation_id', p_conversation_id,
    'sender_id', u,
    'body', left(cleaned, 4000),
    'created_at', now()
  );
end;
$$;

-- List messages in a conversation
create or replace function public.daybook_messages_list(p_conversation_id uuid, p_limit int default 50)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  if not cadens_private.in_conversation(p_conversation_id) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;

  -- Mark as read
  update public.daybook_conversation_members
  set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = u;

  return coalesce((
    select jsonb_agg(row_to_json(m) order by m.created_at asc)
    from (
      select
        msg.id,
        msg.sender_id,
        coalesce(a.settings#>>'{profile,displayName}', 'Member') as sender_name,
        msg.body,
        msg.created_at
      from public.daybook_messages msg
      left join public.daybook_accounts a on a.user_id = msg.sender_id
      where msg.conversation_id = p_conversation_id
      order by msg.created_at desc
      limit least(coalesce(p_limit, 50), 100)
    ) m
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.daybook_conversations_list() from public, anon;
revoke all on function public.daybook_conversation_start(uuid) from public, anon;
revoke all on function public.daybook_message_send(uuid, text) from public, anon;
revoke all on function public.daybook_messages_list(uuid, int) from public, anon;

grant execute on function public.daybook_conversations_list() to authenticated;
grant execute on function public.daybook_conversation_start(uuid) to authenticated;
grant execute on function public.daybook_message_send(uuid, text) to authenticated;
grant execute on function public.daybook_messages_list(uuid, int) to authenticated;

commit;
