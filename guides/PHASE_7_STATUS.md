# Phase 7 — QA gates & release hardening (2026-09-10)

## Shipped in this phase

| Item | Detail |
|------|--------|
| **Data export** | You → Export my data → JSON (`lib/exportData.ts`) |
| **Delete account** | Wipe RPC + optional `delete-account` Edge invoke + sign out |
| **Plan → Task sync** | `14-calendar-task-sync.sql` `update_calendar_event` mirrors `task_id` |
| **Client** | `updateEvent()` in `lib/calendar.ts` |
| **E2E matrix** | Extended Tasks↔Plan, cross-links, compliance rows |

## Run on staging

1. SQL: through `14-calendar-task-sync.sql` (`RUN_ORDER.md`)  
2. Optional: deploy `edge-function/delete-account`  
3. Execute `tests/RELEASE_E2E_MATRIX.md` (especially TASK-* and COMP-*)  
4. Execute `tests/RLS_TEST_PLAN.md` + optional pg_net runbook  

## Definition of done (plan) — status

- [x] One SQL run order + archive  
- [x] Single You; notifications + badge  
- [x] App mode removed/archived  
- [x] Task CRUD keeps Plan in sync  
- [x] Plan edit can update linked task (SQL + client)  
- [x] Today strip  
- [x] Save → Task  
- [x] Orphans archived  
- [x] Modules documented  
- [x] UI pass (practical)  
- [x] Account deletion actionable  
- [ ] E2E matrix **executed on staging** (human sign-off)

## Next after Phase 7

- Staging sign-off of E2E matrix  
- Store listing assets / screenshots  
- Production Netlify + Supabase cutover checklist in `DEPLOY.md`
