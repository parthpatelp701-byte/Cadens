# Cadens v2 ship notes

## Nav cleanup
- Tabs: **Saves · Progress · People · You**
- Removed from nav: Home feed, Explore, Messages, Alerts (Messages still at `/messages` from group)

## Saves
- SQL: `06-saves.sql`
- UI: `/` SavesPage — link/note capture, list, delete
- Search: debounced keyword + AI path (`cadens_saves_search` / `cadens_saves_search_ai`)
- Note on save improves AI find later

## Idea boards
- SQL: `07-idea-boards.sql`
- UI: People → Group → **Idea boards** → board → ideas, vote, Pick (decide)

## Progress
- `/progress` — short updates via existing `createPost` / feed (accountability, not social)

## Run SQL
01 → … → 05, then **06-saves**, **07-idea-boards**

## AI search next upgrade
Wire Edge Function to embed on save + rank vectors; SQL already has `embedding_json` + `cadens_save_set_embedding`.
