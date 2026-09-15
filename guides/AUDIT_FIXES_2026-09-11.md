# Audit & fixes — 2026-09-11

## Bugs found and fixed

| Area | Issue | Fix |
|------|--------|-----|
| SQL / Builder DNA | `daybook_accounts` only had `GRANT SELECT` → UPDATE RPCs failed under invoker | `16-audit-fixes.sql` grants SELECT/INSERT/UPDATE + owner RLS |
| SQL / GitHub RPCs | No account row for new users → UPDATE 0 rows | RPCs `INSERT … ON CONFLICT DO NOTHING` then update |
| Tasks UI | Filter chips showed raw keys `now`/`done` | Labels Now / Today / Planned / Done |
| Pull-to-refresh | Stale React state in touch `end` handler | Refs for pulling/refreshing + stable `onRefresh` |
| Tasks ↔ Plan | (verified OK) done/open prefixes `✓` on calendar titles | already in `set_task_status` |
| Composition | SaveCard / TaskCard / Sheet wiring | verified |

## Verified OK

- `list_tasks` / `create_task` / `update_task` / `delete_task` grants
- App routes including `/notifications`, `/tasks`, `/calendar`, `/journal`
- EmptyState API (`icon`, `action`)
- Task optimistic UI + parent reload
- Calendar `task_id` column + `update_calendar_event`

## Deploy

Run in order through **`16-audit-fixes.sql`** (requires `15-builder-dna.sql` first for GitHub columns).

## Test steps

See [`tests/AUDIT_FIXES_TEST_STEPS.md`](../tests/AUDIT_FIXES_TEST_STEPS.md).
