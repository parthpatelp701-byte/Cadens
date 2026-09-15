# Cadens risk log

| Date | Risk | Likelihood | Impact | Mitigation / status |
| --- | --- | --- | --- | --- |
| 2026-09-13 | React can drop unknown original fields | Low | High | Canonical Daybook adapters preserve full payloads; regression tests pass. |
| 2026-09-13 | Shared calendar event edits overwrite a newer edit | Low | Medium | UI requires matching `updated_at`; conflict tells user to reload. |
| 2026-09-13 | Original and React pages edited simultaneously | Medium | Medium | Revision checks and stale-editor checks fail closed; beta guidance warns against concurrent editing. |
| 2026-09-13 | Optional ZIP modules call missing backend services | Medium | Medium | PWA/push and GitHub DNA are disabled unless explicitly configured; original route retains released tools. |
| 2026-09-13 | Account deletion leaves data/storage behind | Medium | High | React deletion is disabled and non-destructive until server cleanup is verified. |
| 2026-09-13 | JSON export omits binary photos and social reactions/comments | High | Medium | Export labels this limitation; original export remains available; complete before deletion release. |
| 2026-09-13 | Draft deploy writes to production backend | Medium | Medium | Use designated beta accounts; production promotion remains blocked. |
| 2026-09-13 | A bare recovery URL could show a password form without a recovery session | Low | Medium | Recovery form now requires both the recovery marker and a valid session/event. |
| 2026-09-13 | Database DDL event-trigger helper was executable by client roles | Low | High | Keep trigger behavior; revoke direct execution from public, anonymous and authenticated roles. |
| 2026-09-13 | Supabase leaked-password screening unavailable on Free plan | Medium | Medium | Require at least 8 characters in Cadens; encourage Google/password managers; reconsider Pro before wider release. |
| 2026-09-14 | Mode links mistaken for completed tool consolidation | High | Medium | Keep Phase 0 open; inventory in UI_HANDOFF_REVIEW.md identifies duplicated editors and incomplete feature parity. |
| 2026-09-14 | Mocked browser checks mistaken for live auth/data validation | Medium | High | UI results explicitly record fixtureOnly; real email/OAuth, shared permissions, photos and physical devices remain release gates. |
| 2026-09-14 | Initial SPA bundle remains about 179 kB gzip | Medium | Medium | Warm built auth assets from the landing; preserve critical dark first paint and lazy page chunks; measure real device/network performance before wider release. |
