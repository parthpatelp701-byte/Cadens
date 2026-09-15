# Phase 0 + 1 + 2 — executed

## Phase 0 — Stabilize
- [x] Canonical SQL kept: 00–11 (tasks as `11-tasks.sql`)
- [x] Duplicates moved to `sql/archive/`
- [x] `sql/RUN_ORDER.md` rewritten
- [x] `supabase.ts` env-only (throws if missing)
- [x] Calendar default color `#2563EB`

## Phase 1 — Surfaces
- [x] `/notifications` → `NotificationsPage` (no longer redirects to You)
- [x] You (`ProfilePage`): Notifications + Tasks + Journal + Plan + legal
- [x] Unread badge on You (desktop + mobile nav)
- [x] App mode: left as API on journal lib; primary You is Profile (YouPage re-exports Profile)
- [x] YouPage de-orphaned via re-export

## Phase 2 — Tasks ↔ Plan
- [x] `update_task` RPC (title/notes/due/clear due → calendar upsert/remove)
- [x] `lib/tasks.ts` → `updateTask`
- [x] Tasks UI: create + **edit** (tap title), confirm delete
- [x] Toasts distinguish Plan sync

## Deploy
```text
sql/11-tasks.sql   # includes update_task — re-run on existing projects
# Full greenfield: sql/RUN_ORDER.md 00→11
```

## Still open (later phases)
- Plan event → create task
- Edit calendar event → update linked task
- Today strip, Save→Task
- Account delete RPC
- Module archive of Stories/Nearby UI
