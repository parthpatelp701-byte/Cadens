# Feature preservation matrix

Source review: original `daybook-cadens` release and current React working tree, 13 September 2026. Other work is landing in parallel; this matrix distinguishes source availability from deployment/test evidence. No row is a claim that the new preview is live.

| Capability | Preserved original `/app.html` | React migration status / release gate |
| --- | --- | --- |
| Email signup/login/reset; Google | Original auth and cloud bundles retained | Shared React auth exists; real provider/recovery round-trip still required |
| Tasks, subtasks, categories, priority, energy, estimates, planned dates | Complete original task UI retained | Adapter/editor being ported against original records; compare all fields and concurrent saves |
| Recurrence and fair completion points | Original repeat/reward/leaderboard logic retained | Compatibility logic must match old completion and clone semantics, including duplicate-completion prevention |
| Daily task dashboard and calendar | Original views retained | Today route plus new shared calendar UI implemented; live additive migration and cross-account checks gate release |
| Shared family/group calendar editing | Original does not provide this new model | Approved members edit events; owner manages calendar; pending/removal isolation must pass live |
| Notes, links/bookmarks, shopping lists and places | Original collection UIs retained | React saves adapter uses original collections; test edits without dropping list/place metadata |
| Photos/private backups | Original photo handling and private storage retained | React upload, signed URL display and cross-device backup round-trip require separate validation |
| Groups, owner approvals, family/group sharing | Original UI and existing RPCs retained | React adapter in progress; verify same memberships and approval rules, no second group system |
| Posts, comments, reactions | Original social views retained | React compatibility in progress; audience visibility and attribution must match existing RLS |
| Weekly points/leaderboard privacy | Original snapshot/opt-out logic retained | Do not infer React parity from a generic progress feed; original tools remain the fallback |
| Outlook connection/import | Original MSAL code retained unchanged | No new React Outlook port; consent and configured Microsoft app still need manual validation |
| Import/export and old captures import | Original tools retained | React export being reviewed for completeness; do not remove original export while migration is incomplete |
| Account deletion | Original behavior unchanged | New destructive flow must remain unavailable until complete server-side cleanup is validated |
| Reminders | Original app-open reminder behavior retained | React refresh/logout timer cleanup exists; background push delivery not established |
| Journal, idea boards, messages, notifications | Retained only where existing source actually supports them | ZIP screens alone are not backend readiness; disable or label incomplete flows until compatible RPCs exist |
| AI, discovery, GitHub profile add-ons | Not required for existing feature preservation | Later/optional scope; do not advertise or enable by default in controlled beta |
| Supplied landing and auth presentation | Landing and original auth included as static artifacts | Landing CTAs enter React; React auth is separate implementation, fallback auth retains supplied design |

## Why the original route remains

The new React architecture must not hide old functionality or force destructive data conversion. The preserved page reads the same original Daybook backend and authenticates to the same Supabase project. It is not an embedded copy, a demo account or a second backend. Users can return to original tools while each React equivalent is validated.

Avoid editing the same account in both interfaces simultaneously during beta testing: original revision checks and the React adapter must surface conflicts, not silently overwrite data. Cross-interface sequential edits and conflict behavior belong in release tests.

## Packaging evidence

The five original app/auth/cloud artifacts are byte-for-byte preserved. The supplied landing is preserved with only React auth CTA destinations and removal of the old callback-forwarding script. The artifact integrity command checks SHA-256 values and inline-script CSP hashes. Behavioral tests and live deployment smoke checks are tracked separately by the parent implementation; packaging integrity alone does not prove functionality.
