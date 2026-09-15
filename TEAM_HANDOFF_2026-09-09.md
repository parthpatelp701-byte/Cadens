# CADENS v2 — TEAM HANDOFF / CONTINUATION PACKAGE
Date: 2026-09-09
Source of truth: the supplied cadens-v2-full.zip and the release-hardening work performed from that package.
IMPORTANT: Old GitHub code is NOT the source for this handoff.

## OBJECTIVE
Take this package from the current hardened-but-not-certified state to production-ready.

Required gate order:
BUILD → TYPESCRIPT → SQL → RLS → AUTHENTICATION → FEATURE FLOWS → PUSH → PWA → MOBILE → PERFORMANCE → SECURITY → FINAL QA

## WHAT HAS BEEN WORKED / IMPLEMENTED

### Security
- JWT verification enabled for audited Edge Functions.
- Authenticated-user checks and ownership enforcement added.
- Unfurl hardened against SSRF:
  - private/reserved/link-local destination rejection
  - bounded redirects
  - DNS/IP validation
  - bounded response handling
- Frontend private/service secrets are not hardcoded.
- Push subscription ownership checks added.
- Stale push endpoint cleanup added.

### Mobile / permissions
- Netlify Permissions-Policy now permits geolocation for the production origin.
- Nearby Peers remains opt-in and uses coarse location.

### PWA
- Missing 192px and 512px PNG icons were added.
- Manifest/service-worker static checks pass.

### Web Push
- Sender was changed from raw JSON payload delivery to standards-based web-push encryption.
- Real browser/device delivery is NOT yet certified.

### Data / SQL
- Added sql/00-daybook-baseline.sql as the compatibility baseline for the six legacy Daybook RPC contracts:
  daybook_load
  daybook_sync
  daybook_feed
  daybook_social_action
  daybook_groups
  daybook_group_action
- Added baseline to RUN_ORDER.md.
- SQL sanity scan passes the current migration set.
- Invalid PostgreSQL partial-index definitions using now() were corrected.
- Tighter group/member RLS migration is present.
- Journal, calendar, retention, contact discovery and nearby migrations are present.

### QA tooling
- release-check script added.
- SQL sanity script added.
- RLS test plan added.
- Release E2E matrix added.
- Release status documentation added.

## CURRENT STATUS

GREEN / STATIC:
- Package extraction
- Static release gate
- PWA asset existence/dimensions
- Manifest syntax
- Service worker syntax
- Critical disabled-geolocation configuration removed
- Audited verify_jwt=false configuration removed
- Six Daybook compatibility contracts present in source
- SQL static sanity checks

NOT CERTIFIED:
1. Reproducible npm install
2. Clean TypeScript compilation
3. Clean Vite production build
4. SQL execution against a real Supabase PostgreSQL instance
5. Live RLS cross-user tests
6. Authentication/session/authorization E2E
7. Real Web Push delivery
8. Real Chrome/Edge/Safari mobile permission testing
9. 10k/50k performance testing
10. Full production sign-off

## CRITICAL RULE
Do NOT mark a gate PASS because source code exists. A gate is PASS only when there is executable evidence.

## TEAM EXECUTION PLAN

### GATE 1 — BUILD
cd frontend
npm ci
npm run build

If npm ci fails:
- determine whether failure is network/environment or package metadata
- do not fabricate package-lock.json
- use a controlled development/CI environment with registry access
- commit the legitimate lockfile generated from this exact package.json

Acceptance:
- npm ci succeeds from a clean checkout
- npm run build exits 0
- frontend/dist is produced

### GATE 2 — TYPESCRIPT
Run:
npx tsc -b

Fix every actual compiler error.
Do not solve errors with broad any casts unless technically justified.

Acceptance:
- zero TypeScript build errors

### GATE 3 — SQL
Use a NEW/STAGING Supabase project.
Run sql/RUN_ORDER.md in order:
00 through 15.

Then verify:
- all tables
- all RPCs
- all functions
- extensions
- indexes
- triggers
- storage
- realtime publication

Acceptance:
- every migration executes successfully on a clean database
- frontend RPC calls match actual SQL signatures
- no migration requires undocumented pre-existing schema

### GATE 4 — RLS
Create at least User A and User B.

Attempt cross-user access to:
- journal entries
- saves
- notifications
- subscriptions
- progress posts
- groups
- ideas
- messages
- discovery/session data

Acceptance:
- User A cannot read/write User B private data
- group/member rules behave as designed
- unauthorized RPC calls fail safely

