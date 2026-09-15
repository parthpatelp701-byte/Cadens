# Cadens heartbeat and auth handoff review

Updated: 2026-09-15, Pacific time. This release is not a sign-off of the full consolidation brief.

## Review artifact

- Production: https://cadens-private-beta.netlify.app (`6aa80577f63a215fd68afc17`).
- Reviewed draft: https://6aa8001b8cb7511eb1dafd27--cadens-private-beta.netlify.app
- Existing Netlify site: `1518c65d-0660-4777-ab8e-aea64f30fe6a` (`cadens-private-beta`).
- The user directed production promotion on 2026-09-15. Previous production `6aa7502dc5c59adc42dc1fae` remains the rollback target.
- Local browser evidence was generated under `tests/theme-review/` and is excluded from source control. Auth and data responses in these browser tests are isolated fixtures.

## Stack and boundaries

The working app uses React 19.3, React Router 7.18.3, TypeScript 5.7.3, Vite 6.4.3 and Tailwind 4.3.3. It is a client-rendered SPA with local Card, Button and Sheet components; it has no server renderer or third-party component kit. The supplied landing page and specialist tools are static HTML documents. Supabase remains the existing auth/data service.

The selected Netlify site was verified through its API. It currently has no populated remote build settings (manual artifact deployment). The checked-in root `netlify.toml` defines `frontend`, `npm run build`, `dist`, Node 22, SPA fallback and pinned CSP. The deployed artifact contains the built `frontend/dist`, including `_headers` and `_redirects`.

No database schema, RLS, stored calendar colors or auth provider settings changed. Points remain computed by the existing clients and saved with revision checks. This work does not make points server-authoritative or claim an anti-cheat guarantee.

## Source design values

`frontend/public/welcome.html` supplied the values, now centralized in `public/cadens-theme.css`: pink `#EC4899`, background `#09090B`, surfaces `#121216`, `#18181F`, `#22222C`, text `#FAFAFA`, secondary text `#B4B4BE`, system body font, Unbounded display font (400/600/800/900), 20/28px cards and 6px offset shadows. The existing 16/24px card spacing and pill buttons are reused.

The landing's `#7A7A85` remains a decorative token; small app text uses the more readable secondary text token. Measured solid-surface ratios: pink on the first card surface 5.30:1, ink on pink 5.61:1, secondary text on the first surface 9.09:1. Tinted selected navigation uses white text after pink-on-tint measured below 4.5:1. These checks are not a complete WCAG audit.

## Handoff punch list

| Finding | Change | Status |
| --- | --- | --- |
| Landing and signup were separate documents with no shared transition | Both opt into same-origin document transitions; only the navigation logo has a shared transition name | Fixed |
| Destination briefly replaced the form with a loading splash | Explicit auth routes render their disabled form immediately while the session loads | Fixed |
| React's existing transition props were attached to a BrowserRouter | Enabled those props with a data router while preserving route definitions | Fixed |
| Signup looked like a different product | Reused the actual heartbeat path, display font, ghost word, pink, pill buttons and offset cards | Fixed |
| Browser/back navigation did not reflect auth mode | Signup/login/reset have real URLs and transition through the same auth component | Fixed |
| Standalone HTML auth was another visual/auth entry | Existing bookmarks and callback URLs forward to the React auth surface | Fixed |
| Cold navigation could paint an empty app root | Build emits real module/CSS loading hints, preserves render blocking on the entry module, and commits the first React render synchronously | Fixed, browser support is progressive |
| Dashboard modes had no styling and exposed a wall of links | Responsive bento cards expand with native details/summary controls | Fixed |
| Long task sheet and lost keyboard focus | Body portal, scrolling panel, focus trap, Escape, focus restoration, accessible input names | Fixed |
| Saved light skins and blue/offline overrides could return | Shared tokens cover React, explicit dark specialist tools, and preserved auth bookmarks | Fixed within reviewed surfaces |
| Original event edit jumped to tasks | Calendar handoff now opens the personal timeboard | Fixed navigation target |
| Main JS is still large | Build reports about 599 kB / 179 kB gzip; page chunks remain lazy | Remaining performance work |

## Phase 0 inventory and consolidation status

**Phase 0 is not complete.** Removing the visible tools link and adding mode links did not merge every duplicate implementation. `/app.html` remains a compatibility surface; it must not be reported as removed. The latest landing/auth repair was completed as a separate, user-requested increment while the full consolidation gate stays open.

