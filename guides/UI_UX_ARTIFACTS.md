# UI / UX & digital artifacts

## Brand
- `BrandMark` / `BrandWordmark` — `src/components/brand/BrandMark.tsx`
- Favicon geometric **C**: `public/favicon.svg`
- PWA icons: `cadens-icon-192.png`, `cadens-icon-512.png`
- Offline shell: `public/offline.html` (SW `cadens-v2-ui`)

## Design system
- Tokens: `src/styles/index.css` (colors, radii, safe areas, elevations)
- Primitives: `Button`, `Card`, `EmptyState`, `PageHeader`, `LoadingScreen`, `Toast`, `Skeleton`
- Surfaces: `.surface-elevated`, `.surface-hero`, `.page-enter`

## UX principles (preserved functionality)
1. **Ship nav unchanged** — Saves · Progress · People · You  
2. **Phone-first** — 44px+ targets, safe areas, 16px inputs  
3. **Calm density** — soft borders, inset highlights, limited motion  
4. **Clear empty states** — icon + title + one action  

## Screens touched in this polish pass
- Auth (brand + focus rings)
- AppShell (sidebar mark)
- Loading / Offline
- Shared buttons & cards
- Saves / Progress title scale + page enter

## Future art (optional)
- Custom 1024 App Store icon (no transparency for iOS)
- Feature screenshots for store listing
- Light mode theme tokens
