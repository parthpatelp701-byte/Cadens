# Cadens product requirements

Version 0.1 | 4 September 2026 | Controlled beta specification

## Current implementation decisions — September 5, 2026

The owner supplied Daybook-GenZ (3).html and Daybook-Feature-Guide.docx and explicitly superseded the earlier fresh-frontend decision. Use the exact original HTML with asserted minimal patches. Preserve Outlook sign-in and all useful original features. Supabase provides a separate Cadens account, private records and approved group collaboration. Netlify hosts the static built page; GitHub stores the private source.

Use America/Vancouver for Pacific dates and reminders, including daylight saving. Group join codes create pending requests. Owners approve/remove members and rotate codes. Family audiences require approved membership in a shared family group. Personal contact entries do not grant account access. The original Public audience is labelled Approved family for this controlled beta. Task assignment and collaborative editing are later increments, separate from shared posts.

Gmail SMTP is configured in Supabase using the owner's Gmail account; the owner confirmed recovery-email receipt. SMTP secrets stay solely in Supabase. Resend is not the current sender. The original reference remains untouched, and the earlier prototype objects table is preserved with an explicit import path.

The detailed requirements below remain the roadmap. Implemented behavior and release evidence are tracked in the app README; roadmap features must not be described as shipped until verified.

## Purpose and product vision

Confirmed account and platform requirements: the app name is Cadens. Use Netlify for hosting and Supabase for authentication and backend data. Integrate account creation, email verification, email/password login, logout, forgotten-password email, password reset, and authenticated password changes. Show clear validation and expired-link errors without revealing whether another person's email has an account. Recovery redirects must use explicitly allowed Cadens origins. Default every new account's content to private; access to another user's content requires explicit sharing and server-enforced authorization. Account registration must never grant membership in another user's Space. For the controlled beta, support the complete signup journey while restricting beta admission to invited or approved participants.

Account acceptance tests must cover successful signup and verification, incorrect credentials, recovery and expired recovery links, password changes, logout, expired sessions, account switching, and two independently registered users. User A must be unable to read or modify user B's data through either the interface or direct API requests. Explicit sharing grants access only to the chosen audience and content; revocation blocks subsequent reads and writes. Sharing one item must not expose the rest of its owner's personal data.

Cadens helps people capture what matters, decide when to act, and coordinate with selected people in one private home. Tasks, events, ideas, notes, lists, places, and bookmarks remain distinct objects with shared organization and collaboration. A restaurant can be saved without becoming an overdue task; an idea can later produce a task; a shopping list can belong to a family Space.

The immediate outcome is a reliable prototype for 10–15 invited testers over approximately three months. The beta should establish whether personal planning and small-group coordination are useful enough to become weekly habits. Broad distribution, monetization, public social networking, and AI are outside the first beta.

Product owner: the Cadens founder. Engineering and verification: the implementation team. The founder selects testers, resolves the open product decisions, and makes release decisions against the gates below.

## Evidence and current state

The referenced App Concept Review describes six uploaded prototypes, but their contents are not available in this task. The local sources directory is empty. Claims in that conversation about working features are leads for inspection, not verified implementation evidence. No foundation has yet been selected.

Connected GitHub repository discovery and Netlify project discovery returned empty lists. This establishes an access or discovery gap, not that the projects do not exist.

The connected Supabase project Reminder App, reference rrqyoeeqwgihjcfmyveq, is active in us-west-2. Metadata inspection found public.profiles, public.tasks, and public.task_transactions with RLS enabled. Reported row counts were 5, 9, and 20 respectively; these are discovery counts, not a verified tester count. No personal row contents were inspected. Existing ownership policies compare auth.uid() with the profile ID or user_id in both USING and WITH CHECK.

Tasks currently support text, completion, archive state, category, date-only due dates, priority, and progress. Profiles include timezone, reminder time, contacts, and categories. This is an existing populated system: migration must preserve it.

Security advisors reported mutable function search_path, client execute privileges on two SECURITY DEFINER functions, and disabled leaked-password protection. These warnings require validation of function definitions and auth configuration; they are not proof of an exploitable issue. Existing transaction ownership also needs a cross-owner parent-link test before reuse for collaboration.

## Personas and primary journeys

