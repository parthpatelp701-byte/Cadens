import { supabase } from './supabase'

/**
 * Ask the Edge Function to send a push to a user.
 * In production, prefer Database Webhooks on daybook_notifications INSERT
 * so the client never needs permission to notify other users.
 */
export async function requestPushToUser(params: {
  userId: string
  title: string
  body?: string
  url?: string
}) {
  const { data: session } = await supabase.auth.getSession()
  const token = session.session?.access_token
  if (!token) throw new Error('Not signed in')

  const base = import.meta.env.VITE_SUPABASE_URL
  const res = await fetch(`${base}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: params.userId,
      title: params.title,
      body: params.body || '',
      url: params.url || '/',
    }),
  })

  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Push failed')
  return json
}
