# SQL run order

Run these in the **Supabase SQL Editor**, one after another:

1. `01-notifications.sql`
2. `02-stories.sql` (optional for v2 — Stories UI removed)
3. `03-messages.sql`
4. `04-push.sql`
5. `05-group-chats.sql`
6. **`06-saves.sql`** — Saves + keyword/AI search RPCs
7. **`07-idea-boards.sql`** — Group idea boards

If a statement errors because an object already exists, you can usually re-run;
migrations use `if not exists` / `create or replace` where possible.

After running, enable **Realtime** for messages/notifications as needed.