| Persona | Situation | Successful journey |
| --- | --- | --- |
| Individual planner | Captures work and home commitments on a phone | Capture a task, schedule tomorrow, find it in Today, complete it |
| Household coordinator | Shares groceries and chores | Create a family list, invite a partner, assign a chore, see completion |
| Friend group organizer | Saves restaurants and plans outings | Save a place, discuss it in a friends Space, create a linked event |
| Small project participant | Coordinates a limited shared project | Capture an idea, derive a task, assign it, resolve a question in comments |

Personas are hypotheses for recruitment, not research findings. Recruit a mix of personal users and at least two real groups; a collection of unrelated individual accounts cannot validate collaboration.

## Information architecture

Primary navigation: Today, Inbox, Calendar, Spaces, and Search. Settings contains profile, timezone, notification preferences, account controls, export, and beta feedback. Capture remains accessible from every primary view.

Inbox contains unscheduled personal captures. Today separates planned work, overdue tasks, and today's events. Calendar initially offers agenda and month views with a selected-day list; undated items remain available outside the calendar. Space detail contains its objects and contextual activity. Object detail contains content, dates, status, assignment, and authorized discussion.

Each object belongs to exactly one Space in the proposed beta model. A personal Space is private to its owner. Shared Space labels include family, work, friends, and project; labels do not change permissions. Categories and tags organize content and never grant access.

Links between objects preserve context without granting permission to their targets. Converting an idea to action should create a linked task and preserve the original idea. Moving an object to a shared Space changes its audience and must show a confirmation identifying that audience. Cross-Space sharing and guest access are deferred until their permission model is agreed.

## Phased delivery

| Phase | Deliverable | Exit gate |
| --- | --- | --- |
| 0 Foundation | Inspect every prototype, repo, deployed site, auth, schema, jobs; document comparison; capture regression baseline | Foundation selected with evidence, baseline tests run, backup and restore path verified |
| 1 Personal reliability | Preserve task CRUD and existing supported behavior; reliable auth, Today, safe errors, data persistence | Two-account isolation, reload and failure-path tests pass on Netlify preview |
| 2 Universal capture | Typed capture, personal Space, lists, agenda/month calendar, search, linked objects | Every type persists and renders correctly; migration rehearsal preserves legacy tasks |
| 3 Shared coordination | Explicit invitations, Spaces, assignment, comments, reactions, object activity | Permission matrix and membership-revocation tests pass; two-device journey passes |
| 4 Beta operations | Agreed reminder delivery, content-free analytics, export/deletion workflow, support and release controls | Small pilot passes, then staged enrollment to 10–15 testers |
| Later | AI, public discovery, richer integrations, attachments, advanced recurrence and offline editing | Separate requirements informed by beta evidence |

Phases are dependency ordered and have no promised calendar delivery dates. Preserve useful existing recurrence, subtasks, or export functionality if verified; do not remove working features simply because their generalized replacement is scheduled later.

## Functional requirements and acceptance criteria

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| AUTH-01 | Controlled beta authentication | Only invited or explicitly approved users can access beta data; invalid/expired invitations fail clearly; sign-out clears rendered and cached private data |
| AUTH-02 | Account recovery and sessions | Recovery works from the deployed origin; expired sessions cannot silently lose edits; signing in as another user never reveals prior-user content |
| CAP-01 | Universal capture | User chooses task/event/idea/note/list/place/bookmark, enters a title, and saves to a visible Space; default is personal; duplicate submission produces one object |
| CAP-02 | Type-specific data | Tasks have status, priority and optional dates; events have start/end and timezone; notes/ideas have body; lists have checkable items; places have name and optional address/URL; bookmarks have a validated web URL |
| TASK-01 | Task lifecycle | Create/edit/complete/reopen/archive persists after reload; existing IDs and legacy completion state survive migration; failed saves retain user input |
| TASK-02 | Planning and recurrence | Planned date differs from deadline; overdue logic excludes complete/archived tasks; preserve verified recurrence and test duplicate prevention before extending it |
| CAL-01 | Calendar | Dated tasks and events appear on the correct local date; all-day dates do not shift across timezones; invalid event end times are rejected |
| LIST-01 | Shared checklists | Add/edit/check/reorder entries; changes persist; simultaneous changes to different entries do not overwrite each other |
| SPACE-01 | Space membership | Owner can invite and revoke permitted members; recipients explicitly accept; expired/revoked invites cannot grant access; members cannot promote themselves |
| SHARE-01 | Audience transparency | Space audience is visible in detail and before changing visibility; no public links are generated by default; unauthorized deep links reveal no object metadata |
| ASSIGN-01 | Assignment | Assignee must be a current member of the same Space; removed members cannot retain access through assignments; reassignment appears in activity |
| SOCIAL-01 | Object-centered collaboration | Authorized members can comment and react on an object; duplicate reactions are prevented; content is rendered as text or sanitized markup |
| ACT-01 | Activity integrity | Content changes create activity atomically; actor and timestamp are server-derived; failed changes create no success activity; clients cannot forge audit records |
| FIND-01 | Retrieval | Search title/body of authorized objects and filter by type/Space/status; results respect current membership; archive is excluded by default |
| REM-01 | Reminders | User explicitly enables the agreed channel; delivery respects timezone and preferences; retries are idempotent; cancellation prevents future queued reminders |
| DATA-01 | Data controls | Export includes all authorized personal data in a documented format; import validates before writing and reports duplicates; deletion has a stated effect on shared content |
| BETA-01 | Feedback | User can copy app version and report a problem without exposing task content by default; feedback submission clearly states what is included |

