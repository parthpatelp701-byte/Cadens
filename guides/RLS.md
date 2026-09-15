# Supabase Row Level Security (Cadens)

## Model

| Data | Access rule |
|------|-------------|
| Saves, Tasks, Plan, Journal | **Owner only** (`user_id = auth.uid()`) |
| Notifications, push subs | **Owner only** |
| Groups / members / posts | **Membership** + privacy payload |
| Messages | **Conversation membership** |
| Idea boards | **Group membership** (hardened in `13-rls-hardening.sql`) |

## Deploy

Run in order through `13-rls-hardening.sql` (see `sql/RUN_ORDER.md`).

Hardening does:
1. `ENABLE` + **`FORCE ROW LEVEL SECURITY`** on known tables  
2. **Revoke anon** table privileges  
3. Replace open idea-board policies with membership checks  
4. Replace reactions `using (true)` with post-scoped access  
5. Reinforce message/conversation policies  

## Client rules

- Always use the **anon/publishable key** + user JWT (Supabase JS client after login).  
- Never ship the **service role** key in the frontend.  
- Prefer **RPCs** (`security invoker`) so checks run as the user.  

## Quick test (SQL as user A vs B)

```sql
-- As user A JWT: should only see own tasks
select count(*) from tasks;

-- As user B: should not see A's tasks
select * from tasks where user_id = '<user-a-uuid>'; -- empty under RLS
```

Dashboard: **Table Editor → RLS policies** should list policies per table.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Empty data after login | Policy too strict / column name mismatch (`user_id` vs `owner_id`) |
| Idea boards empty | `group_id` type / membership status not `active` |
| RPC works, table select fails | Expected if only RPC is granted — keep using RPCs |


## Automated testing

| Method | Location |
|--------|----------|
| JWT simulation in SQL | `sql/tests/rls_jwt_simulation.sql` |
| pg_net → PostgREST | `sql/tests/rls_pg_net_http.sql` |
| Runbook | `tests/RLS_PG_NET_RUNBOOK.md` |
| Manual matrix | `tests/RLS_TEST_PLAN.md` |

`pg_net` validates RLS the way the **browser** hits PostgREST (JWT + `apikey`). JWT simulation validates `auth.uid()` policies inside Postgres without HTTP.


Filter syntax reference: [`guides/POSTGREST_FILTERS.md`](POSTGREST_FILTERS.md).

JSON/JSONB operators: [`POSTGREST_JSON.md`](POSTGREST_JSON.md).
