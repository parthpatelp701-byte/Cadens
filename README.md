# Cadens

Cadens is a private-first life coordination app for tasks, calendars, journals, saves, ideas and trusted groups.

Live beta: https://cadens-private-beta.netlify.app

## Stack

- React 19, TypeScript, Vite and Tailwind CSS
- Supabase Auth, Postgres, Row Level Security and Edge Functions
- Netlify static hosting with SPA routing and security headers

## Local development

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Set the public Supabase URL and publishable key in `frontend/.env`. Never commit service-role, email-provider or deployment secrets.

## Verification

```bash
cd frontend
npm run test:unit
npm run test:library
npm run test:preservation
npm run build
```

Database migrations and their run order live in `sql/`. Netlify builds from `frontend/` using the root `netlify.toml`.

## Status

The controlled beta is live. The landing/auth heartbeat theme and responsive app shell are deployed. Advanced task, calendar and social-tool consolidation remains in progress; see `PLAN.md`, `STATUS.md` and `UI_HANDOFF_REVIEW.md` for the current release boundary.
