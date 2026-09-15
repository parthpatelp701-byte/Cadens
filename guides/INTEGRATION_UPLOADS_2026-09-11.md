# Integration — uploaded packages (2026-09-11)

## Sources
1. `cadens-v5-codex-innovated-github-daily-flow.zip` — full tree + Builder DNA / Daily Flow briefs + `github-tier` Edge Function  
2. `iLoveZIP_Create.zip` — Daily Flow Tasks UI sketch + SQL order notes  

## Merged into current Cadens (ship 4-tab preserved)

| Feature | How |
|---------|-----|
| **Daily Flow tabs** | Tasks: Now / Today / Planned / Done (client filter on existing `listTasks`) |
| **Optimistic complete** | `TaskCard` instant check + `success-pop` + rollback on error |
| **Builder DNA** | `sql/15-builder-dna.sql`, `lib/githubDna.ts`, You → connect GitHub, Edge `github-tier` |
| **Welcome back** | Streak-risk one-liner on Saves (`WelcomeBack`) |
| **Pull-to-refresh** | Saves (touch) via `usePullToRefresh` |
| **Docs** | `GITHUB_AND_TASKS_INNOVATION_PLAN.md`, `CODEX_FEATURE_BRIEF.md` |

## Not replaced
- 4-tab nav, Saves/Progress/People/You  
- Task ↔ Plan SQL sync, Journal, Idea boards  
- Ambient UI / SW v3 / Sheet / SaveCard  

## Deploy notes
1. Run `15-builder-dna.sql` after `14-calendar-task-sync.sql`  
2. Deploy Edge Function `github-tier` (optional `GITHUB_TOKEN` secret for higher rate limits)  
3. Redeploy frontend  
