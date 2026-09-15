# Test steps — Audit fixes (2026-09-11)

Use a **staging** Supabase + Netlify build. Sign in as a normal user (not service role).

**Prereq:** SQL run through `16-audit-fixes.sql` (includes `15-builder-dna.sql`). Frontend redeployed. Optional: Edge Function `github-tier` deployed.

Mark each row: **PASS / FAIL / SKIP** and note environment.

---

## A. SQL / permissions (Builder DNA foundation)

| # | Steps | Expected |
|---|--------|----------|
| A1 | In SQL editor as authenticated user is hard; instead use the app You → Builder DNA section after deploy | Section visible, no crash |
| A2 | Open browser Network tab → call Connect with a **valid public** GitHub username (e.g. `torvalds`) | `set_github_username` RPC **200**; `github-tier` function **200** if deployed; `set_github_dna_cache` **200** |
| A3 | Refresh You page | Tier chip + bio line still make sense after reload **if** you also load from DB (cache write succeeded). If UI only holds React state, reconnect once and confirm Network RPCs succeeded |
| A4 | Call Connect with empty username | Button disabled or validation; no 500 |
| A5 | Call Connect with nonsense username | Soft error toast (404 / not found); app stays usable |
| A6 | **Regression:** Sign up a **brand-new** user → open You → Connect GitHub once | Succeeds even if `daybook_accounts` row did not exist before (upsert path) |

**Fail signals:** RPC 401/403; `permission denied for table daybook_accounts`; function 500; silent success with no Network write.

---

## B. Daily Flow (Tasks UI)

| # | Steps | Expected |
|---|--------|----------|
| B1 | Open **Tasks** | Tabs: **Now · Today · Planned · Done** (not raw `now`/`done`) |
| B2 | Create task **without** due date | Appears under **Now** and **Planned** (no due = inbox / unscheduled); **not** under **Today** |
| B3 | Create task **due today** (with time or all-day) | Under **Today** and **Now**; toast mentions Plan if timed |
| B4 | Create task **due tomorrow** | Under **Planned** only (not Today) |
| B5 | Open **Plan** | Timed tasks show as events |
| B6 | On Tasks, mark a timed task **done** (tap circle) | Check animates immediately (optimistic); row styles as done; after refresh, **Done** tab lists it; Plan title prefixed with `✓` |
| B7 | Reopen that task (tap check) | `✓` removed on Plan; task back in open filters |
| B8 | **Done** tab when empty | Title like “No completed tasks”; no primary “New task” required |
| B9 | **Today** tab when empty | “Nothing due today” (or similar), not generic “No tasks yet” only |

---

## C. Optimistic complete + error rollback

| # | Steps | Expected |
|---|--------|----------|
| C1 | Complete a task online | Instant check + optional pop; stays done after reload |
| C2 | (Optional) DevTools → Network offline → toggle task | UI may flip then **rollback** on failure + error toast |

---

## D. Saves pull-to-refresh

| # | Steps | Expected |
|---|--------|----------|
| D1 | On phone or device emulation, open **Saves**, scroll to **top** | — |
| D2 | Pull down past threshold | Hint: “Release to refresh” |
| D3 | Release | “Refreshing…” then list reloads; no freeze |
| D4 | Pull while mid-list (not at top) | Should **not** arm refresh |

---

## E. Welcome back / streak line

| # | Steps | Expected |
|---|--------|----------|
| E1 | User with streak ≥ 1 who has **not** journaled today → open Saves | Optional amber **WelcomeBack** / streak risk line with Journal link |
| E2 | Dismiss (X) | Hidden for session |
| E3 | User who journaled today or streak 0 | Line absent (or not risk copy) |

---

## F. Task ↔ Plan integrity (regression)

| # | Steps | Expected |
|---|--------|----------|
| F1 | Create task with due date | `calendar_event_id` set; event on Plan |
| F2 | Edit task title + due | Plan event updates |
| F3 | Delete task | Plan event removed |
| F4 | User B cannot see User A tasks/events | Empty / denied |

---

## G. Navigation / shell (smoke)

| # | Steps | Expected |
|---|--------|----------|
| G1 | Tab Saves → Progress → People → You | No blank screen; progress bar may flash |
| G2 | You → Tasks, Plan, Journal, Notifications | Routes resolve |
| G3 | Auth loading screen | Brand + dots; not white flash |
| G4 | Offline (SW) | Banner or offline page on hard nav; no API cache poisoning |

---

## H. Quick SQL sanity (dashboard)

Run as **postgres** / service role in SQL editor:

```sql
-- Grants present
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'daybook_accounts'
  and grantee = 'authenticated';

-- Columns present
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'daybook_accounts'
  and column_name like 'github%';
```

Expected: `SELECT`, `INSERT`, `UPDATE` for `authenticated`; columns `github_username`, `github_tier`, `github_score`, `github_bio_line`, `github_refreshed_at`, `github_visible`.

---

## Sign-off

| Area | Tester | Date | Result |
|------|--------|------|--------|
| A Builder DNA / grants | | | |
| B Daily Flow UI | | | |
| C Optimistic complete | | | |
| D Pull-to-refresh | | | |
| E Welcome back | | | |
| F Task ↔ Plan | | | |
| G Shell smoke | | | |
| H SQL grants | | | |

**Release note:** Do not ship Builder DNA messaging until A2 + A6 PASS. Daily Flow labels/empty copy can ship if B1 + B8 PASS even when GitHub Edge is deferred.
