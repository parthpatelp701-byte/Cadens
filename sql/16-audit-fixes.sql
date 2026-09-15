-- Audit fixes (2026-09-11)
-- 1) daybook_accounts was SELECT-only → GitHub DNA / profile updates failed
-- 2) GitHub RPCs ensure account row exists

grant select, insert, update on public.daybook_accounts to authenticated;

-- Re-assert owner policy (idempotent)
drop policy if exists daybook_accounts_select on public.daybook_accounts;
drop policy if exists daybook_accounts_owner on public.daybook_accounts;
create policy daybook_accounts_owner on public.daybook_accounts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.set_github_username(p_username text)
returns void
language plpgsql
security invoker
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.daybook_accounts(user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  update public.daybook_accounts
  set
    github_username = nullif(trim(both from coalesce(p_username, '')), ''),
    github_tier = null,
    github_score = null,
    github_bio_line = null,
    github_refreshed_at = null,
    updated_at = now()
  where user_id = auth.uid();
end;
$$;

create or replace function public.set_github_dna_cache(
  p_tier text,
  p_score int,
  p_bio_line text
)
returns void
language plpgsql
security invoker
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.daybook_accounts(user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  update public.daybook_accounts
  set
    github_tier = p_tier,
    github_score = p_score,
    github_bio_line = p_bio_line,
    github_refreshed_at = now(),
    updated_at = now()
  where user_id = auth.uid();
end;
$$;

create or replace function public.set_github_visible(p_visible boolean)
returns void
language plpgsql
security invoker
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.daybook_accounts(user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  update public.daybook_accounts
  set github_visible = coalesce(p_visible, false), updated_at = now()
  where user_id = auth.uid();
end;
$$;

grant execute on function public.set_github_username(text) to authenticated;
grant execute on function public.set_github_dna_cache(text, int, text) to authenticated;
grant execute on function public.set_github_visible(boolean) to authenticated;
