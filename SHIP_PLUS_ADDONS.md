# Ship intake + additive features

## Current intake (cadens-v2-ship) — preserved
- Tabs: **Saves · Progress · People · You**
- SQL core: 01–07 (`05-group-chats`, `06-saves`, `07-idea-boards`)
- Group idea boards, saves search, progress, messages, push

## Additive (does not replace ship product)
| Feature | Route | SQL | Entry point |
|---------|-------|-----|-------------|
| Journal | `/journal` | `08-journal.sql` | You → Journal |
| Plan (calendar) | `/calendar` | `09-calendar.sql` | You → Plan |
| Retention habits | — | `10-retention-habits.sql` | Saves soft nudge |

## Intentionally not forced into primary nav
Keeps ship “iOS-simple” four tabs. Journal/Plan are habit tools, not a fifth competing tab.

## Deploy
1. Run ship SQL 01→07
2. Optionally run 08→10 for Journal/Plan/retention
3. Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
4. `npm install && npm run build`
