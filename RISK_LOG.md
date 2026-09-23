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
| 2026-09-15 | Competitive feature work could create a second task model or drop original fields | Low | High | Implement smart views, parsing, tags and momentum as projections over canonical `daybook_records`; keep adapter preservation tests. |
| 2026-09-15 | Natural-language capture could silently schedule the wrong date or time | Medium | Medium | Use deterministic rules, display parsed chips before save, keep editable fields and never use AI or silent bulk creation in this increment. |
| 2026-09-15 | Streaks or Builder DNA could encourage unhealthy/public productivity ranking | Medium | Medium | Keep Momentum private by default, distinguish task rhythm from journal streak, make Builder DNA opt-in and avoid public score-first presentation. |
| 2026-09-15 | Turning on Builder DNA before its RPCs and Edge Function are verified would break Profile | Medium | Medium | Keep the feature flag off by default; improve the UI and contracts now, then enable only after live backend and privacy checks. |
| 2026-09-20 | Connected Rhythm could be built on the lightweight `objects` prototype instead of canonical Daybook records | Medium | High | PRD v5 §23 governs sequencing; `sql/18-connected-rhythm-collections.sql` adopts the Daybook Phase A collection path for habits/focus/mood/badges. Do not build parallel storage unless Product Owner explicitly chooses a fresh-data rewrite. |
| 2026-09-20 | Mood/focus/habit collections could be assumed live after code changes only | Medium | High | Apply the new migration to Supabase, run SQL sanity and real two-user RLS checks, and verify export coverage before inviting beta users to record sensitive mood/journal data. |
| 2026-09-22 | RPC hardening can break legitimate Daybook writes if applied without an authenticated smoke test | Medium | High | `19-daybook-security-hardening.sql` keeps write access behind authenticated RPCs, but do not deploy until sign-in, habit create/update/delete, refresh and second-user denial are verified on `rrqyoeeqwgihjcfmyveq`. |
| 2026-09-22 | Today habits UI could expose adapter bugs directly on the home screen | Medium | Medium | The section is limited to active Daybook-backed habits, uses the existing revision contract and should remain in draft until full `npm run build`, unit tests and live auth/RLS smoke pass. |
