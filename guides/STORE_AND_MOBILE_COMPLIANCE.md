# Store guidelines + mobile web compliance (Cadens)

Cadens is a **Netlify-hosted responsive PWA** today. Native App Store / Play apps can wrap this later (e.g. Capacitor). Google Workspace Marketplace is a **separate** product type (Docs/Drive/Chat add-ons)—only relevant if you build those integrations.

## What we implemented in the web app

| Area | Implementation |
|------|----------------|
| Phone-first layout | Bottom tabs, max content width, `dvh`, safe-area insets |
| Touch targets | ~44px minimum (Apple HIG / Material) |
| iOS input zoom | Inputs ≥16px on small screens |
| Accessibility zoom | Removed `maximum-scale=1` |
| Reduced motion | `prefers-reduced-motion` honored |
| PWA install | Manifest + icons 192/512, apple-touch-icon, standalone |
| Deep links | Netlify SPA `/* → index.html` |
| Security headers | HSTS, nosniff, frame deny, referrer, Permissions-Policy |
| Privacy / Terms | `/legal/privacy`, `/legal/terms` (auth + You) |
| Account deletion path | `/legal/delete-account` (Apple/Google requirement for stores) |
| Auth disclosure | Terms + Privacy links on sign-in |

## Apple App Store (future native)

- Privacy Nutrition Labels must match real data practices.
- **Account deletion** must be in-app (we document the path; add one-tap RPC before submit).
- Sign in with Apple if you offer other third-party login.
- No private API; WebView apps must provide meaningful native value if shipped as “app”.
- Accurate screenshots and age rating.

## Google Play (future native)

- Data safety form aligned with Privacy Policy.
- Account deletion / data deletion.
- Target recent API levels; no deceptive behavior.
- Clear permissions (location only if Nearby is used and disclosed).

## Google Workspace Marketplace

Only if you publish a Workspace add-on:

- OAuth verification + minimal scopes  
- Working privacy URL (ours: `/legal/privacy`)  
- Accurate listing, no Google trademark misuse  
- Fully functional (not “test”) app  

See: https://developers.google.com/workspace/marketplace/about-app-review

## Browser / responsive checklist

- [ ] iPhone Safari (notch + home indicator)
- [ ] Android Chrome (install PWA)
- [ ] Tablet widths 768–1024
- [ ] Desktop sidebar nav
- [ ] Landscape phone
- [ ] Offline shell (`sw.js`)
- [ ] Auth, Saves, Progress, People, You on a real phone network

## Before production store listing

1. Replace placeholder support/privacy emails in legal pages.
2. Host privacy/terms on a stable HTTPS URL (Netlify is fine).
3. Enable real account-deletion RPC + button.
4. Remove any hardcoded Supabase keys from client; use env only.
5. Capture phone screenshots for store listing.
