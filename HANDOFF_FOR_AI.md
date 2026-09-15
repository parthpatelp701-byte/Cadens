# Cadens — Full Handoff Package (for AI / developers)

Complete snapshot of the Cadens private social product rebuild.

## Product

Private-first social / life-coordination app: groups, feed (text+photo), stories, DMs, notifications, web push.
Backend: Supabase (existing Daybook RPCs + new migrations).
Frontend: React + Vite + TypeScript + Tailwind (replaces monolithic index.html).

Original repo: https://github.com/parthpatelp701-byte/Cadens

## Layout

```
cadens-share/
├── HANDOFF_FOR_AI.md
├── frontend/                 # Full React app
├── sql/                      # Run in order in Supabase SQL Editor
│   ├── RUN_ORDER.md
│   ├── 01-notifications.sql
│   ├── 02-stories.sql
│   ├── 03-messages.sql
│   └── 04-push.sql
├── edge-function/send-push/  # Supabase Edge Function
├── deploy/                   # netlify.toml, .env.example, DEPLOY.md
└── guides/                   # README, CHANGELOG, deploy & push docs
```

## Setup

1. Run SQL: 01 → 02 → 03 → 04
2. Enable Realtime: daybook_notifications, daybook_stories, daybook_messages, daybook_records, daybook_reactions, daybook_comments
3. Frontend:
   ```bash
   cd frontend && cp .env.example .env
   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
   npm install && npm run dev
   ```
4. Deploy: see deploy/DEPLOY.md (Netlify, publish dist)
5. Optional push: see guides/PUSH_EDGE_FUNCTION.md

## Existing RPCs used (do not break)

daybook_load, daybook_sync, daybook_feed, daybook_social_action, daybook_groups, daybook_group_action
Storage bucket: cadens-photos

## Features done

Auth shell, feed+photos, likes/comments, groups, stories (text/image), DMs, server notifications+badge, message from groups, PWA SW, push subscribe UI, send-push Edge Function, Netlify config.

### P1 polish (this pass)

1. **Edit / delete own posts** — PostCard menu; `deletePost` / `updatePostText` in `lib/posts.ts` via `daybook_sync`
2. **Optimistic likes & comments** — instant UI + rollback + toasts
3. **Message from profile** — `/profile/:userId` + Message button
4. **Group chats** — `sql/05-group-chats.sql`; Groups page group-chat button; `startGroupConversation` / `createGroupConversation`
5. **Empty states, toasts, skeletons** — `ToastProvider`, `PostSkeleton` / `ListSkeleton` across Feed, Messages, Groups, Notifications
6. **RLS** — new RPCs security invoker + membership checks; review existing policies still apply

## Next ideas

Full encrypted web-push, multi-image posts, FCM Android, tests, merge to GitHub under frontend/ + database/migrations/

## Security

Never put VAPID private key or service role in frontend. Keep RLS on all new tables.
Run `05-group-chats.sql` after messages migration.
