# Cadens — Implementation plan to resolve review issues

Date: 2026-09-10  
Scope: Connection gaps, missing functionality, logic risks, UI/UX, SQL hygiene, store readiness  
Source: Full app review (Saves · Progress · People · You + Journal · Plan · Tasks)

---

## Goals

1. One clear product spine with **connected** objects (especially time-based work ↔ Plan).
2. No orphan screens or ambiguous SQL deploy paths.
3. Predictable UX: find Tasks / Plan / Journal / Notifications without archaeology.
4. Ship-safe: account deletion path, consistent brand, fewer foot-guns.

Non-goals (this plan): rebuild as campaign/marketing automation SaaS; full Google Calendar sync; native App Store binaries.

---

## Phase 0 — Stabilize deploy path (1–2 days)

**Problems:** Duplicate SQL (`05`/`06` saves, `08`/`13` journal, `09`/`14` calendar, etc.); unclear `RUN_ORDER`.

### Tasks
| ID | Task | Acceptance |
|----|------|------------|
| 0.1 | Choose **canonical SQL set** only | Single ordered list 00→N with no conflicting duplicates |
| 0.2 | Move superseded files to `sql/archive/` | Archive not run in production |
| 0.3 | Rewrite `sql/RUN_ORDER.md` | Copy-paste order; notes for optional modules |
| 0.4 | Document required Edge Functions + secrets | `DEPLOY.md` checklist matches reality |
| 0.5 | Confirm `supabase.ts` uses **env only** (no hardcoded keys) | Missing env fails fast |

### Canonical order (proposed)
```text
00-daybook-baseline.sql          # if still required by RPCs
01-notifications.sql
02-stories.sql                   # optional
03-messages.sql
04-push.sql
05-group-chats.sql
06-saves.sql                     # one saves migration only
07-idea-boards.sql
08-journal.sql                   # one journal only
09-calendar.sql                  # one calendar only
10-retention-habits.sql
16-tasks.sql                     # renumber to 11-tasks.sql when cleaning
```
Drop or archive: duplicate saves/progress/semantic/nearby/contact unless product commits to them in Phase 4.

### Exit criteria
- Fresh Supabase project can run migrations in order without “already exists” chaos.
- Frontend `.env.example` lists every required var.

---

## Phase 1 — Fix broken / half-wired product surfaces (2–3 days)

**Problems:** YouPage vs ProfilePage; notifications redirected away; app mode ignored; orphan routes.

### Tasks
| ID | Task | Acceptance |
|----|------|------------|
| 1.1 | **Unify You** | `/you` renders one page: identity, push, product links (Tasks/Plan/Journal), legal, mode (if kept), logout |
| 1.2 | Merge useful `YouPage` controls into `ProfilePage` (or rename) | Delete dead duplicate or re-export only |
| 1.3 | **Notifications entry** | You → Notifications; restore `/notifications` route to `NotificationsPage` |
| 1.4 | Unread badge | Shell or You shows count from existing unread RPC/local helper |
| 1.5 | App mode decision | **A)** Wire shell nav to `getAppMode()` **or** **B)** Remove mode API and copy to reduce confusion |
| 1.6 | Route audit | Every file under `pages/` is routed, redirected, or deleted/archived |
| 1.7 | Hide Explore/Feed from IA | Redirects only; no dead buttons |

### Recommended mode decision
- Prefer **B** short-term (remove half mode) unless Journal-first nav is a committed product bet.
- If **A**: Cadens nav = Saves/Progress/People/You; Journal mode nav = Journal/Plan/Tasks/You.

### Exit criteria
- User can open Notifications in ≤2 taps from You.
- No page in repo that looks “live” but is unreachable without confusion.

---

## Phase 2 — Task ↔ calendar bi-directional integrity (2–3 days)

**Problems:** No task edit; Plan events don’t become tasks; title/due drift; cancel/done edge cases.

### Tasks
| ID | Task | Acceptance |
|----|------|------------|
| 2.1 | SQL `update_task(p_id, title, notes, due_at, all_day)` | Updates task row |
| 2.2 | When `due_at` set/changed | Upsert linked `calendar_events` (create if missing, update if present, delete link+event if due cleared) |
| 2.3 | UI: edit task sheet | Change title, notes, due date/time, all-day |
| 2.4 | Done / open / cancel | Calendar title rules documented + implemented (`✓` prefix or status field) |
| 2.5 | Delete rules | Already deletes event; add confirm dialog in UI |
| 2.6 | Optional: “Convert event → task” on Plan | Creates task with `calendar_event_id` set, `task_id` on event |
| 2.7 | Calendar event edit | Edit title/time on Plan updates linked task when `task_id` present |

### Data rules
```text
Task with due_at  → must have calendar_event_id (after create/update)
Task without due  → calendar_event_id null; no orphan events
Delete task       → delete linked event
Delete event      → either null task due + unlink, or delete task (pick one; recommend unlink + clear due)
```

### Exit criteria
- Create / edit / complete / delete task keeps Plan accurate after refresh.
- No duplicate events for one task.

---

## Phase 3 — Cross-feature connections (3–5 days)

**Problems:** Saves/Progress/Journal siloed from Tasks/Plan.

### 3.1 Today strip (high UX impact)
- Component on **Saves** (home) and/or **You**
- Shows: tasks due today, next Plan event, journal wrote-today/streak
- Actions: Open Tasks / Plan / Journal

### 3.2 Saves → Task
- On Save card menu: “Create task…”
- Pre-fill title from save title/url; optional due date → Plan sync via existing create_task

