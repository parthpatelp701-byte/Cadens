# Deploy Cadens to Netlify

## 1. Supabase SQL (run in order)

1. `supabase-notifications.sql`
2. `supabase-stories.sql`
3. `supabase-messages.sql`
4. `supabase-push.sql`

Enable Realtime on:
- daybook_notifications
- daybook_stories
- daybook_messages
- daybook_records
- daybook_reactions
- daybook_comments

## 2. Environment variables

In Netlify → Site settings → Environment variables:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_VAPID_PUBLIC_KEY=...   # optional, for push
```

## 3. Deploy

Option A — GitHub
1. Push `cadens-frontend` to a repo (or a `/frontend` folder)
2. Netlify → New site from Git
3. Build command: `npm run build`
4. Publish directory: `dist`

Option B — CLI
```bash
cd cadens-frontend
npm install
npm run build
npx netlify deploy --prod --dir=dist
```

## 4. Push notifications (optional)

```bash
npx web-push generate-vapid-keys
```

- Put **public** key in `VITE_VAPID_PUBLIC_KEY`
- Keep **private** key only in a Supabase Edge Function or server that sends pushes
- Users enable push from Profile → Enable push notifications

Sending a push requires a small Edge Function that:
1. Loads subscriptions from `daybook_push_subscriptions`
2. Uses `web-push` library with your VAPID private key
3. Sends on new notification / message

## 5. Auth redirects

In Supabase → Authentication → URL configuration:
- Site URL = your Netlify URL
- Redirect URLs = `https://your-site.netlify.app/**` and `http://localhost:5173/**`

## 6. Edge Function: send-push

See `supabase/functions/send-push/README.md`.

Summary:

```bash
npx web-push generate-vapid-keys
supabase secrets set VAPID_PUBLIC_KEY="..."
supabase secrets set VAPID_PRIVATE_KEY="..."
supabase secrets set VAPID_SUBJECT="mailto:you@example.com"
supabase secrets set PUSH_HOOK_SECRET="long-random-string"
supabase functions deploy send-push
```

Then add a Database Webhook on `daybook_notifications` INSERT → POST to the function.
