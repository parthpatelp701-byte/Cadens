# send-push — Cadens Edge Function

Sends Web Push notifications to devices stored in `daybook_push_subscriptions`.

## 1. Generate VAPID keys (once)

```bash
npx web-push generate-vapid-keys
```

Copy both keys somewhere safe.

## 2. Set function secrets

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase secrets set VAPID_PUBLIC_KEY="BNxxxxxxxx"
supabase secrets set VAPID_PRIVATE_KEY="xxxxxxxx"
supabase secrets set VAPID_SUBJECT="mailto:you@yourdomain.com"

# Optional but recommended — shared secret for webhooks
supabase secrets set PUSH_HOOK_SECRET="long-random-string"
```

Also put the **public** key in the frontend:

```
VITE_VAPID_PUBLIC_KEY=BNxxxxxxxx
```

## 3. Deploy

From the folder that contains `supabase/functions`:

```bash
supabase functions deploy send-push
```

## 4. Test with curl

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/send-push" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "x-cadens-push-secret: long-random-string" \
  -d '{
    "user_id": "USER_UUID",
    "title": "Cadens",
    "body": "Push is working",
    "url": "/notifications"
  }'
```

## 5. Auto-send on new notifications (recommended)

Supabase Dashboard → **Database → Webhooks → Create a new hook**

| Field | Value |
|-------|--------|
| Name | push-on-notification |
| Table | `daybook_notifications` |
| Events | Insert |
| Type | HTTP Request |
| Method | POST |
| URL | `https://YOUR_PROJECT.supabase.co/functions/v1/send-push` |
| Headers | `Content-Type: application/json` |
|  | `x-cadens-push-secret: long-random-string` |
|  | `Authorization: Bearer SERVICE_ROLE_KEY` (or anon if you prefer) |

Body (JSON):

```json
{
  "user_id": {{ $record.user_id }},
  "title": {{ $record.title }},
  "body": {{ $record.body }},
  "url": "/notifications"
}
```

(Exact template syntax depends on Supabase webhook UI — map `user_id`, `title`, `body` from the new row.)

## Flow

1. User enables push in **Profile** → browser subscription saved to `daybook_push_subscriptions`
2. Something creates a row in `daybook_notifications` (like/comment/message)
3. Webhook calls `send-push`
4. Function loads that user’s endpoints and POSTs to each push service
5. Service worker shows the notification; tap opens the app

## Notes

- Expired endpoints (HTTP 404/410) are deleted automatically
- Never put `VAPID_PRIVATE_KEY` in the frontend
- For maximum mobile reliability, also add FCM later for Android Chrome
