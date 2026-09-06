# Cadens 0.2 — original Daybook foundation

The original `Daybook-GenZ (3).html` is preserved byte-for-byte in `reference/Daybook-original.html`. `scripts/patch-original.mjs` applies asserted, targeted changes to generate `index.html`; it does not reformat or replace the original app. Outlook MSAL authentication remains in the original code. Cadens authentication uses Supabase separately.

## Run and deploy

Use Node 22 or later. Run `npm ci`, `npm test`, `npm run build`, then `npm run dev`. Preview is http://127.0.0.1:5174. The isolated browser smoke test is `node tests/browser-smoke.mjs`; set PLAYWRIGHT_MODULE and CHROME_PATH on other machines.

Netlify: build command `npm run build`; publish directory `dist`; the included netlify.toml sets these. Deploy only after database tests and browser checks pass. Existing site: https://cadens-private-beta.netlify.app/.

Optional build variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Defaults point to the user's Cadens project and its public publishable key. Never put a service-role key, database password, Gmail App Password or SMTP credential in this repository or Netlify client variables. Supabase holds the Gmail SMTP credential privately. Auth site URL and allowed recovery redirect must match the deployed origin (`/?recovery=1`). Add localhost redirects only for development testing.

## Backend

`database/schema.sql` and the versioned migration define six tables, RLS, authenticated RPCs, and a private photos bucket. Tables permit authenticated reads through RLS; writes run through RPCs with identity, membership, and revision checks. Internal privileged functions have a fixed search_path and require auth.uid(). Non-post objects are owner-only. Joining a group creates a pending request; its owner approves it. Family posts are visible to approved members of a shared family space. Private contact phone numbers do not grant access. A group owner can remove members, rotate codes, or delete a group.

`database/verify-access.sql` creates two temporary identity fixtures inside a transaction, exercises permissions, then rolls everything back. It passed in the Cadens project on September 5, 2026 Pacific. The earlier `public.objects` table is preserved.

## Data and synchronization

Changed records are saved after a short debounce; the UI distinguishes unsaved/saving/saved. Revision checks reject stale writes from another device. On conflict, export the local draft and reload before reconciling. Unsaved drafts are stored in sessionStorage under the user ID and never loaded into another account. Logout waits for successful saving. Photo files are private to their owner.

Existing local Daybook data is not automatically uploaded or shared. Use its Export and this version's Import. Imported posts become private. New accounts are empty instead of receiving fictional sample posts. The prior small prototype's `objects` data remains in its table and needs a separate import bridge before retiring that version.

## Validation and release gate

- Six unit tests passed: delta saves, private imports, unsafe input rejection, duplicate IDs, Pacific dates and stable comparison.
- Isolated browser test passed: login gate, task save, six original views, logout privacy, no runtime errors. Service responses are mocked in this test; it does not prove real email or browser authentication.
- Live database transaction passed: private reads, pending approval, approval, removal, reaction uniqueness, comments, write grants, stale-save rejection.
- User confirmed Gmail recovery email receipt for the existing live version.
- Still required before production replacement: real account UI regression, photo backup portability, previous-prototype import, reminder/recurrence regression, and deployed smoke checks. Do not interpret passing mocked tests as completion of these checks.

## Rollback

Keep the existing live Netlify deploy available. Roll back the frontend by republishing its previously successful deploy (6a9c3c958265c1fe5a61b127). Do not drop new tables to roll back the frontend. Export affected records first before any later migration reversal. New Daybook records are not visible in the earlier small prototype; preserve them for recovery.

## Beta scope limits

This increment synchronizes the original objects and adds approved social groups. Native task assignment, per-object edit permissions, background push reminders, AI, richer Spaces, and full collaborative list editing remain later increments. Original reminders require the app to be open. Outlook depends on a valid user-configured Microsoft application and its consent. Gmail is being used for the controlled beta, with Supabase's configured email rate limits.