| Capability found in the original app | Current mode access | Consolidation remaining |
| --- | --- | --- |
| Smart task input; categories; priorities; checklists; recurring/planned/waiting tasks; board/sort/filter; templates; batch actions | Plan the day → tasks / task board + templates | Two task UIs still exist; retain all advanced operations in the final canonical editor |
| Focus timer, breaks, habits, weekly goal/review, achievements, XP, streaks and activity map | Build momentum → focus + habits; Check in → weekly review | Extract specialist panels from the full original task screen |
| Personal calendar drag/resize/clone, recurrence, Outlook and ICS | Plan the day → personal timeboard; Send + sync → calendar sync | Integrate personal timeboard editing with the additive shared calendar |
| Notes, links, shopping lists, item URLs and saved places with GPS/photos | Save something → saves / pin this place / shopping lists / shop links | Finish native photo/location and rich list editors before removing originals |
| Daily diary/timeline, mood, print/copy and end-of-day review | Check in → journal / daily brief / weekly review | Keep the diary timeline distinct from editable journal notes; review overlap |
| Shared progress, privacy scopes, comments/reactions, leaderboard and mute | Move together → share progress; Build momentum → points + leaderboard | React progress still needs all original social interactions before the duplicate surface can be removed |
| Contacts, WhatsApp/native/email sharing, reminders, JSON/ICS export/import and settings | Send + sync → share plan / calendar sync / export data / reminders + contacts | Merge specialist settings; complete photo-inclusive export parity |
| Approved spaces/members, idea boards, messaging, notifications and profiles | Move together → spaces + ideas / messages; You | Verify configured backend availability and the remaining signed-in flows with real beta accounts |

Ten unused archived React files were removed after checking that they had no imports. They were not live routes. The original engine's feature logic and cloud adapter remain available; this is not a claim that story/nearby modules were migrated.

## Screen changes

- Landing: unchanged composition; extracted tokens, zoom restored, unique navigation logo transition and generated asset hints.
- Auth: continuous heartbeat stage, concise headings, stable form, pink actions, clear existing error/reset behavior and mode URLs.
- Today: real task/calendar data remains; expandable mode cards, heartbeat backdrop and removal of duplicate bottom shortcuts.
- Tasks: consistent controls/cards; accessible, scrollable composer; completion behavior retains existing metadata, point and recurrence contracts.
- Calendar: brand-colored presentation without rewriting stored colors; personal event navigation corrected.
- Journal, saves, progress, spaces, messages, settings and notifications: shared dark surfaces, typography, accents, buttons and readable secondary text. Content-specific complete copy review is still pending.
- Original tools/leaderboard: theme bridge, explicit dark presentation, readable cloud status, shared primary navigation and a focused leaderboard mode.

## Scope deliberately left out

- No framework migration, server rendering, new dependencies, database migration or new auth provider.
- No masonry, scroll-driven effects, subgrid or GSAP: none was necessary for this repair. Simple grid and native disclosure preserve reading order.
- No perpetual background animation or mobile blur. Desktop glass is opt-in when supported; solid surfaces and reduced motion remain available.
- No server points rewrite during a visual repair. It needs its own data contract and migration review.
- No physical iPhone/Safari, Android device, VoiceOver/TalkBack or sustained frame-rate certification. Chromium viewport checks do not substitute for those tests.
- No real signup email, Google consent, recovery email, photo upload, group permission or backend RLS test was repeated in this increment.

## Validation and release gates

The 18 existing unit checks, library compatibility suite, TypeScript, build and source/CSP integrity checks passed. The isolated browser suite exercises landing → signup → reset → login, mode expansion/navigation, task create/complete/reopen, one-time points, metadata preservation, sheet keyboard behavior, eight routes at seven widths (360/375/414/430/768/1024/1366), ten specialist entry modes, leaderboard mute and reduced motion. It verifies presentation/control behavior against a fake transport, not live backend security.

The final artifact passed the recorded document-transition readiness check and deployed asset smoke test. The browser report records no page errors or unexpected backend endpoints; all 56 route/viewport checks passed after content settled. Production was promoted at the user's direction. Live email/OAuth, physical-device checks and Phase 0 consolidation remain open beta gates.

Rollback target is the previous production deploy `6aa7502dc5c59adc42dc1fae`. This increment has no database migration to reverse.

## Browser references

- Container query support and fallback: [MDN @container](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@container).
- Cross-document transitions are progressive: [WebKit's supported-browser overview](https://webkit.org/blog/16967/two-lines-of-cross-document-view-transitions-code-you-can-use-on-every-website-today/).
- First-paint control and module warming: [MDN script blocking](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script), [MDN modulepreload](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/modulepreload).
