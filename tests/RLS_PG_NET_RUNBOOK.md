# Test RLS with pg_net (and JWT simulation)

Two complementary approaches:

| Method | File | What it proves |
|--------|------|----------------|
| **JWT simulation** | `sql/tests/rls_jwt_simulation.sql` | `auth.uid()` + table RLS inside Postgres |
| **pg_net → PostgREST** | `sql/tests/rls_pg_net_http.sql` | Same path as the web app (HTTP + JWT) |

Use **staging**, not production.

---

## A) Fast path — JWT simulation (no tokens needed)

1. Apply migrations through `13-rls-hardening.sql`.
2. Open **Supabase → SQL Editor**.
3. Paste and run `sql/tests/rls_jwt_simulation.sql`.
4. Read the result grid: every row should be **PASS**.

Script rolls back by default so seed data is not kept.

---

## B) pg_net path — real REST + user JWTs

### 1. Enable extension
```sql
create extension if not exists pg_net with schema extensions;
```

### 2. Get two access tokens
Sign in as user A and user B (app or Auth API). Copy each `access_token`.

### 3. Set session config
```sql
select set_config('cadens.test.base_url', 'https://YOUR_PROJECT.supabase.co', false);
select set_config('cadens.test.anon_key', 'YOUR_ANON_KEY', false);
select set_config('cadens.test.jwt_a', 'USER_A_ACCESS_TOKEN', false);
select set_config('cadens.test.jwt_b', 'USER_B_ACCESS_TOKEN', false);
```

### 4. Load helpers
Run `sql/tests/rls_pg_net_http.sql` once per database.

### 5. Fire requests
```sql
select cadens_private.rls_http_get(
  '/rest/v1/tasks?select=id,title,user_id',
  current_setting('cadens.test.jwt_a')
) as req_a;

select cadens_private.rls_http_get(
  '/rest/v1/tasks?select=id,title,user_id',
  current_setting('cadens.test.jwt_b')
) as req_b;

-- anon should not list private tasks
select net.http_get(
  url := rtrim(current_setting('cadens.test.base_url'), '/') || '/rest/v1/tasks?select=id',
  headers := jsonb_build_object(
    'apikey', current_setting('cadens.test.anon_key'),
    'Authorization', 'Bearer ' || current_setting('cadens.test.anon_key')
  )
) as req_anon;
```

### 6. Wait and read responses
```sql
select pg_sleep(1.5);

select id, status_code, left(content::text, 400) as body, error_msg
from net._http_response
order by id desc
limit 15;
```

### 7. Assert
```sql
-- Replace IDs with the request ids returned in step 5
select * from cadens_private.rls_assert_http('tasks as A', 123, 200);
select * from cadens_private.rls_assert_http('tasks as B', 124, 200);
select * from cadens_private.rls_assert_http('tasks as anon', 125, 200); -- body should be [] 
```

**PASS criteria**
- A’s tasks response never includes B’s `user_id` rows.
- B’s response never includes A’s rows.
- Anon gets `[]` or 401/403 (not another user’s rows).
- Cross-user `PATCH`/`DELETE` on a known foreign id returns 0 rows / 404 / 403.

### Cross-user write probe
```sql
-- B tries to update A's task id (replace TASK_A_ID)
select net.http_post(
  -- use PATCH via postgrest: actually http_post with Prefer or use raw
  url := rtrim(current_setting('cadens.test.base_url'), '/')
    || '/rest/v1/tasks?id=eq.TASK_A_ID',
  body := '{"title":"hacked"}'::jsonb,
  params := '{}'::jsonb,
  headers := jsonb_build_object(
    'apikey', current_setting('cadens.test.anon_key'),
    'Authorization', 'Bearer ' || current_setting('cadens.test.jwt_b'),
    'Content-Type', 'application/json',
    'Prefer', 'return=representation'
  )
);
-- Prefer: status 200 with empty array, or 404 — never a row owned by A.
```

> Note: `pg_net` may expose `http_get` / `http_post` only. For PATCH, use PostgREST `POST` with a RPC that attempts update, or test writes from the JS client.

---

## C) Manual client matrix (from RLS_TEST_PLAN.md)

Still required for groups, messages, and push:

1. Private journal/save visible only to owner  
2. Pending group member cannot read group content  
3. Non-member cannot read DMs  
4. Push send for another user_id → 403  

---

## Cleanup

```sql
delete from public.tasks where title like 'RLS Test%';
delete from public.cadens_saves where title like 'RLS Test%';
-- optional: delete auth test users in staging only
```


---

## D) PostgREST filter probes (pg_net)

Full operator reference: `guides/POSTGREST_FILTERS.md`.

After GUCs are set (`base_url`, `anon_key`, `jwt_a`, `jwt_b`):

```sql
-- A: open tasks only
select cadens_private.rls_http_get(
  '/rest/v1/tasks?select=id,title,user_id,status&status=eq.open&order=due_at.asc',
  current_setting('cadens.test.jwt_a')
) as tasks_open_a;

-- A: tasks with no due date
select cadens_private.rls_http_get(
  '/rest/v1/tasks?select=id,title&due_at=is.null',
  current_setting('cadens.test.jwt_a')
) as tasks_null_due_a;

-- Saves: recent notes
select cadens_private.rls_http_get(
  '/rest/v1/cadens_saves?select=id,title,user_id,kind&kind=eq.note&order=created_at.desc&limit=10',
  current_setting('cadens.test.jwt_a')
) as saves_notes_a;

-- Calendar: from a date forward
select cadens_private.rls_http_get(
  '/rest/v1/calendar_events?select=id,title,user_id,starts_at&starts_at=gte.2026-09-01T00:00:00Z&order=starts_at.asc',
  current_setting('cadens.test.jwt_a')
) as events_a;

-- B must not see A's rows even with a wide select
select cadens_private.rls_http_get(
  '/rest/v1/tasks?select=id,title,user_id',
  current_setting('cadens.test.jwt_b')
) as tasks_all_b;

select pg_sleep(1.5);

select id, status_code, left(content::text, 400) as body
from net._http_response
order by id desc
limit 15;
```

**PASS**

- `status=eq.open` responses only include `open` rows visible to that user.
- B’s `tasks` body never contains A’s `user_id`.
- `due_at=is.null` never returns rows that have a due timestamp.
- Anon + anon bearer on `/rest/v1/tasks?select=id` returns `[]` or 401 — not tenant data.
