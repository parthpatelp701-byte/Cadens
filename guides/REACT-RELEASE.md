# Cadens React preview and preservation release

This package retains the original app alongside the new React routes. It is not evidence of complete React feature parity. No remote deploy or database changes were made by this packaging step.

## Entry points

| URL | Purpose |
| --- | --- |
| `/` | React entry: signed-in Today; signed-out landing routing is handled by React |
| `/welcome.html` | Supplied landing design, with login/signup links targeting React |
| `/signin`, `/signup` | React auth routes |
| `/?recovery=1` | Existing password recovery callback; React must retain this before landing routing |
| `/app.html` | Entire preserved original app, including features not yet ported |
| `/cadens-auth.html` | Preserved original auth fallback, returning to `/app.html` |

Static HTML, cloud JS, CSS and the fallback auth bundle are copied from `daybook-cadens/dist`. The app/auth/cloud copies are byte-for-byte identical; only the landing's auth links and legacy entry redirect script differ. `frontend/preserved-artifacts.json` records SHA-256 provenance. Build validation rejects unexpected changes or missing CSP hashes. This catches accidental packaging changes; it is not a substitute for behavioral tests.

Both applications use the same Cadens Supabase project and default Supabase browser session key. Navigation must use ordinary full-page anchors for `/app.html` and `/welcome.html`, not SPA-only navigation. Original logout retains its existing save-before-signout behavior and returns to the static auth fallback. Do not change the project URL without rebuilding the preserved cloud and auth bundles; the Vite build deliberately rejects that mismatch.

## Environment

Node 22 or later. From `cadens-react/frontend`, install locked dependencies with `npm ci` and run `npm run build`.

| Variable | Value / requirement |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://iqnctgdnlyxjngqnzacr.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Cadens public publishable key; despite the historical variable name, use `sb_publishable_…` |
| `VITE_ENABLE_PWA` | `false` for this preview |

The `VITE_` values are included in browser code. Never supply a service-role key, database password, SMTP credential or OAuth client secret here. Supabase retains provider/SMTP secrets. `.env.local` is local only; configure the two public Supabase values in Netlify for remote builds.

## Preview deployment

`cadens-react/netlify.toml` expects this directory as the package root, with base `frontend`, publish `dist` relative to that base, and command `npm run build`. If importing the wider workspace/repository later, configure its package/base path explicitly; do not assume its root is this package.

For a manual deploy, first build locally. Upload the complete `frontend/dist` directory as a **draft**, without a production flag. It includes `_redirects` for SPA deep links and `_headers` for CSP/security rules, so manual uploads do not depend on Git integration. With an already authenticated Netlify CLI, from `cadens-react`:

```powershell
$cadensPublish = (Resolve-Path -LiteralPath './frontend/dist').Path
netlify deploy --no-build --dir $cadensPublish --site 1518c65d-0660-4777-ab8e-aea64f30fe6a --json
```

Do not add `--prod` until the gates below pass. The command above has not been executed as part of this setup. Authenticate through the normal Netlify flow if required; never paste tokens into chat or source files.

A draft on the production backend can still write real data. Use designated beta/test accounts and approved fixtures. Allowlist the exact draft callback origin and `/?recovery=1` in Supabase before exercising auth; do not replace the production Site URL with a draft. Add Google test users as required by its current consent configuration. These account settings have not been changed by this packaging work.

## Release gates

1. Parent integration: signed-out landing; signed-in Today; signup, login, OAuth and recovery callbacks; visible original-tools link. Check both extensionless Netlify normalization and `.html` routes.
2. Compatibility: test original-record IDs, all metadata, revision conflicts and task completion points across both interfaces. Verify saving in one interface is visible after refresh in the other, without duplicate import.
3. Backend: apply only reviewed additive migrations; run real two-account RLS checks, approved/pending/removed membership behavior and anonymous denial. Do not execute the ZIP baseline against the live schema.
4. Browser: mobile/desktop layout, restored legacy views, Google/email recovery, photo round-trip and export. Check CSP console violations, not only HTTP success.
5. Deployment: reload `/calendar`, `/tasks`, `/signin`, `/signup`, `/app.html`, `/cadens-auth.html`, `/welcome.html`; check immutable caching only on hashed `/assets/*`, and no-cache for static app/auth bundles. Confirm security headers and no stale service worker.
6. Review the feature-parity matrix. A legacy route preserves access but does not establish that the feature is implemented in React. Do not advertise unconfigured ZIP features as available.
7. Save the validated release to GitHub only after the user's agreed checks; then promote the tested artifact to production.

## Rollback

Keep the current successful production deployment available before promotion. Record its actual deploy ID in the release log after reading Netlify. Roll back by republishing that complete deploy, not by mixing old HTML with new assets. Additive tables and original Daybook records remain in place; do not drop or reverse data during frontend rollback. Export affected records before any separately reviewed data repair. A preview failure should leave production unchanged.

The original app remains available at `/app.html` in this package. That is a fallback within the new artifact, not a replacement for a tested full-deployment rollback.
