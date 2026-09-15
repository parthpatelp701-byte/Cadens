# Ship: Opt-in Builder DNA + People visibility

## Product rules
- Public GitHub **username + derived tier only** (via Edge `github-tier`)
- **Default hidden** (`github_visible = false`)
- User must enable **“Show my DNA to other Cadens builders”**
- **Disconnect** clears cache and hides
- Not Nearby, not a feed, not a GitHub clone

## Deploy order
1. SQL: `15-builder-dna.sql` → `16-audit-fixes.sql` → `17-builder-dna-read.sql`
2. Edge Function: `github-tier` (optional secret `GITHUB_TOKEN`)
3. Frontend redeploy

## Surfaces
| Surface | Behavior |
|---------|----------|
| **You → Builder DNA** | Username, connect/refresh, tier chip, visibility toggle, disconnect |
| **People → Builders** | List of opt-in others (display name, @username, tier) + link to Your DNA |

## Acceptance
- [ ] New user can connect without prior `daybook_accounts` row
- [ ] Visibility off → not in People list
- [ ] Visibility on → appears for other signed-in users
- [ ] Disconnect removes from list and clears You state
- [ ] Invalid GitHub username → toast error, app stable

## Out of scope
GPS nearby, contact discovery, public posts feed, repo/PR UI
