# Cadens React migration — 12 September 2026

Working copy: `cadens-react/frontend`. Original ZIP and current Daybook app are preserved.

## Implemented locally

- React foundation repaired; pinned dependencies and package lock; production build passes.
- Today route is the signed-in home, showing due/overdue tasks and a Pacific calendar agenda.
- Shared auth context; email login/signup/reset, password recovery form and Google OAuth entry point.
- Lazy-loaded secondary pages; initial JavaScript reduced from approximately 697 KB to 532 KB before compression. Further bundle optimization remains.
- Private-by-default progress composer with an approved-group selector.
- Calendar recurrence handles old series, Pacific daylight-saving transitions, range overlap and recurrence end dates.
- Series edits retain identity, notes, location and recurrence. Calendar selection is locked during editing to prevent accidental sharing changes. Expanded instances edit the whole series; individual occurrence exceptions are not implemented yet.
- Calendar creation explicitly distinguishes personal/work/focus (private) from an owner's group (approved members can edit events).
- Event reminder timers are replaced on refresh and cleared on account changes. These are browser-open reminders, not background delivery.
- Corrected CSS cascade layering from the ZIP; linked auth field labels; existing login passwords are not blocked by new-password length rules.

## Backend artifact

`frontend/supabase/migrations/20260912023702_react_planning_compatibility.sql` adds calendars/events with RLS and compatible RPCs. It uses the existing Daybook approved-member helper and does not overwrite the live baseline or existing records.

**This migration is prepared and tested in isolated Postgres, not applied to live Supabase.** It is a calendar increment, not the complete application backend. It must not be confused with a complete data migration.

## Evidence

- Production TypeScript/Vite build passed. Non-blocking bundle-size and mixed-import warnings remain.
- Six automated calendar tests passed: long-running recurrence, spring/fall DST, recurrence end date, multi-day/range boundary, numeric title preservation, explicit quick-add times.
- Isolated PGlite/Postgres migration and access checks passed: default calendar idempotency, private isolation, approved-member event edits, owner-only calendar management, immutable creator, pending/outsider rejection, member removal revocation and anonymous denial.
- Local browser sign-in, signup, reset and recovery screens render. This is a UI smoke check; no account was created and no email or Google authentication flow was submitted.
- Live RLS, live auth, responsive signed-in flows and deployment smoke tests are still pending.

## Next required work before release

1. Preserve/migrate existing task metadata, subtasks, recurrence, fair points, settings and original record IDs. The ZIP's new task/journal/save RPCs are not available in the live database yet.
2. Finish backend compatibility for saves, journal, social/group features, comments/reactions, photos and existing useful features. Review export/deletion and optimistic concurrency before allowing writes.
3. Preserve the supplied landing/auth presentation and existing URLs; finish feature parity against the original app and accepted plan.
4. Apply validated additive migrations; test real two-account isolation and shared-calendar behavior, including removal and concurrent edits.
5. Deploy a preview and check login/recovery/Google, data persistence, mobile layout and rollback. Replace production only after preservation gates pass.
6. Save to GitHub after the agreed checks pass.

The current Netlify production app and live Supabase records were not changed in this increment. Do not describe this React migration as fully functional or deployed yet.
