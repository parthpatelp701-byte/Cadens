-- Cadens: server-side notifications
-- Run this in the Supabase SQL editor

begin;

create table if not exists public.daybook_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('like', 'comment', 'mention', 'group_invite', 'group_approved', 'message', 'system')),
  title text not null check (char_length(title) between 1 and 200),
  body text check (body is null or char_length(body) <= 500),
  target_id text,
  target_type text check (target_type is null or target_type in ('post', 'group', 'conversation', 'story')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists daybook_notifications_user_created
  on public.daybook_notifications (user_id, created_at desc);

create index if not exists daybook_notifications_user_unread
  on public.daybook_notifications (user_id, read) where read = false;

alter table public.daybook_notifications enable row level security;

revoke all on public.daybook_notifications from anon, authenticated;
grant select, update on public.daybook_notifications to authenticated;

-- Users can only read their own notifications
create policy notifications_select on public.daybook_notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Users can mark their own notifications as read
create policy notifications_update on public.daybook_notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Helper: insert a notification (security definer)
create or replace function cadens_private.notify(
  target_user uuid,
  notif_type text,
  notif_title text,
  notif_body text default null,
  notif_target_id text default null,
  notif_target_type text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if target_user is null then return; end if;
  -- Don't notify yourself
  if target_user = actor then return; end if;

  insert into public.daybook_notifications (user_id, actor_id, type, title, body, target_id, target_type)
  values (target_user, actor, notif_type, left(notif_title, 200), left(notif_body, 500), notif_target_id, notif_target_type);
end;
$$;

-- Public RPCs
create or replace function public.daybook_notifications_list(limit_count int default 50)
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
    select jsonb_agg(row_to_json(n) order by n.created_at desc)
    from (
      select id, type, title, body, target_id as "targetId", target_type as "targetType",
             read, created_at
      from public.daybook_notifications
      where user_id = u
      order by created_at desc
      limit least(coalesce(limit_count, 50), 100)
    ) n
  ), '[]'::jsonb);
end;
$$;

create or replace function public.daybook_notifications_mark_read(notification_ids uuid[] default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;

  if notification_ids is null then
    update public.daybook_notifications set read = true where user_id = u and read = false;
  else
    update public.daybook_notifications
    set read = true
    where user_id = u and id = any(notification_ids);
  end if;
end;
$$;

create or replace function public.daybook_notifications_unread_count()
returns int
language sql
security invoker
set search_path = ''
as $$
  select count(*)::int
  from public.daybook_notifications
  where user_id = auth.uid() and read = false;
$$;

revoke all on function public.daybook_notifications_list(int) from public, anon;
revoke all on function public.daybook_notifications_mark_read(uuid[]) from public, anon;
revoke all on function public.daybook_notifications_unread_count() from public, anon;

grant execute on function public.daybook_notifications_list(int) to authenticated;
grant execute on function public.daybook_notifications_mark_read(uuid[]) to authenticated;
grant execute on function public.daybook_notifications_unread_count() to authenticated;

-- Hook into social actions so likes/comments create real notifications
create or replace function cadens_private.social_action(
  action text,
  post_owner uuid,
  post_id text,
  body text default '',
  comment_id uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  post_text text;
begin
  if u is null or not cadens_private.post_access(post_owner, post_id) then
    raise exception 'Post unavailable' using errcode = '42501';
  end if;

  if action = 'like' then
    insert into public.daybook_reactions(post_owner, post_id, user_id)
    values (post_owner, post_id, u)
    on conflict do nothing;

    select left(payload->>'text', 80) into post_text
    from public.daybook_records
    where owner_id = post_owner and collection = 'posts' and id = post_id;

    perform cadens_private.notify(
      post_owner,
      'like',
      'Someone liked your post',
      post_text,
      post_id,
      'post'
    );

  elsif action = 'unlike' then
    delete from public.daybook_reactions r
    where r.post_owner = social_action.post_owner
      and r.post_id = social_action.post_id
      and r.user_id = u;

  elsif action = 'comment' then
    insert into public.daybook_comments(post_owner, post_id, user_id, body)
    values (post_owner, post_id, u, btrim(body));

    perform cadens_private.notify(
      post_owner,
      'comment',
      'New comment on your post',
      left(btrim(body), 120),
      post_id,
      'post'
    );

  elsif action = 'delete-comment' then
    delete from public.daybook_comments c
    where c.id = comment_id
      and c.post_owner = social_action.post_owner
      and c.post_id = social_action.post_id
      and c.user_id = u;
  else
    raise exception 'Unknown action';
  end if;
end;
$$;

commit;
