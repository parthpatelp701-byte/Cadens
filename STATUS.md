# Specialist status

- UI/UX Reviewer — 2026-09-15: heartbeat/auth release reviewed; shared landing tokens, responsive mode picker and keyboard sheet repairs complete for this increment; full consolidation and device review remain open.
- Supabase Engineer — 2026-09-13: calendar RLS applied and live-tested; anonymous sign-ins disabled; advisor has 0 errors and 1 Free-plan password warning.
- Netlify/Deploy Engineer — 2026-09-15: production `6aa80577f63a215fd68afc17` is live; deployed routes, CSP, SRI, pinned MSAL and browser execution smoke pass. Rollback target is `6aa7502dc5c59adc42dc1fae`.
- System Architect — 2026-09-14: canonical Daybook records plus additive calendars retained; Phase 0 tool consolidation is partial and is explicitly tracked in `UI_HANDOFF_REVIEW.md`.
- System Architect — 2026-09-20: Connected Rhythm PRD v5 §23 is the active sequencing rule for Habits/Momentum/Focus/Mood. `sql/18-connected-rhythm-collections.sql` now widens the checked-in Daybook RPC contract for `habits`, `focus_sessions`, `mood_checkins` and `badges`; live Supabase application/RLS validation remains open.
- System Architect — 2026-09-22: active backend references are being aligned to Supabase project `rrqyoeeqwgihjcfmyveq`; CI now uses that URL and `sql/19-daybook-security-hardening.sql` documents the post-Connected-Rhythm RPC/RLS hardening step. Manual Supabase application and real auth/RLS smoke are still required.
- React Migration — 2026-09-20: first Habit Phase A adapter added in `frontend/src/lib/habits.ts`, preserving the legacy `S.habits[]` stamp model while adding `kind`, `frequency` and `archived` defaults. UI surfaces and live Supabase validation remain open.
- React Migration — 2026-09-22: Today page now includes a Daybook-backed `HabitTodaySection`; `frontend/src/lib/connectedRhythm.ts` adds preservation-first Focus/Mood adapters with tests. Full browser build and live Supabase validation remain open.
- Product Owner — not run; next after remaining parity increments.
- DevOps/Reliability — 2026-09-15: user-directed production promotion completed; live asset smoke passed and the previous production deploy is retained for rollback.
- QA/QC — 2026-09-15: final artifact passes isolated browser suite, document-transition readiness, 56 route/viewport checks, task and keyboard regressions, reduced motion and production asset smoke; 18 unit checks, library compatibility, TypeScript and build pass. Live email/OAuth and physical-device checks were not repeated.
- Risk Analyst — 2026-09-13: active risks recorded in `RISK_LOG.md`.
- Generalist Helper — 2026-09-13: integration routing complete for current task/library/calendar slice.
