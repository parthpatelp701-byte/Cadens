# Cadens Frontend (React)

New production frontend for Cadens — private-first life coordination with Facebook/Instagram-style social features inside trusted groups.

## Stack
- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Supabase (Auth + existing RPCs)
- React Router 7
- Lucide icons

## Getting started

```bash
cd cadens-frontend
cp .env.example .env
# Edit .env with your Supabase URL + publishable key

npm install
npm run dev
```

Open http://localhost:5173

## Structure

```
src/
  components/
    auth/          # Login / signup UI pieces
    feed/          # Feed-specific components
    post/          # PostCard, Composer, CommentThread
    stories/       # (Phase 2)
    groups/
    notifications/
    layout/        # AppShell (responsive sidebar + bottom nav)
    ui/            # Buttons, LoadingScreen, etc.
  pages/           # Route-level pages
  hooks/           # useAuth, useFeed, etc.
  lib/             # supabase client
  types/           # Shared TypeScript types
  styles/          # Global design tokens
```

## Roadmap alignment
- Phase 1: Feed, posts, likes, comments, groups, notifications
- Phase 2: Stories, richer media, explore
- Phase 3: Direct messages

This frontend is designed to talk to your existing Supabase RPCs (`daybook_feed`, `daybook_social_action`, `daybook_groups`, etc.).
