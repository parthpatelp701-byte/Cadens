-- Builder DNA — optional GitHub username + cached public tier (no private data)

alter table public.daybook_accounts
  add column if not exists github_username text,
  add column if not exists github_tier text,
  add column if not exists github_score int,
  add column if not exists github_bio_line text,
  add column if not exists github_refreshed_at timestamptz,
  add column if not exists github_visible boolean not null default false;

create or replace function public.set_github_username(p_username text)
returns void
language plpgsql
security invoker
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.daybook_accounts
  set
    github_username = nullif(trim(both from p_username), ''),
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
  update public.daybook_accounts
  set github_visible = coalesce(p_visible, false), updated_at = now()
  where user_id = auth.uid();
end;
$$;

grant execute on function public.set_github_username(text) to authenticated;
grant execute on function public.set_github_dna_cache(text, int, text) to authenticated;
grant execute on function public.set_github_visible(boolean) to authenticated;
