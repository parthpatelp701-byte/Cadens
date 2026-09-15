# Stronger Android push (FCM)

Web push (VAPID) works in Chrome/Edge on Android, but **background reliability** is better with **Firebase Cloud Messaging (FCM)** inside a Capacitor / TWA / native wrapper.

## Recommended path

1. Keep existing `daybook_push_subscriptions` + `send-push` Edge Function for **web**.
2. Add a Capacitor (or React Native) shell for Android.
3. Register FCM device tokens; store in a parallel table e.g. `daybook_fcm_tokens (user_id, token, updated_at)`.
4. Extend `send-push` (or a second function) to:
   - Send Web Push for browser endpoints
   - Send FCM HTTP v1 for Android tokens (service account JSON as secret)

## Minimal schema sketch

```sql
create table if not exists public.daybook_fcm_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);
alter table public.daybook_fcm_tokens enable row level security;
-- users manage own tokens only
```

## Why not in this frontend-only ship

FCM requires a Google Cloud project, service account, and native (or Capacitor) client. Shipping secrets or pretending pure-web FCM would be incomplete. Use this guide when you wrap Cadens for Play Store.
