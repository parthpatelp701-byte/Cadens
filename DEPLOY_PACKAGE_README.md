# Cadens v2 — Deploy Package

Private productivity system: Saves · Progress · People · You · Idea Boards

## Contents

```
cadens/
├── frontend/           # React 19 + Vite 6 + Tailwind 4 app
├── sql/                # Run in order (see sql/RUN_ORDER.md)
├── edge-function/      # Supabase Edge Functions (generate-embedding, unfurl, send-push)
├── deploy/             # Netlify config
├── guides/             # Extra docs
├── STATUS.md           # Build status
└── DEPLOY_PACKAGE_README.md
```

## 1. Supabase SQL

In SQL Editor, run in order:

1. `sql/01-notifications.sql` … `04-push.sql` (if not already)
2. `sql/05-saves.sql`
3. `sql/06-progress.sql`
4. `sql/07-idea-boards.sql`
5. `sql/08-semantic-search.sql`  (requires vector extension)
6. `sql/09-phase5-notifications.sql`
7. `sql/10-tighter-rls.sql`

Enable **Realtime** on: `idea_boards`, `ideas`, `idea_reactions`, `daybook_notifications` (optional: `saves`, `progress_posts`).

## 2. Edge Functions

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase functions deploy generate-embedding
supabase functions deploy unfurl
# optional push:
supabase functions deploy send-push
```

Functions also live under `frontend/supabase/functions/` for CLI from the frontend folder.

## 3. Frontend

```bash
cd frontend
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev      # local
npm run build    # production → dist/
```

## 4. Netlify

- Publish directory: `frontend/dist` (or build from `frontend/`)
- Config: `frontend/netlify.toml` or `deploy/netlify.toml`
- SPA redirects are included

```bash
cd frontend && npm run build
# Deploy dist/ to Netlify
```

## Product

> Save what matters. Find it later. Plan with your people. Show progress — nothing extra.

Tabs: **Saves** · **Progress** · **People** · **You**  
Idea Boards live under Groups.
