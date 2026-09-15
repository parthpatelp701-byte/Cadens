# Cadens v2 — Release E2E Matrix

This matrix is intentionally executable against a staging Supabase/Netlify deployment. Do not mark a test PASS from source inspection alone.

## P0 — Security and access

| ID | Test | Expected |
|---|---|---|
| AUTH-01 | Valid login | Session established |
| AUTH-02 | Invalid password | No session; safe error |
| AUTH-03 | Session expiry | Protected calls fail safely and user can re-authenticate |
| AUTH-04 | Sign out | Session/token cleared |
| RLS-01 | User A reads User B private journal | Denied / no rows |
| RLS-02 | User A reads User B private save | Denied / no rows |
| RLS-03 | User A accesses User B notifications | Denied |
| RLS-04 | Non-member reads group post | Denied |
| RLS-05 | Member reads group post | Allowed |
| RLS-06 | Non-owner approves group member | Denied |
| RLS-07 | User invokes send-push for another user | 403 |
| EDGE-01 | Unauthenticated Edge Function call | 401/403 |
| SSRF-01 | Unfurl localhost | Rejected |
| SSRF-02 | Unfurl 127.0.0.1 | Rejected |
| SSRF-03 | Unfurl private RFC1918 target | Rejected |
| SSRF-04 | Redirect to private target | Rejected |
| SSRF-05 | >3 redirects | Rejected/bounded |

## P1 — Product flows

- Saves: create/edit/delete, link unfurl, image upload, keyword search, semantic search.
- Feed: create text/photo post, privacy, group visibility, likes, comments, realtime refresh.
- Groups: create, invite, join request, approve/reject, leave/delete, members.
- Stories: create, expiry, viewer tracking, group/family visibility.
- Messages: start conversation, send/list messages, unread state, realtime.
- Notifications: list, mark read, unread count, realtime badge.
- Ideas: boards, ideas, reactions, decision state, membership enforcement.
- Progress: create/list, group visibility.
- Journal: create/edit/delete, media, today, streak, On This Day, local-midnight boundary.
- Calendar: quick add, month/week/agenda, recurring events, reminders, timezone.
- Nearby: permission grant/deny, session start/stop, no location persistence outside intended session.

## PWA/mobile

- Manifest loads with HTTP 200.
- 192px and 512px icons load with HTTP 200.
- Service worker registers.
- Offline fallback works.
- Chrome/Edge desktop geolocation permission works.
- Safari/iOS permission behavior verified.
- Push subscription/unsubscription works.
- Real encrypted push received on supported browsers.

## Performance

Run with staging data at 100, 1k, 10k and 50k rows.

Measure initial load, feed load, search, group list, realtime bursts, save creation and push fan-out. Record p50/p95 latency, browser memory, error rate and dropped realtime events.

---

## P1b — Tasks ↔ Plan (Phase 2/7)

| ID | Test | Expected |
|----|------|----------|
| TASK-01 | Create task without due | Task listed; no calendar event |
| TASK-02 | Create task with due date/time | Task has `calendar_event_id`; event on Plan |
| TASK-03 | Edit task title/due | Linked Plan event title/starts_at updated |
| TASK-04 | Mark task done | Event title prefixed `✓` (or status rule) |
| TASK-05 | Reopen task | `✓` prefix removed |
| TASK-06 | Delete task | Linked calendar event removed |
| TASK-07 | Edit Plan event that has `task_id` | Linked task title/due updated (`update_calendar_event`) |
| TASK-08 | User B cannot read User A tasks/events | Empty / denied (RLS) |

## P1c — Cross-links (Phase 3)

| ID | Test | Expected |
|----|------|----------|
| XLINK-01 | Saves → Task | Task created from save title/body |
| XLINK-02 | Progress → As task | Task created from composer text |
| XLINK-03 | Journal → Schedule on Plan | Evening journal event appears |
| XLINK-04 | Today strip | Shows due tasks / next event / journal status when data exists |
| XLINK-05 | Retention nudge | Shows when due tasks or streak risk |

## P1d — Compliance (Phase 6/7)

| ID | Test | Expected |
|----|------|----------|
| COMP-01 | Privacy / Terms reachable | From You and Auth |
| COMP-02 | Export my data | JSON download with tasks/saves/journal/events |
| COMP-03 | Delete my Cadens data | Wipe RPC succeeds; signed out; data gone on re-login as same user only if auth remains |
| COMP-04 | Optional Edge delete-account | Auth user removed when function deployed |

## QA sign-off

| Area | Owner | Date | Result |
|------|-------|------|--------|
| SQL migrate 00–14 | | | |
| Auth | | | |
| Saves / Progress / People | | | |
| Tasks ↔ Plan | | | |
| Journal / Plan | | | |
| Notifications badge | | | |
| Mobile Safari + Chrome | | | |
| RLS matrix | | | |
