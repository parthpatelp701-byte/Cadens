-- Read/disconnect helpers for Builder DNA (no public social graph)

create or replace function public.get_my_builder_dna()
returns jsonb
language sql
security invoker
stable
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'username', github_username,
        'tier', github_tier,
        'score', github_score,
        'bio_line', github_bio_line,
        'visible', github_visible,
        'refreshed_at', github_refreshed_at
      )
      from public.daybook_accounts
      where user_id = auth.uid()
    ),
    '{}'::jsonb
  );
$$;

create or replace function public.disconnect_github_dna()
returns void
language plpgsql
security invoker
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.daybook_accounts
  set
    github_username = null,
    github_tier = null,
    github_score = null,
    github_bio_line = null,
    github_refreshed_at = null,
    github_visible = false,
    updated_at = now()
  where user_id = auth.uid();
end;
$$;

-- Optional: peers who opted in (github_visible). Not a feed — compact DNA only.
create or replace function public.list_visible_builder_dna(p_limit int default 24)
returns table (
  user_id uuid,
  display_name text,
  github_username text,
  github_tier text,
  github_bio_line text
)
language sql
security invoker
stable
as $$
  select
    a.user_id,
    coalesce(a.settings#>>'{profile,displayName}', 'Member') as display_name,
    a.github_username,
    a.github_tier,
    a.github_bio_line
  from public.daybook_accounts a
  where a.github_visible = true
    and a.github_username is not null
    and a.github_tier is not null
    and a.user_id <> auth.uid()
  order by a.github_refreshed_at desc nulls last
  limit least(coalesce(p_limit, 24), 48);
$$;

grant execute on function public.get_my_builder_dna() to authenticated;
grant execute on function public.disconnect_github_dna() to authenticated;
grant execute on function public.list_visible_builder_dna(int) to authenticated;