See tests/RLS_TEST_PLAN.md.

### GATE 5 — AUTHENTICATION
Test:
- signup
- verification
- valid login
- invalid password
- session restoration
- session expiry
- logout
- password reset
- unauthorized deep links
- Edge Function without JWT
- Edge Function with another user's token

Acceptance:
- no protected action succeeds without valid authorization
- no cross-user data leakage

### GATE 6 — FEATURE FLOWS
Test every major route:
- Saves
- Progress
- People
- You/Profile
- Groups
- Ideas
- Messages
- Notifications
- Nearby
- Journal
- Calendar

For each:
create → read → edit → delete where applicable → refresh → second-user behavior → error behavior.

Acceptance:
- no console/runtime errors that break the flow
- persisted state survives refresh
- authorization remains correct

See tests/RELEASE_E2E_MATRIX.md.

### GATE 7 — PUSH
Deploy send-push with required secrets.
Test:
- subscribe
- unsubscribe
- notification creation
- send
- browser receives encrypted payload
- expired endpoint cleanup
- unauthorized caller rejected

Acceptance:
- real Chrome/Edge/Safari-supported delivery works
- no VAPID private key/service-role key reaches frontend

### GATE 8 — PWA
Verify deployed HTTP 200 for:
- manifest
- service worker
- icon 192
- icon 512

Test:
- install
- reload
- offline fallback
- cache behavior
- SPA deep links

Acceptance:
- installable PWA with valid icons
- no broken asset references

### GATE 9 — MOBILE
Test Chrome Android and Safari iOS where supported:
- geolocation permission granted
- denied
- timeout
- HTTPS
- Nearby session start/stop
- push permission
- PWA install/open
- layout/responsive interaction

Acceptance:
- Nearby works when permission is granted
- graceful behavior when denied
- no permission-policy errors

### GATE 10 — PERFORMANCE
Use representative datasets:
- 100
- 1,000
- 10,000
- 50,000 records

Measure:
- initial load
- feed
- search
- journal/calendar queries
- realtime bursts
- concurrent writes
- memory
- CPU
- network payload
- database query latency

Acceptance thresholds must be documented by the team before sign-off.

### GATE 11 — SECURITY
Test:
- RLS bypass
- JWT bypass
- IDOR
- SSRF
- DNS rebinding
- redirect abuse
- oversized unfurl response
- XSS
- CORS
- malformed JSON
- rate limiting
- secret exposure
- expired sessions
- abuse of public functions

Acceptance:
- all P0/P1 security findings closed or explicitly risk-accepted by engineering leadership.

### GATE 12 — FINAL QA
Run:
npm run release-check

Then execute full E2E matrix.

Produce:
- test evidence
- screenshots/logs where relevant
- Supabase migration result
- browser/device matrix
- performance results
- security results
- known limitations

Only then change status from RED to GREEN.

## DO NOT DO
- Do not pull old GitHub code into this package.
- Do not overwrite this React/Vite frontend with the old application.
- Do not create fake dependency lockfiles.
- Do not guess SQL behavior merely to make RPC names exist.
- Do not disable RLS to make tests pass.
- Do not expose service-role, VAPID private key or OpenAI secrets to the frontend.
- Do not mark live push/mobile/E2E as passed based on static inspection.

## IMPORTANT FILES
frontend/package.json
frontend/netlify.toml
frontend/scripts/release-check.mjs
frontend/scripts/sql-sanity.mjs
sql/RUN_ORDER.md
sql/00-daybook-baseline.sql
sql/10-tighter-rls.sql
sql/11-contact-discovery.sql
sql/12-nearby-peers.sql
sql/13-journal.sql
sql/14-calendar.sql
sql/15-retention-habits.sql
tests/RLS_TEST_PLAN.md
tests/RELEASE_E2E_MATRIX.md
RELEASE_STATUS_2026-09-09.md

## DEFINITION OF DONE
Cadens v2 is ready only when:
[ ] clean npm ci
[ ] clean tsc -b
[ ] clean vite build
[ ] all SQL 00–15 execute on clean Supabase
[ ] all RPC contracts verified
[ ] RLS two-user tests pass
[ ] authentication tests pass
[ ] all major feature flows pass
[ ] real push delivery passes
[ ] PWA install/offline/deep-link tests pass
[ ] mobile geolocation tests pass
[ ] performance tests pass
[ ] security regression passes
[ ] final QA evidence attached
[ ] Engineering + QA sign-off

CURRENT RELEASE DECISION: RED — CONTINUE HARDENING.
