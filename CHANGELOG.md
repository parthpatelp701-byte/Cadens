# Changelog

## 2026-09-15 — Heartbeat release published

- Published tested Netlify production deploy `6aa80577f63a215fd68afc17` to `cadens-private-beta.netlify.app`.
- Confirmed production routes, CSP, SRI, pinned MSAL response and browser execution.
- Synchronized the matching React/Supabase source to GitHub `main` while preserving repository history.
- Corrected the clean-checkout CI build environment and moved output post-processing to the successful bundle hook so build errors are reported accurately.
- Retained previous production deploy `6aa7502dc5c59adc42dc1fae` as the rollback target; no database migration was part of this release.

## 2026-09-14 — Heartbeat and auth handoff review draft

- Created draft `6aa8001b8cb7511eb1dafd27`; production and GitHub were not updated.
- Extracted landing values into a shared theme; brought its heartbeat mark/path, display typography, card shadows and pink controls into the app.
- Repaired landing/auth continuity: cross-document transitions, a unique shared logo name, stable auth rendering, generated asset warming, first-paint handling and working router transitions.
- Consolidated standalone auth bookmarks into the React auth surface while retaining recovery/callback URLs.
- Added expandable bento mode cards and deep links to original specialist features; broad tool consolidation is still partial.
- Fixed dark specialist-tool rendering, calendar handoff target, selected-state contrast and task-sheet keyboard focus/scrolling.
- Added isolated browser regression evidence and a draft-only deployment helper. No data model, RLS or provider changes.


## 2026-09-13 — React compatibility increment

- Preserved original landing, auth and full app artifacts with build-time integrity checks and `/app.html` access.
- Connected React tasks, saves, lists, places, journals and progress posts to canonical Daybook records with revision/stale-edit protection.
- Preserved task metadata, recurrence, checklists and fair-point rules; repeated completion cannot farm points.
- Added Today dashboard and Pacific-time calendar, recurrence/DST fixes, legacy task/event projection and explicit shared calendar creation.
- Applied additive Supabase calendar/event tables with private-first RLS and approved-member event editing.
- Locked down direct client execution of the database RLS-enforcement event-trigger helper.
- Made the additive calendar migration safe to rerun and added a tracked helper-lockdown migration.
- Fixed auth callback detection so campaign query strings reach the landing page and recovery mode requires a real recovery session.
- Passed the consolidated 18-test suite, original-schema/RLS tests, migration rerun check, preserved-artifact verification and production build.
- Disabled incomplete account deletion, push/PWA and GitHub DNA paths by default.
- Production Netlify site and GitHub were not updated in this increment.

## 2026-09-13 — Netlify QA draft

- Deployed the already-built `frontend/dist` artifact as draft `6aa70dea31deb26f7b72f253` to the existing `cadens-private-beta` site.
- Verified `/`, `/welcome.html`, `/signin`, `/signup`, `/calendar`, `/tasks`, `/app.html` and `/cadens-auth.html` return successfully from the immutable draft URL.
- Verified static HTML uses `no-cache`, hashed assets use immutable caching, and the configured CSP and frame-protection headers are present.
- Confirmed production remains unchanged on deploy `6a9ddd4931ed74da12154eb8`.
- Replaced the draft with `6aa70f839e2cb9d6d6a0a98b` after rebuilding the Outlook integration; verified the deployed MSAL 2.38.3 jsDelivr URL, matching SHA-384 integrity, and CSP host restriction.

## 2026-09-13 — React production release

- Promoted the tested 56-file `frontend/dist` artifact (`b655177c010352e2d0425e68e8649264464f7c6a4727cfa96c58d31a47149f58`) to production deploy `6aa7502dc5c59adc42dc1fae` on the existing `cadens-private-beta` site.
- Verified the main production URL and immutable deploy URL, all release routes, signed-out React landing routing, HTML no-cache, immutable hashed assets, CSP, and frame protection.
- Verified the production `app.html` retains the pinned MSAL 2.38.3 jsDelivr URL with matching SHA-384 integrity and excludes the previous MSAL CDN host from CSP.
- Added a repeatable deployed-asset smoke test and passed route, MSAL response, integrity, CSP and browser-execution checks.
- Added the replacement draft to Supabase's redirect allow list; real Google OAuth returned to React Today and existing-account routes loaded read-only.
