-- Cadens: Web Push subscriptions
-- Run after the other migrations

begin;

create table if not exists public.daybook_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists daybook_push_user on public.daybook_push_subscriptions (user_id);

alter table public.daybook_push_subscriptions enable row level security;
revoke all on public.daybook_push_subscriptions from anon, authenticated;
grant select, insert, delete on public.daybook_push_subscriptions to authenticated;

create policy push_select on public.daybook_push_subscriptions
  for select to authenticated using (user_id = auth.uid());

create policy push_insert on public.daybook_push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());

create policy push_delete on public.daybook_push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

create or replace function public.daybook_push_subscribe(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := auth.uid();
begin
  if u is null then raise exception 'Login required' using errcode = '42501'; end if;
  insert into public.daybook_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (u, p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (user_id, endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent;
end;
$$;

create or replace function public.daybook_push_unsubscribe(p_endpoint text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.daybook_push_subscriptions
  where user_id = auth.uid() and endpoint = p_endpoint;
end;
$$;

revoke all on function public.daybook_push_subscribe(text, text, text, text) from public, anon;
revoke all on function public.daybook_push_unsubscribe(text) from public, anon;
grant execute on function public.daybook_push_subscribe(text, text, text, text) to authenticated;
grant execute on function public.daybook_push_unsubscribe(text) to authenticated;

commit;
