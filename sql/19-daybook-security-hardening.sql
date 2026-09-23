-- Daybook security hardening for Connected Rhythm Phase A.
-- Run after 18-connected-rhythm-collections.sql.
--
-- The browser client should keep using the Daybook RPCs instead of writing
-- directly to the JSON tables. This migration makes that explicit:
--   - no anon/public execution of Daybook RPCs
--   - authenticated users may execute only the intended RPC surface
--   - daybook_load/daybook_sync run as audited RPC boundaries
--   - daybook_revisions has owner-scoped policies if table grants are later added

begin;

alter table public.daybook_accounts enable row level security;
alter table public.daybook_accounts force row level security;
alter table public.daybook_revisions enable row level security;
alter table public.daybook_revisions force row level security;
alter table public.daybook_records enable row level security;
alter table public.daybook_records force row level security;

-- Keep direct table writes closed by default. The RPC boundary owns mutation.
revoke all on public.daybook_accounts, public.daybook_groups, public.daybook_members,
  public.daybook_revisions, public.daybook_records, public.daybook_reactions,
  public.daybook_comments from anon, authenticated;

grant select on public.daybook_accounts to authenticated;
grant select on public.daybook_groups, public.daybook_members to authenticated;
grant select on public.daybook_records, public.daybook_reactions, public.daybook_comments to authenticated;

-- RPCs perform writes internally after checking auth.uid().
alter function public.daybook_load() security definer;
alter function public.daybook_sync(bigint, jsonb, jsonb) security definer;

revoke all on function public.daybook_load() from public, anon;
revoke all on function public.daybook_sync(bigint, jsonb, jsonb) from public, anon;
revoke all on function public.daybook_feed() from public, anon;
revoke all on function public.daybook_groups() from public, anon;
revoke all on function public.daybook_group_action(text, uuid, uuid, text, text, text) from public, anon;

grant execute on function public.daybook_load() to authenticated;
grant execute on function public.daybook_sync(bigint, jsonb, jsonb) to authenticated;
grant execute on function public.daybook_feed() to authenticated;
grant execute on function public.daybook_groups() to authenticated;
grant execute on function public.daybook_group_action(text, uuid, uuid, text, text, text) to authenticated;

-- Safe ownership policies for revisions. They are intentionally paired with
-- no direct table grant above; these prevent accidental cross-user exposure if
-- a future migration grants table access for diagnostics.
drop policy if exists daybook_revisions_select on public.daybook_revisions;
create policy daybook_revisions_select on public.daybook_revisions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists daybook_revisions_insert on public.daybook_revisions;
create policy daybook_revisions_insert on public.daybook_revisions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists daybook_revisions_update on public.daybook_revisions;
create policy daybook_revisions_update on public.daybook_revisions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;
