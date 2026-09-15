# Cadens — Complete Update Package

Everything created for the production-ready private social frontend:
SQL migrations, Edge Function, Netlify config, and deploy guides.

---

## Folder map

```
cadens-docs/
├── README.md                          ← this file
├── CHANGELOG.md                       ← what was built
├── sql/
│   ├── 01-notifications.sql           ← server notifications
│   ├── 02-stories.sql                 ← 24h stories
│   ├── 03-messages.sql                ← direct messages
│   └── 04-push.sql                    ← web push subscriptions
├── supabase/
│   └── functions/
│       └── send-push/
│           ├── index.ts               ← Edge Function source
│           ├── config.toml
│           └── README.md              ← push setup details
└── deploy/
    ├── netlify.toml                   ← Netlify build + headers
    ├── .env.example                   ← required env vars
    └── DEPLOY.md                      ← step-by-step deploy
```

Frontend source lives in the companion zip: **cadens-frontend.zip**

---

## Quick start (order matters)

### A. Supabase SQL — run in SQL Editor, in this order

1. `sql/01-notifications.sql`
2. `sql/02-stories.sql`
3. `sql/03-messages.sql`
4. `sql/04-push.sql`

### B. Enable Realtime (Dashboard → Database → Replication)

Turn Realtime ON for:

- `daybook_notifications`
- `daybook_stories`
- `daybook_messages`
- `daybook_records`
- `daybook_reactions`
- `daybook_comments`

### C. Frontend

```bash
unzip cadens-frontend.zip
cd cadens-frontend
cp .env.example .env
# fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

### D. Deploy to Netlify

See `deploy/DEPLOY.md`. Use `deploy/netlify.toml`.

### E. Web Push (optional)

See `supabase/functions/send-push/README.md`.

```bash
npx web-push generate-vapid-keys
supabase secrets set VAPID_PUBLIC_KEY="..."
supabase secrets set VAPID_PRIVATE_KEY="..."
supabase secrets set VAPID_SUBJECT="mailto:you@example.com"
supabase functions deploy send-push
```

Add a Database Webhook on `daybook_notifications` INSERT → POST to the Edge Function.

---

## Feature checklist

| Feature | Status | Notes |
|---------|--------|--------|
| React + Vite + TypeScript + Tailwind | Done | Mobile + desktop responsive shell |
| Auth (Supabase) | Done | Uses existing project |
| Groups create / join / approve | Done | Existing RPCs |
| Feed posts (text + photo) | Done | daybook_sync + cadens-photos |
| Likes + comments | Done | daybook_social_action |
| Stories (text + photo, 24h) | Done | sql/02 + UI |
| Direct messages | Done | sql/03 + chat UI |
| Server notifications + badge | Done | sql/01 |
| Message member from Groups | Done | Starts 1:1 DM |
| Web push subscribe UI | Done | Profile page |
| Edge Function send-push | Done | supabase/functions/send-push |
| Netlify + PWA config | Done | deploy/ |

---

## Auth redirect URLs

Supabase → Authentication → URL configuration:

- Site URL = your Netlify URL  
- Redirect URLs = `https://your-site.netlify.app/**` and `http://localhost:5173/**`

---

## Support files in frontend zip

- `src/` — full React app
- `public/sw.js` — service worker (push + offline shell)
- `public/manifest.webmanifest` — installable PWA
- `netlify.toml`, `.env.example`, `DEPLOY.md`
- All four `supabase-*.sql` files (same as `sql/` here)
