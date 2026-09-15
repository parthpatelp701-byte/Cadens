# Cadens Update Changelog

All work done to take the original monolithic Daybook HTML app toward a
production-ready private social product (Groups · Feed · Stories · DMs · Notifications).

---

## Architecture decision

- **Keep** existing Supabase backend (RLS, RPCs, daybook_sync, groups, feed).
- **Replace** monolithic `index.html` with a React + TypeScript + Vite + Tailwind frontend.
- **Extend** backend with new tables only where needed (notifications, stories, messages, push).

---

## SQL migrations

### 01 — Notifications
- Table `daybook_notifications`
- RPCs: list, mark read, unread count
- Hook into like/comment to create notifications
- RLS: users only see their own

### 02 — Stories
- Tables `daybook_stories`, `daybook_story_views`
- 24-hour expiry, group/family scoped access
- RPCs: feed, create, mark viewed
- Text + image stories

### 03 — Messages
- Tables `daybook_conversations`, `daybook_conversation_members`, `daybook_messages`
- 1:1 chat start, send, list, unread
- Auto-notify on new message
- RLS: members only

### 04 — Push subscriptions
- Table `daybook_push_subscriptions`
- RPCs: subscribe, unsubscribe
- Used by Profile UI + Edge Function

---

## Frontend (cadens-frontend)

- App shell: bottom nav (mobile) / left sidebar (desktop)
- Pages: Home (feed + stories), Groups, Messages, Notifications, Profile, Explore
- Composer: text, mood, privacy, photo upload
- Post cards: likes, inline comments, images
- Stories rail + full-screen viewer + create (text/photo)
- Groups: create, join code, approve/reject, message member
- Messages: conversation list + realtime chat
- Notifications: server-backed list + unread badge
- Profile: enable/disable web push
- PWA: manifest + service worker

---

## Edge Function

- `send-push` — loads subscriptions, signs VAPID JWT, POSTs to browser push services
- Cleans up expired endpoints
- Optional shared secret header for webhooks

---

## Deploy

- `netlify.toml` — SPA redirects, security headers, SW cache rules
- `DEPLOY.md` — full checklist
- `.env.example` — Supabase + VAPID public key

---

## Run order reminder

1. SQL 01 → 02 → 03 → 04  
2. Enable Realtime tables  
3. Frontend `.env` + `npm run dev`  
4. Netlify deploy  
5. (Optional) VAPID + deploy `send-push` + webhook  

---

## MVP polish (P1) — this handoff

- **Optimistic likes & comments** — instant UI feedback with rollback on error
- **Edit / delete own posts** — menu on PostCard + `deletePost` / `updatePostText` via daybook_sync
- **Message from profile** — `/profile/:userId` + Message button (uses `startConversation`)
- **Group chats** — SQL `05-group-chats.sql` + Groups “group chat” button + multi-person create RPC
- **Empty states, toasts, skeletons** — Toast provider, PostSkeleton / ListSkeleton, improved empty copy on Feed / Messages / Groups / Notifications
- **RLS** — existing messages/notifications tables remain RLS-only; new RPCs are security invoker + membership checks


---

## P2 ship (remaining)

1. **Multi-image posts** — up to 4 images; `MediaCarousel` on PostCard; `photo_paths` / `media` in payload
2. **Mentions** — `@name` parse, highlight in posts/comments, local + best-effort server notify
3. **Explore** — real `daybook_feed` content + search
4. **Image compression** — `lib/image.ts` canvas compress before upload
5. **Automated tests** — `src/lib/mentions.test.ts` (run `npm run test:mentions`)
6. **FCM Android** — guide only: `guides/FCM_ANDROID.md` (needs native shell)
7. **Group feed filter / settings** — Home filter dropdown; `/groups/:groupId` settings page
