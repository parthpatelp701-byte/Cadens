# Phase 4 — Module decisions

| Module | Decision | Notes |
|--------|----------|--------|
| Saves | **Ship** | Core |
| Progress | **Ship** | Core |
| People / Groups | **Ship** | GroupsPage |
| Idea boards | **Ship** | Under group routes |
| Messages | **Ship** | From groups/profile |
| Notifications | **Ship** | `/notifications` |
| Tasks + Plan sync | **Ship** | `11-tasks.sql` |
| Calendar / Plan | **Ship** | |
| Journal | **Ship** | |
| Stories | **Archive** | `pages/archive`, `components/archive/stories`; SQL optional |
| Nearby / discovery | **Archive** | SQL in `sql/archive`; UI archived |
| Contact discovery | **Archive** | SQL archived |
| Semantic search | **Beta** | Keyword search ships; AI path needs embedding function |
| Feed / Explore pages | **Archive** | Redirects to Saves |

Enable experimental later via:
```bash
VITE_FEATURE_STORIES=true
VITE_FEATURE_NEARBY=true
VITE_FEATURE_SEMANTIC=true
```
