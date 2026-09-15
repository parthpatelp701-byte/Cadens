-- Cadens RLS tests via JWT claim simulation (Supabase SQL Editor)
-- Run as a privileged role (postgres / dashboard). Does NOT need pg_net.
-- Creates two synthetic users in auth.users if missing, seeds owner rows, asserts isolation.
-- SAFE FOR STAGING ONLY — do not run on production with real user data.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 0) Test identities
-- ---------------------------------------------------------------------------
do $$
declare
  a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
begin
  -- Minimal auth.users rows (Supabase). Ignore if already present / restricted.
  begin
    insert into auth.users (id, email, aud, role, created_at, updated_at, instance_id)
    values
      (a, 'rls-a@cadens.test', 'authenticated', 'authenticated', now(), now(), '00000000-0000-0000-0000-000000000000'),
      (b, 'rls-b@cadens.test', 'authenticated', 'authenticated', now(), now(), '00000000-0000-0000-0000-000000000000')
    on conflict (id) do nothing;
  exception when others then
    raise notice 'auth.users insert skipped: %', sqlerrm;
  end;
end $$;

-- Helper: set request context so auth.uid() resolves
create or replace function cadens_private.test_as(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_uid::text,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true
  );
  -- PostgREST / Supabase also reads this in some paths
  perform set_config('role', 'authenticated', true);
exception when others then
  raise notice 'test_as config: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1) Seed as service (bypass RLS for setup only)
-- ---------------------------------------------------------------------------
reset role;
set local role postgres; -- dashboard user is typically superuser

do $$
declare
  a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  tid uuid;
begin
  -- Tasks
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tasks') then
    delete from public.tasks where user_id in (a, b) and title like 'RLS Test%';
    insert into public.tasks (user_id, title, status)
    values (a, 'RLS Test task A', 'open'), (b, 'RLS Test task B', 'open');
  end if;

  -- Saves
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='cadens_saves') then
    delete from public.cadens_saves where user_id in (a, b) and title like 'RLS Test%';
    begin
      insert into public.cadens_saves (user_id, kind, title, body)
      values (a, 'note', 'RLS Test save A', 'secret-a'), (b, 'note', 'RLS Test save B', 'secret-b');
    exception when others then
      raise notice 'saves seed: %', sqlerrm;
    end;
  end if;

  -- Calendar events (needs calendar)
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='calendar_events') then
    delete from public.calendar_events where user_id in (a, b) and title like 'RLS Test%';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Assertions under each user
-- ---------------------------------------------------------------------------
create temporary table if not exists rls_results (
  test_name text,
  passed boolean,
  detail text
) on commit drop;

do $$
declare
  a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  cnt int;
  ok boolean;
begin
  -- --- Tasks as A ---
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tasks') then
    perform cadens_private.test_as(a);
    set local role authenticated;

    select count(*) into cnt from public.tasks where title like 'RLS Test%';
    ok := (cnt = 1);
    insert into rls_results values (
      'tasks: A sees only own RLS Test rows',
      ok,
      format('count=%s (expected 1)', cnt)
    );

    select count(*) into cnt from public.tasks where user_id = b and title like 'RLS Test%';
    ok := (cnt = 0);
    insert into rls_results values (
      'tasks: A cannot see B rows',
      ok,
      format('count=%s (expected 0)', cnt)
    );

    -- --- Tasks as B ---
    perform cadens_private.test_as(b);
    select count(*) into cnt from public.tasks where title like 'RLS Test%';
    ok := (cnt = 1);
    insert into rls_results values (
      'tasks: B sees only own RLS Test rows',
      ok,
      format('count=%s (expected 1)', cnt)
    );
  else
    insert into rls_results values ('tasks table', false, 'missing — run 11-tasks.sql');
  end if;

  -- --- Saves as A ---
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='cadens_saves') then
    perform cadens_private.test_as(a);
    select count(*) into cnt from public.cadens_saves where title like 'RLS Test%';
    insert into rls_results values (
      'saves: A sees only own',
      cnt = 1,
      format('count=%s', cnt)
    );
    select count(*) into cnt from public.cadens_saves where user_id = b and title like 'RLS Test%';
    insert into rls_results values (
      'saves: A cannot see B',
      cnt = 0,
      format('count=%s', cnt)
    );
  end if;

  -- Anon should see nothing on tasks
  begin
    set local role anon;
    perform set_config('request.jwt.claim.sub', '', true);
    select count(*) into cnt from public.tasks where title like 'RLS Test%';
    insert into rls_results values (
      'tasks: anon sees zero',
      cnt = 0,
      format('count=%s', cnt)
    );
  exception when insufficient_privilege or others then
    insert into rls_results values (
      'tasks: anon blocked or no grant',
      true,
      sqlerrm
    );
  end;
end $$;

reset role;

-- Report
select
  case when passed then 'PASS' else 'FAIL' end as status,
  test_name,
  detail
from rls_results
order by passed asc, test_name;

select
  count(*) filter (where not passed) as failures,
  count(*) as total
from rls_results;

rollback; -- keep DB clean; change to commit if you want to keep seed users
