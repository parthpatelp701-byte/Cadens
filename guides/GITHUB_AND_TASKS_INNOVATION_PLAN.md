# Cadens — GitHub + Task Experience Innovation Plan

## 1. Product objective

Cadens should not feel like a GitHub wrapper or a clone of another task application.

The product opportunity is to combine:

**Personal execution + reflection + lightweight social accountability + optional proof of work.**

GitHub is an input signal. Tasks are an execution layer. Cadens owns the experience.

---

# 2. GitHub: replace the current "tier" idea with Builder DNA

## Current implementation to evolve

The current code has:

- `github-tier` Edge Function
- `fetchGithubTier()` / `saveProductivityProfile()`
- productivity tiers: Spark / Builder / Shipper / Architect
- score based partly on public repos, followers, following, account age and recent events
- nearby peer matching using the tier and score

This is functional groundwork but should **not remain the primary product experience**.

## Why change it

A numerical GitHub score can feel like a social ranking system and can reward popularity/account age rather than meaningful work. Followers and repository count are weak proxies for productivity.

Cadens should instead answer:

> **"What kind of builder are you right now, what are you working toward, and who might help you move forward?"**

## New concept: Builder DNA

Create a Cadens-native profile signal called **Builder DNA**.

Suggested dimensions:

- **Momentum** — recent consistency of building activity
- **Focus** — concentration around a small number of active projects/topics
- **Craft** — evidence of substantive work rather than raw event volume
- **Consistency** — activity spread over time instead of one burst
- **Learning** — signs of experimentation, new repositories/topics or changing activity

Do not expose a single universal ranking number by default.

Show a compact visual profile such as:

`Momentum  •  Focus  •  Craft  •  Consistency`

Each dimension should have a simple qualitative state or bounded level, e.g. Emerging / Steady / Strong.

## GitHub data policy

Use public GitHub data only unless an explicit authenticated integration is later designed.

Do not collect unnecessary personal data.

Do not expose a user's email, private repositories, private activity, tokens or private account information.

Allow:

- connect
- refresh
- hide from People
- disconnect
- delete cached GitHub-derived data

## New GitHub UX

Do not use GitHub's familiar repository/issues/PR vocabulary as Cadens navigation.

Suggested Cadens flow:

### People → Builder DNA

A user can optionally connect GitHub.

After connection show:

- avatar/name if publicly available
- short "building lately" summary
- Builder DNA dimensions
- recent themes/topics
- current momentum
- optional "looking for" intent: feedback / accountability / collaborator / learning / just building

### Builder Card

A Cadens Builder Card should answer in seconds:

- What is this person building?
- What kind of work do they enjoy?
- Are they currently active?
- What kind of connection are they open to?

Do not show follower count as a headline metric.

### Builder compatibility

Replace simple `same tier` matching with a compatibility model using:

- shared interests/topics
- complementary strengths
- similar availability or cadence where available
- shared goals
- optional GitHub activity pattern

Example:

`Good match · both building AI tools · complementary focus styles`

This is more valuable than `Architect ↔ Architect`.

## Nearby builders

Keep the privacy-first nearby concept, but avoid turning it into a public popularity map.

Requirements:

- explicit opt-in
- coarse location only
- session expiration
- no persistent exact location
- ability to stop discovery
- show approximate distance only where appropriate
- do not expose location history

The nearby experience should emphasize **"people building nearby"**, not GitHub rankings.

## GitHub API architecture

Continue using Supabase Edge Functions as the server boundary.

Never call privileged GitHub APIs directly from the browser.

Add deliberate caching/refresh behavior so opening People does not repeatedly hit GitHub.

Handle GitHub rate limits gracefully.

If GitHub is unavailable, Cadens should continue working normally.

## Database evolution

Do not destructively rewrite the existing productivity profile table until dependencies are mapped.

Prefer a migration that can add fields for Builder DNA and preserve compatibility.

Potential fields:

- `momentum_level`
- `focus_level`
- `craft_level`
- `consistency_level`
- `learning_signal`
- `activity_summary`
- `last_github_sync_at`
- `visibility`
- `match_intent`

Exact schema should be chosen after inspecting current SQL and all callers.

Existing `github_score`/tier fields can remain temporarily for backward compatibility but should stop being the primary UI.

---

# 3. Task experience: Cadens Daily Flow

A reviewed reference app, Daily Tasks V2, has several useful interaction ideas: an overview with a next action, planned execution separate from deadline, estimated minutes, My Day, quick date presets, checklist-driven progress, reminders, categories, completed history, sharing and data backup.

Cadens may learn from those **interaction patterns**, but must not copy its branding, wording, layout, styles or implementation.

## New concept: Daily Flow

The Cadens task experience should feel like a personal command center rather than a generic CRUD list.

### Top of Tasks page

Show:

1. **Now** — what should happen next
2. **Today** — today's committed work
3. **Later** — upcoming commitments
4. lightweight progress indicator
5. quick add

Avoid overwhelming dashboards.

## Separate deadline from plan time

This is an important capability.

A task can have:

- deadline: when it must be finished
- planned start: when I intend to work on it
- estimated effort: how long it should take

Example:

`Submit proposal`

Deadline: Friday 5 PM
Plan: Thursday 7 PM
Estimate: 45 min

This should integrate with Cadens Plan/calendar.

## My Day

Add a lightweight daily commitment layer.

Users can pull tasks into today's focus without changing the actual deadline.

Use language such as:

