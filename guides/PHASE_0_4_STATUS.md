# Phases 0–4 status (2026-09-10)

## Phase 0 — Stabilize ✅
- Canonical SQL: `00`→`11-tasks.sql` only in `sql/`
- Duplicates/experimental in `sql/archive/`
- `sql/RUN_ORDER.md` rewritten
- `supabase.ts` requires env vars (no hardcoded keys)
- `.env.example` updated with optional feature flags
- Calendar default color → brand blue `#2563EB`

## Phase 1 — Surfaces ✅
- `/you` → ProfilePage (unified)
- `/notifications` live; link from You
- Product links: Tasks, Plan, Journal, Notifications
- You sections: **Product** / **Legal**
- Orphan pages moved to `pages/archive/`
- App mode half-feature removed (YouPage re-export → archive)

## Phase 2 — Tasks ↔ Plan ✅
- `11-tasks.sql` includes `create_task`, `update_task`, status, delete + calendar sync
- `lib/tasks.ts` + TasksPage create/edit/done/delete

## Phase 3 — Connections ✅
- TodayStrip on Saves
- RetentionNudge (due tasks + streak + Plan)
- Save → Task, Progress → As task, Journal → Schedule on Plan

## Phase 4 — Modules ✅
- Decisions in `guides/MODULES.md`
- `lib/features.ts` flags for future experiments
- Stories / Nearby / PeoplePage UI archived under `components/archive` and `pages/archive`

## Still open (Phase 5–6)
- Full UI primitive pass on every screen
- Executable account deletion (Edge Function)
- Notification unread badge on tab bar
- E2E QA on staging