### 3.3 Progress ↔ Tasks (light)
- Optional `task_id` on progress post **or** note in body
- “Log progress” from open task (creates progress post text)

### 3.4 Journal → Plan (light)
- “Schedule reflection” → creates calendar event (type/note) without full task
- Or: task “Journal today” template

### 3.5 Retention nudge
- Restore `RetentionNudge` on Saves after ship overwrite
- Include Tasks due today in copy

### Exit criteria
- New user can go Save → Task with time → see on Plan without using You menu only.
- Home shows at least one “what matters today” signal.

---

## Phase 4 — Optional modules: keep or cut (1–2 days decision + work)

**Problems:** Nearby, contact discovery, semantic search, stories half-present.

For each module choose **Ship / Beta behind flag / Archive**:

| Module | Recommendation |
|--------|----------------|
| Stories | Archive or optional SQL only — not in v2 nav |
| Nearby / discovery | Archive unless mobile geolocation QA scheduled |
| Contact hash match | Archive or Beta |
| Semantic search | Beta if embedding function deployed; else keyword only |
| Idea boards | **Ship** — already in group UX |

### Tasks
| ID | Task |
|----|------|
| 4.1 | Product decision table signed off |
| 4.2 | Remove nav/entry points for archived modules |
| 4.3 | Archive SQL + pages to `archive/` |
| 4.4 | Feature flags for Beta (`VITE_FEATURE_*`) |

---

## Phase 5 — UI/UX consistency (2–3 days)

**Problems:** Uneven empty states, Profile laundry list, brand mismatch, calendar default color.

### Tasks
| ID | Task | Acceptance |
|----|------|------------|
| 5.1 | Apply `PageHeader` + `EmptyState` + `Button` on Saves, Progress, Tasks, Plan, Journal | Visual consistency |
| 5.2 | Group You sections | Product · Account · Legal |
| 5.3 | Calendar default color → brand blue `#2563EB` | SQL default + UI |
| 5.4 | Progress privacy microcopy | One line under control explaining audience |
| 5.5 | Confirm dialogs | Delete task/event/save |
| 5.6 | Toast verbs | Consistent success/error language |
| 5.7 | Reduced motion | Already global; verify task/calendar sheets |

---

## Phase 6 — Store / compliance completion (1–2 days)

**Problems:** Delete account not executable; legal placeholders.

### Tasks
| ID | Task | Acceptance |
|----|------|------------|
| 6.1 | Implement `delete_own_account` (Edge Function or guided flow) | User can request/perform delete |
| 6.2 | Replace placeholder support emails in Legal | Real contact |
| 6.3 | Privacy text matches real data (tasks, calendar, journal) | Review pass |
| 6.4 | Data export (optional P1) | JSON export of user content |

---

## Phase 7 — QA gates (ongoing per phase)

| Gate | Checks |
|------|--------|
| SQL | Clean migrate on empty project |
| Auth | Signup, login, logout, reset |
| Saves | CRUD + search |
| Progress | Create + appear in list |
| People | Group + idea board vote/decide |
| Tasks↔Plan | Create timed, edit, done, delete |
| Journal | Entry, streak, on-this-day |
| Notifications | List + mark read + badge |
| Mobile | iOS Safari + Android Chrome, safe areas |
| Regression | No console errors on main paths |

Use/extend: `tests/RELEASE_E2E_MATRIX.md`, `tests/RLS_TEST_PLAN.md`.

---

## Suggested timeline

| Week | Focus |
|------|--------|
| Week 1 | Phase 0 + 1 + 2 (stabilize, You/notifications, task↔calendar integrity) |
| Week 2 | Phase 3 + 5 (connections + UI consistency) |
| Week 3 | Phase 4 + 6 + full QA (cut modules, compliance, harden) |

---

## Ownership cheat sheet

| Area | Primary artifacts |
|------|-------------------|
| SQL | `sql/RUN_ORDER.md`, `16-tasks.sql` → renumber, archive/ |
| You / notifications | `ProfilePage.tsx`, `NotificationsPage.tsx`, `App.tsx`, `AppShell.tsx` |
| Tasks ↔ calendar | `lib/tasks.ts`, `lib/calendar.ts`, `TasksPage.tsx`, `CalendarPage.tsx` |
| Today / retention | `components/retention/*`, `SavesPage.tsx` |
| Brand / UI | `styles/index.css`, `components/ui/*`, `BrandMark.tsx` |
| Compliance | `LegalPage.tsx`, Edge `delete` function |

---

## Definition of done (all issues plan)

- [ ] One SQL run order; archives only for legacy
- [ ] Single You experience; notifications reachable + badge
- [ ] App mode fully wired or removed
- [ ] Task create/edit/done/delete keeps Plan in sync
- [ ] Plan edit respects linked tasks
- [ ] Today strip on home or You
- [ ] Save → Task path exists
- [ ] Orphan pages routed or removed
- [ ] Optional modules explicitly shipped or archived
- [ ] UI primitives consistent on primary screens
- [ ] Account deletion actionable
- [ ] E2E matrix paths pass on staging

---

## Immediate next slice (start implementation)

1. Phase 0.1–0.3 — canonical SQL + RUN_ORDER  
2. Phase 1.1–1.3 — unified You + notifications route  
3. Phase 2.1–2.3 — `update_task` + edit UI + calendar upsert  

This unblocks trust in “everything is connected” before broader cross-links.


---

## Status log

- **Phase 3 (2026-09-10):** TodayStrip on Saves; RetentionNudge + due tasks; Save → Task; Progress → As task; Journal → Schedule on Plan.
