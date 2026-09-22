# SQL run order (canonical)

Run in **Supabase SQL Editor** top to bottom on a clean or upgraded project.

## Core (required)
1. `00-daybook-baseline.sql` — Daybook RPCs/tables the React app still calls  
2. `01-notifications.sql`  
3. `02-stories.sql` — optional; safe to run  
4. `03-messages.sql`  
5. `04-push.sql`  
6. `05-group-chats.sql`  
7. `06-saves.sql`  
8. `07-idea-boards.sql`  

## Product add-ons
9. `08-journal.sql`  
10. `09-calendar.sql`  
11. `10-retention-habits.sql` — recurring events + journal_today_status  
12. `11-tasks.sql` — tasks + calendar sync (+ update_task)
13. `12-account-deletion.sql` — wipe_my_cadens_data()
14. `13-rls-hardening.sql` — FORCE RLS, tighten policies, revoke anon
15. `14-calendar-task-sync.sql` — update_calendar_event mirrors linked task  

## Archived (do not run)
See `sql/archive/` — superseded duplicates and experimental modules (nearby, contact discovery, etc.).

## After SQL
- Enable Realtime on tables you use (messages, notifications, ideas as needed)  
- Confirm RLS: Dashboard → Authentication/Table Editor → RLS enabled on app tables
- Deploy Edge Functions: `send-push`, optional `generate-embedding`, `unfurl`  
- Set frontend env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_VAPID_PUBLIC_KEY`
16. `15-builder-dna.sql` — optional GitHub Builder DNA cache
17. `16-audit-fixes.sql` — accounts UPDATE grant + GitHub RPC upserts
18. `17-builder-dna-read.sql` — get/disconnect/list visible DNA
19. `18-connected-rhythm-collections.sql` — widens `daybook_sync`/`daybook_load` for Connected Rhythm Phase A collections: habits, focus sessions, mood check-ins and badges