Initial title/body/list size limits should be documented in UI and database constraints. Preserve the existing task title limit of 200 characters until compatibility is assessed. Do not silently truncate imports. URL fields allow only validated HTTP(S) links; automatic remote previews are deferred.

## Permissions and privacy

Private by default is mandatory. The proposed initial shared model is one owner and members, with all members able to view shared objects, comment, react, and update task/checklist state. Who can edit or delete another person's content remains an explicit decision before phase 3. Personal information must not become visible merely because users share a Space.

| Operation | Anonymous | Personal owner | Shared member | Shared owner |
| --- | --- | --- | --- | --- |
| Read personal objects | Deny | Allow own | Deny others | Deny others |
| Read shared objects | Deny | Membership required | Allow | Allow |
| Invite/remove members | Deny | Not applicable | Deny initially | Allow |
| Edit shared content | Deny | Membership required | Decision pending | Proposed allow |
| Write comments/reactions | Deny | Allow own context | Allow in Space | Allow in Space |
| Modify audit records | Deny | Deny | Deny | Deny |

Enforce permissions in Supabase RLS, constraints and controlled server operations, not just hidden buttons. Test SELECT, INSERT, UPDATE and DELETE separately using actual authenticated roles. An administrator SQL session bypasses RLS and is insufficient evidence. UPDATE policies must constrain both existing rows and proposed ownership/Space values. Validate parent-child relationships for lists, comments, assignments, transactions and links.

Membership revocation must block subsequent server reads and writes immediately, including subscriptions and linked objects. Previously delivered copies cannot be recalled; clear cached content on revocation, sign-out and account switching. Avoid persistent offline content caching in the initial beta until its privacy behavior is designed.

Use publishable keys in the client. Keep service credentials server-side, outside source control and logs. Use explicit grants, enable RLS on exposed tables, pin dependencies and commit lockfiles. Review SECURITY DEFINER functions for necessity, least privilege and fixed search paths. Do not use editable user metadata for authorization.

Collect no task titles, notes, addresses, URLs, comments, email addresses or contact lists in analytics. No session replay. Invitation lookup must not expose an account directory. Notification lock-screen content and shared-data deletion require owner decisions before delivery. Region and retention decisions must be resolved before recruiting real testers; this document does not assert legal compliance.

## Architecture and migration approach

Retain the strongest verified prototype UI and useful behavior. Compare the six versions by functional coverage, real persistence, auth correctness, maintainability, accessibility, mobile behavior and security. A richer local-only version may supply UI features while the production version supplies tested persistence; select based on evidence, not filename.

Proposed data model: profiles, spaces, space_members, invitations, objects, task details, event details, list_items, object_links, comments, reactions, activity, reminder_jobs, and minimal analytics events. Exact naming and storage strategy remain subject to source inspection. Every object has an ID, type, Space ID, creator, title, timestamps and version. Constraints prevent cross-Space parent/assignee mismatches. Distinguish actor, creator and assignee.

