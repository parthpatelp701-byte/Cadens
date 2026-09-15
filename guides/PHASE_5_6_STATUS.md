# Phases 5–6 status (2026-09-10)

## Phase 5 — UI/UX ✅ (practical pass)
- Progress privacy microcopy under audience control
- Saves empty state uses `EmptyState`
- You already grouped Product / Legal
- Calendar brand color `#2563EB` (Phase 0)
- Confirm on Saves/Tasks delete already present
- Reduced motion global in CSS

## Phase 6 — Compliance ✅
- Privacy policy updated for Saves, Progress, Groups, Tasks, Plan, Journal, push
- Terms contact `support@cadens.app`
- **Delete account** UI: calls `wipe_my_cadens_data` + sign out
- SQL: `12-account-deletion.sql`
- Optional Edge Function: `edge-function/delete-account` (service role full auth delete)

## Deploy
1. Run `12-account-deletion.sql`
2. Redeploy frontend
3. (Optional) Deploy Edge `delete-account` and wire after wipe
