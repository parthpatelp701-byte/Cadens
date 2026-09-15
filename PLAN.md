# Cadens implementation plan

Updated: 2026-09-15. Detailed product scope is recorded in the project guides and implementation handoff files.

1. Consolidate surviving tools into the mode picker without dropping capabilities. `/app.html` remains temporarily while advanced tasks, personal-calendar editing, photos/lists and social interactions reach canonical UI parity; removing its visible menu link is not completion of this work.
2. Use existing `daybook_records` as the canonical store for tasks, notes, links, places, lists, journals and progress; preserve IDs, settings and unknown fields through revision-checked writes.
3. Use additive calendar tables for private and approved-group calendars. Owners manage calendar membership/scope; approved members edit shared events.
4. Keep signed-in React home at Today; keep supplied landing, email/password/recovery and Google entry points.
5. Complete remaining React parity in bounded increments: photos/place controls, richer journal editing, social export, verified account deletion, background reminders, messaging/ideas backend decisions.
6. Pass local preservation/build tests, live two-user RLS rollback tests, auth/UI smoke tests and a Netlify draft check before production or GitHub update.

Current UI increment: heartbeat identity and landing/auth handoff are live in production deploy `6aa80577f63a215fd68afc17`. Details, inventory, punch list and deliberately deferred work are in `UI_HANDOFF_REVIEW.md`.

Next implementation scope: finish structural consolidation of the duplicated task/calendar/social editors before expanding the remaining visual pass. Preserve the canonical record IDs, metadata and auth contracts.

Current release decision: the user directed production promotion on 2026-09-15 after the isolated UI suite and deployed-asset smoke passed. Previous production deploy `6aa7502dc5c59adc42dc1fae` is the rollback target. Structural consolidation plus real-account and physical-device checks remain open beta work.