Do not replace public.tasks blindly. First add compatible structures, rehearse legacy-to-personal-Space mapping using sanitized fixtures, compare counts and values, then introduce an adapter or controlled backfill. Preserve original IDs or keep explicit mapping; record migration version and reconciliation results. Never copy personal content into shared Spaces during migration. Avoid uncontrolled dual writes.

Use optimistic concurrency checks for shared edits, with a visible reload/retry conflict path. Use transactions for changes and activity; unique idempotency keys for jobs and repeated requests. Store instants with timezone-aware timestamps and retain an IANA timezone for scheduling; use date fields for date-only intent. Daylight-saving ambiguity needs a defined behavior before reminders ship.

Netlify hosts the prototype and any required trusted endpoints. Supabase provides auth, database and authorized subscriptions where useful. Existing reminder jobs, functions and integrations must be inventoried before adding another scheduler. Preview deployments must use isolated test data; never connect an unrestricted preview to real beta data by convenience.

## Nonfunctional requirements

Targets below are proposed release gates, not measured results. On an agreed midrange phone/network, primary pages should become usable within 3 seconds and ordinary CRUD requests should complete at p95 under 1 second, excluding auth email delivery. Test with 1,000 objects per tester and concurrent activity from 15 users. Use pagination and indexed permission/date queries.

No acknowledged save may be silently lost. Offline or failed network operations show unsaved status and preserve the draft; offline editing is not promised. Retry must not duplicate objects. A 24-hour maximum recovery point and 4-hour recovery target are provisional goals, dependent on the actual backup plan and a timed restore drill.

Support current stable desktop Chrome/Edge/Safari and iOS Safari/Android Chrome on the agreed tester devices. Primary journeys must work at 360px width, keyboard-only, 200 percent zoom and with a screen reader. Aim for WCAG 2.2 AA: labels, focus visibility, sensible focus restoration, contrast, error announcements, and no color-only status. Run accessibility checks plus manual navigation.

## Analytics and success metrics

Use a documented event allowlist: capture_created with type only, task_completed, calendar_opened, invitation_accepted, assignment_changed, collaboration_used, save_failed and reminder_outcome. Include app version, coarse device class, timestamp and a pseudonymous participant ID only where necessary. Keep support logs separate. Retention and opt-in choice must be agreed before enabling collection.

| Metric | Definition | Proposed beta signal |
| --- | --- | --- |
| Activation | Invited tester creates 3 objects and completes 1 task within 7 days | At least 80 percent of enrolled testers |
| Week 4 usefulness | Activated tester performs a meaningful create/update/complete action in week 4 | At least 60 percent of activated testers |
| Sustained use | Same meaningful-action definition at week 8 | At least 50 percent of activated testers |
| Collaboration | Shared Space has actions by at least 2 members in a week | At least 2 groups for 3 consecutive weeks |
| Capture usability | Moderated simple capture with no assistance | Median under 15 seconds |
| Data safety | Confirmed unauthorized disclosure or acknowledged-save loss | Zero; any occurrence pauses rollout |
| Reliability | Successful attempted writes, excluding user validation errors | At least 99 percent, report counts and failures |
| Qualitative value | Tester identifies a recurring use case and wants continued access | At least 8 testers at end-of-beta interview |

Report numerators and denominators: this sample is too small for confident population claims. App opens alone do not count as meaningful use. Separate reminder provider acceptance from actual device delivery; do not promise delivery reliability without receipts. Review feedback alongside metrics before expanding scope.

## Test strategy and release evidence

Before modification, capture a feature matrix and regression tests from each prototype. Each meaningful increment must run relevant automated checks, manual core journeys and a deployment smoke test. Record commit, schema version, environment, date, test identities, expected/actual result and evidence; label unrun tests explicitly.

Automated unit tests cover date-only behavior, daylight-saving transitions, overdue logic, validation, type conversion, recurrence if retained, and retry/deduplication. Integration tests cover constraints, rollback on failed activity creation, membership, ownership changes, invitation lifecycle, export/import and optimistic conflicts. Browser tests cover login, create/edit/complete, reload persistence, navigation and failure recovery.

