# Cadens implementation plan

Connected Rhythm PRD v5 is now the governing product spec for Momentum/Habits/Focus/Mood work. Use PRD §23 as the reconciled implementation order: finish Phase 0 preservation/consolidation, port existing legacy engines before building replacements, then layer net-new activity graph, mood/patterns and release work. Builder DNA/Daily Flow work remains opt-in and must not displace the preservation path unless the Product Owner explicitly reorders it.

Updated: 2026-09-15. Detailed product scope is recorded in the project guides and implementation handoff files.

1. Consolidate surviving tools into the mode picker without dropping capabilities. `/app.html` remains temporarily while advanced tasks, personal-calendar editing, photos/lists and social interactions reach canonical UI parity; removing its visible menu link is not completion of this work.
2. Use existing `daybook_records` as the canonical store for tasks, notes, links, places, lists, journals and progress; preserve IDs, settings and unknown fields through revision-checked writes.
3. Use additive calendar tables for private and approved-group calendars. Owners manage calendar membership/scope; approved members edit shared events.
4. Keep signed-in React home at Today; keep supplied landing, email/password/recovery and Google entry points.
5. Complete remaining React parity in bounded increments: photos/place controls, richer journal editing, social export, verified account deletion, background reminders, messaging/ideas backend decisions.
6. Pass local preservation/build tests, live two-user RLS rollback tests, auth/UI smoke tests and a Netlify draft check before production or GitHub update.

Current UI increment: heartbeat identity and landing/auth handoff are live in production deploy `6aa80577f63a215fd68afc17`. Details, inventory, punch list and deliberately deferred work are in `UI_HANDOFF_REVIEW.md`. The first Connected Rhythm backend contract increment is checked in as `sql/18-connected-rhythm-collections.sql`; apply and live-test it before building React Habits/Focus/Mood writes.

Next implementation scope: finish structural consolidation of the duplicated task/calendar/social editors before expanding the remaining visual pass. Preserve the canonical record IDs, metadata and auth contracts.

Current release decision: the user directed production promotion on 2026-09-15 after the isolated UI suite and deployed-asset smoke passed. Previous production deploy `6aa7502dc5c59adc42dc1fae` is the rollback target. Structural consolidation plus real-account and physical-device checks remain open beta work.

## Current bounded increment — Task Flow + Momentum

Competitive reference: Ango's public site and tutorials were reviewed on 2026-09-15. Cadens keeps its private-first Spaces, sharing, journals, saves and calendar model; no Ango branding, copy or assets are copied.

1. Consolidate task discovery in React with search across title, notes, category and tags, plus Focus, Priority, Upcoming, Overdue, Unscheduled and Done smart views.
2. Add deterministic quick capture for dates, weekdays, times, relative dates, priority markers and hashtags. Show what Cadens understood before saving and preserve the unparsed title.
3. Surface existing planned date, pinning, snooze and checklist progress without creating a second task store or dropping unknown legacy metadata.
4. Add a private Momentum experience using existing task completion history: seven-day rhythm, recent wins and milestones. Keep the journal writing streak separately labelled.
5. Refresh Builder DNA as an explicit opt-in profile card with qualitative dimensions, public-data provenance, last refresh, hide and disconnect controls. It remains feature-gated until its existing SQL and Edge Function are deployed and verified.
6. Extend the landing heartbeat system across shared app shells and canonical task/momentum surfaces using the exact existing palette and tokens. Keep pink as the only navigation/action accent; semantic danger and success colors remain status-only.
7. Preserve `daybook_records`, IDs, revision checks, auth, RLS and current routes. This increment requires no database migration.

Acceptance checks: task parser unit tests, compatibility tests, TypeScript, production build, route/viewport UI smoke, keyboard and reduced-motion checks, then immutable Netlify draft smoke. AI extraction, voice notes, task attachments, subscriptions, Siri, native widgets and action notifications are deferred until privacy, storage, cost and platform decisions are recorded.
