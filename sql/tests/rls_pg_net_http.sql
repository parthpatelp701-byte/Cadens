-- Cadens RLS tests via pg_net → PostgREST
-- Exercises the same path the browser uses (REST + JWT), not only in-SQL auth.uid().
--
-- PREREQUISITES
-- 1) create extension if not exists pg_net with schema extensions;
-- 2) Replace the GUC placeholders below (or set session vars before run)
-- 3) Have two user access tokens (sign in as A and B in app / Auth API)
--
-- In Supabase SQL Editor, set:
--   select set_config('cadens.test.base_url', 'https://YOUR_REF.supabase.co', false);
--   select set_config('cadens.test.anon_key', 'eyJ...anon...', false);
--   select set_config('cadens.test.jwt_a', 'eyJ...user_a_access_token...', false);
--   select set_config('cadens.test.jwt_b', 'eyJ...user_b_access_token...', false);

create extension if not exists pg_net with schema extensions;

create or replace function cadens_private.rls_http_get(
  p_path text,
  p_jwt text
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base text := current_setting('cadens.test.base_url', true);
  anon text := current_setting('cadens.test.anon_key', true);
  url text;
  req_id bigint;
begin
  if base is null or anon is null or p_jwt is null then
    raise exception 'Set cadens.test.base_url, cadens.test.anon_key, and pass a user JWT';
  end if;
  url := rtrim(base, '/') || p_path;
  req_id := net.http_get(
    url := url,
    headers := jsonb_build_object(
      'apikey', anon,
      'Authorization', 'Bearer ' || p_jwt,
      'Accept', 'application/json'
    ),
    timeout_milliseconds := 5000
  );
  return req_id;
end;
$$;

create or replace function cadens_private.rls_http_post_json(
  p_path text,
  p_jwt text,
  p_body jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base text := current_setting('cadens.test.base_url', true);
  anon text := current_setting('cadens.test.anon_key', true);
  url text;
  req_id bigint;
begin
  if base is null or anon is null or p_jwt is null then
    raise exception 'Missing test GUCs or JWT';
  end if;
  url := rtrim(base, '/') || p_path;
  req_id := net.http_post(
    url := url,
    body := p_body,
    headers := jsonb_build_object(
      'apikey', anon,
      'Authorization', 'Bearer ' || p_jwt,
      'Accept', 'application/json',
      'Content-Type', 'application/json',
      'Prefer', 'return=representation'
    ),
    timeout_milliseconds := 5000
  );
  return req_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fire requests (async). Then poll net._http_response.
-- ---------------------------------------------------------------------------
-- Example runbook (uncomment and replace nothing if GUCs already set):

/*
-- 1) Fire
select cadens_private.rls_http_get('/rest/v1/tasks?select=id,title,user_id', current_setting('cadens.test.jwt_a')) as req_tasks_a;
select cadens_private.rls_http_get('/rest/v1/tasks?select=id,title,user_id', current_setting('cadens.test.jwt_b')) as req_tasks_b;
select cadens_private.rls_http_get('/rest/v1/cadens_saves?select=id,title,user_id', current_setting('cadens.test.jwt_a')) as req_saves_a;
-- anon-style: use anon key as bearer too
select net.http_get(
  url := rtrim(current_setting('cadens.test.base_url'), '/') || '/rest/v1/tasks?select=id',
  headers := jsonb_build_object(
    'apikey', current_setting('cadens.test.anon_key'),
    'Authorization', 'Bearer ' || current_setting('cadens.test.anon_key'),
    'Accept', 'application/json'
  )
) as req_tasks_anon;

-- 2) Wait briefly
select pg_sleep(1.5);

-- 3) Inspect
select
  id,
  status_code,
  left(content::text, 300) as body_preview,
  error_msg
from net._http_response
order by id desc
limit 10;
*/

-- Automated checker: given response ids, assert status + body rules
create or replace function cadens_private.rls_assert_http(
  p_label text,
  p_request_id bigint,
  p_expect_status int,
  p_body_must_not_include text default null
)
returns table (label text, passed boolean, status_code int, detail text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
begin
  select * into r from net._http_response where id = p_request_id;
  if not found then
    label := p_label;
    passed := false;
    status_code := null;
    detail := 'no response yet — wait and retry';
    return next;
    return;
  end if;

  label := p_label;
  status_code := r.status_code;
  passed := (r.status_code = p_expect_status);
  detail := left(coalesce(r.content::text, r.error_msg, ''), 200);

  if passed and p_body_must_not_include is not null
     and coalesce(r.content::text, '') ilike '%' || p_body_must_not_include || '%' then
    passed := false;
    detail := 'body contained forbidden marker: ' || p_body_must_not_include;
  end if;
  return next;
end;
$$;

comment on function cadens_private.rls_http_get is
  'pg_net GET against PostgREST for RLS checks; set cadens.test.* GUCs first';