The RLS matrix uses anonymous access, user A, user B, an accepted member and a revoked member. Attempt direct API access to known foreign IDs, owner reassignment, Space reassignment, cross-Space assignees and forged transaction parents. Test both valid and denied operations; verify denied writes changed no rows. Use dedicated synthetic accounts and fixtures, not real users' records.

Manual testing covers phone and desktop layouts, keyboard and screen reader, two concurrent devices, timezone boundaries, slow/offline networks, expired sessions, account switching, double taps and stale edits. Include a household shopping flow and a friends place-to-event flow.

Deployment smoke sequence: open the immutable preview URL; verify assets and app version; authenticate a synthetic user; create/edit/reload/complete an object; verify the second user cannot read it; exercise the increment's new journey; sign out; inspect browser/server errors; remove only the test fixtures. Repeat a minimal smoke on the beta URL after promotion. Record a failed or unavailable deployment as blocked, never passed.

## Beta plan

Proposed duration is 12 weeks after the readiness gate. Week 0 recruits and onboards 3–5 pilot participants, verifies recovery and captures starting habits. Weeks 1–2 expand to 10–15 only after the pilot passes; show privacy boundaries and reminder limitations during onboarding. Weeks 3–6 focus on personal planning and household coordination. Weeks 7–10 test repeated use with restrained feature changes. Weeks 11–12 conduct exit interviews and choose continue, narrow, expand or stop.

Founder maintains a participant roster outside analytics and a chosen support channel. Conduct short weekly feedback checks and monthly interviews. Do not automatically message testers until the founder authorizes communication. Record severity, reproduction steps, impact, owner and status for each issue. Privacy/data-loss incidents stop enrollment and trigger immediate investigation; core workflow failures block the next release. Cosmetic issues can enter the backlog.

Recruitment, support channel, adult/minor eligibility, compensation if any, and consent language are unresolved. Do not assume family use authorizes collecting children's data. Tell participants this is a prototype and state support availability without promising round-the-clock response.

## Release and rollback

Use a versioned branch/PR, locked dependencies and an immutable Netlify preview for each increment. Run checks, schema advisors, migration rehearsal and smoke tests before promotion. Gate unfinished capabilities behind flags that default off. Record the app commit, Netlify deploy ID, database migration version and backup reference together.

Before a database change, verify recovery tooling and take an appropriate backup without placing private dumps in the repository. Prefer additive migrations compatible with the previous app. Rehearse on isolated data; validate row counts and legacy field values. Promote to the pilot, monitor failed writes/auth errors and feedback, then expand. Destructive cleanup waits until the rollback window closes.

Rollback triggers: any unauthorized access, confirmed data loss, broken login or repeated failures of a core journey. Disable the affected feature or writes if necessary, restore the previous Netlify deployment, and run smoke tests against the current schema. A frontend rollback does not undo database changes. Prefer a reviewed forward repair; if restore is necessary, preserve post-backup changes for reconciliation, document expected loss, and obtain an explicit decision before destructive restoration.

Founder is the release decision owner; engineering executes and verifies. Keep an incident log with detection time, affected version, containment, recovery and follow-up. Do not resume enrollment until the failed test becomes a passing regression check.

## Decisions and implementation blockers

1. Supply the six original prototype files and identify the GitHub repository and Netlify site. They are not currently accessible in this task. This blocks foundation selection and app implementation.
2. Confirm whether the populated Reminder App Supabase project is the intended beta backend and how test isolation should be provided before writing to it.
3. Before collaboration implementation, decide whether all Space members may edit/delete shared content or whether only authors/owners may do so.
4. Before reminders implementation, select the beta delivery channel: in-app alone cannot reliably notify when the app is closed. Email/push/SMS have different setup and cost implications.
5. Before enrollment, decide participant age eligibility, hosting-region acceptability, analytics consent/retention, deletion rules for shared contributions, and notification content visibility.

These decisions do not prevent writing requirements or inspecting available metadata. They do prevent inventing access rules, choosing a missing foundation, or silently modifying an existing populated backend.

## References

- App Concept Review, conversation 6a9ba625-712c-83e8-a0c7-375fb7cef46a, retrieved for this task; attachments unavailable.
- Connected Supabase project/table/policy discovery and security advisors, inspected 4 September 2026 Pacific time.
- Supabase function search-path advisory: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
- Supabase privileged function access advisory: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- Supabase password security: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
