# Cadens v2 — Release hardening status

Date: 2026-09-09
Source of truth: supplied `cadens-v2-full.zip` plus this repair pass. Old GitHub application code was not used as the implementation source.

## Gate status
**RED — not production approved.**

### Completed in source
- Added `sql/00-daybook-baseline.sql` with the Daybook tables/helpers/RPC contracts required by the current frontend.
- Added the baseline migration to SQL run order.
- Enabled JWT verification for all four audited Edge Functions.
- Added authenticated-user checks and ownership enforcement.
- Hardened link unfurling with bounded redirects, DNS resolution and private/reserved IP rejection.
- Enabled geolocation for the production origin in both Netlify configurations.
- Added valid 192px and 512px PWA PNG assets.
- Replaced raw Web Push payload delivery with `web-push` encryption.
- Added stale subscription cleanup for 404/410 push endpoints.
- Removed the hardcoded Supabase client URL/key fallback; deployment variables are required.
- Pinned direct frontend dependency versions.
- Fixed invalid PostgreSQL partial indexes using `now()` in the stories migrations.
- Added `npm run release-check` plus SQL sanity checks.
- Added executable E2E and RLS test matrices.

### Verified in this environment
- Release static gate: PASS.
- Required PWA assets exist and are valid PNG dimensions.
- Critical `verify_jwt=false` and disabled geolocation configuration strings are gone.
- All six Daybook compatibility contracts are present in the baseline + existing social-action migration.
- SQL sanity scan passes all 16 migration files.

### Not yet honestly certifiable
1. `package-lock.json` — npm registry access timed out, so no fake lockfile was created.
2. Clean `npm ci` / `npm run build` — blocked by unavailable dependency installation. Global TypeScript confirms the expected failure is currently missing installed modules, not a clean compiler pass.
3. SQL execution — PostgreSQL/Supabase runtime is required to validate the migration on a real database.
4. Live RLS/auth/E2E — requires staging Supabase accounts and deployed functions.
5. Real push/mobile — requires supported browser/device and VAPID secrets.
6. 10k/50k performance — requires representative staging data and measurement.

## Required final gates

**Build → TypeScript → SQL → RLS → authentication → all feature flows → push → PWA → mobile → performance → security → final QA**

Do not sign off production until each gate has captured evidence.