- Focus today
- Up next
- Move to tomorrow
- Keep unplanned

Do not create unnecessary duplicated task records.

## Task card improvements

Current `TaskCard` is a good baseline. Evolve it to optionally show:

- completion control
- title
- short note
- category
- planned time
- deadline
- effort estimate
- progress
- Plan connection
- subtle overdue state
- compact quick actions

On mobile, prioritize the task itself and keep secondary actions in a contextual menu.

## Quick add

Make task capture extremely fast.

Suggested quick-add fields:

- title
- Today / Tomorrow / This week / No date
- optional planned time
- optional estimate

Advanced fields remain available in the full editor.

## Checklist and progress

Support child checklist items for meaningful tasks.

If a checklist exists:

`3 / 5 complete · 60%`

Progress should update automatically where possible.

Do not make users manually enter progress when the checklist can calculate it.

## Task states

Maintain clear states:

- open
- done
- cancelled

Consider a separate planning state in UI rather than multiplying database statuses unnecessarily.

## History

Add a compact completed view:

- completed today
- completed this week
- recent wins

The goal is reflection and motivation, not a giant audit table.

This can later feed Cadens Journal/retention experiences.

## Categories

Use lightweight categories/tags.

Examples:

- Work
- Personal
- Learning
- Health
- Building

Allow user-created categories where the existing architecture supports it.

Do not require category selection for every quick task.

## Reminders

Reuse the existing notification architecture where possible.

Support reminders for planned work rather than only deadlines.

Example:

`Reminder: Start proposal · Thu 7:00 PM`

Do not send redundant reminders when the task is already completed.

## Sharing

Sharing should be intentionally different from collaborative issue trackers.

A user can share:

- today's focus
- pending commitments
- a small progress digest
- a completed win

The shared representation should be human and motivational, not a GitHub-style issue feed.

Use privacy controls and never expose private task notes accidentally.

---

# 4. Cross-feature innovation: Build → Plan → Reflect

The strongest Cadens differentiation should come from connecting features rather than copying individual apps.

## Build

Builder DNA optionally learns from GitHub activity.

## Plan

Tasks and Plan convert intentions into scheduled action.

## Reflect

Journal/Daybook records what happened and what was learned.

## People

Users can share progress or discover compatible builders.

Example loop:

`GitHub activity → Builder DNA → today's focus → completed task → reflection → next focus`

This is the product moat.

---

# 5. Retention opportunities

Implement carefully; avoid manipulative gamification.

Good retention loops:

- daily "one best next move"
- weekly progress reflection
- small completion celebrations
- momentum trends
- meaningful builder connections
- unfinished-task cleanup
- weekly planning prompt

Avoid:

- public productivity leaderboards
- follower-style popularity scores
- shame-based streaks
- excessive notifications
- meaningless badges

---

# 6. Technical implementation sequence

### Phase A — Audit

- inspect current GitHub feature
- inspect `productivity_profiles`
- inspect all RPCs
- inspect People and nearby components
- inspect task schema and calendar sync
- inspect notification architecture
- identify existing migrations and dependencies

### Phase B — Task foundation

- extend task model safely for planning time/estimate/checklist/category as required
- preserve existing calendar sync
- add Daily Flow UI
- add quick add
- add My Day behavior
- add checklist progress
- add history

### Phase C — Builder DNA

- evolve GitHub Edge Function output
- add cached refresh timestamp
- compute Cadens-native dimensions
- redesign Builder UI
- replace score-first presentation
- improve matching signals
- preserve backward compatibility during migration

### Phase D — Cross-feature integration

- connect task focus with Plan
- connect completed work with Journal/Daybook where appropriate
- connect Builder DNA to People
- create optional progress sharing

### Phase E — Quality

- RLS tests
- GitHub rate-limit/error tests
- task/calendar synchronization tests
- mobile tests
- responsive tests
- accessibility checks
- production build
- Netlify deployment verification

---

# 7. Acceptance criteria

## GitHub / Builder DNA

- Does not look or navigate like GitHub.
- No repository/issue/PR clone is introduced.
- GitHub connection is optional.
- No follower-count leaderboard.
- Builder DNA is understandable in under 10 seconds.
- User can disconnect/hide the integration.
- GitHub failure does not break Cadens.
- API calls are protected by the Edge Function boundary.
- Nearby discovery remains opt-in and privacy-safe.

## Tasks / Daily Flow

- Quick task capture takes only a few interactions.
- Deadline and planned execution are separate concepts.
- User can choose today's focus without changing the deadline.
- Estimate and checklist progress are available without clutter.
- Tasks sync correctly with Plan/calendar.
- Completion is reflected immediately.
- Mobile experience is first-class.
- Empty/loading/error states are polished.

## Product differentiation

A new user should understand Cadens as:

> **A place to decide what matters, do it, reflect on it, and optionally connect with people who are building too.**

It should not feel like:

> "GitHub + a task list."

---

# 8. Reference review notes

GitHub's current product combines issues, projects, task lists, custom fields, boards, roadmaps, discussions and code-centric collaboration. Cadens should borrow only general interaction principles such as hierarchy, filtering and progress visibility, not its information architecture or visual identity.

The reviewed Daily Tasks V2 app demonstrates useful task concepts including a next-action overview, planned execution separate from deadline, estimated minutes, My Day, checklist progress, reminders, categories and completed history. These are reference patterns only; implement them with Cadens' own visual language and product model.

The key design principle is **inspiration without imitation**.
