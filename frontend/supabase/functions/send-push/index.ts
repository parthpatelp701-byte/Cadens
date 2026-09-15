// Cadens Web Push sender (Supabase Edge Function — Deno)
//
// Deploy:
//   supabase functions deploy send-push --no-verify-jwt
//
// Secrets:
//   supabase secrets set VAPID_PUBLIC_KEY="..."
//   supabase secrets set VAPID_PRIVATE_KEY="..."
//   supabase secrets set VAPID_SUBJECT="mailto:you@example.com"
//
// Optional shared secret so only your webhook / backend can call it:
//   supabase secrets set PUSH_HOOK_SECRET="long-random-string"
//   Header: x-cadens-push-secret: long-random-string

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cadens-push-secret',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function b64UrlToBytes(input: string): Uint8Array {
  const pad = '='.repeat((4 - (input.length % 4)) % 4)
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Build a VAPID JWT (ES256) for the push service audience */
async function createVapidJwt(
  audience: string,
  subject: string,
  publicKeyB64Url: string,
  privateKeyB64Url: string,
): Promise<string> {
  const enc = new TextEncoder()
  const header = bytesToB64Url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const now = Math.floor(Date.now() / 1000)
  const payload = bytesToB64Url(
    enc.encode(
      JSON.stringify({
        aud: audience,
        exp: now + 12 * 60 * 60,
        sub: subject,
      }),
    ),
  )

  const pub = b64UrlToBytes(publicKeyB64Url)
  const priv = b64UrlToBytes(privateKeyB64Url)

  // Uncompressed public key: 0x04 || x(32) || y(32)
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error('VAPID public key must be uncompressed P-256 (65 bytes)')
  }

  const key = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: bytesToB64Url(pub.slice(1, 33)),
      y: bytesToB64Url(pub.slice(33, 65)),
      d: bytesToB64Url(priv),
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const data = enc.encode(`${header}.${payload}`)
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data)
  return `${header}.${payload}.${bytesToB64Url(signature)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const hookSecret = Deno.env.get('PUSH_HOOK_SECRET')
    if (hookSecret) {
      const provided = req.headers.get('x-cadens-push-secret')
      if (provided !== hookSecret) {
        return json({ error: 'Unauthorized' }, 401)
      }
    }

    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@cadens.app'
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return json({ error: 'VAPID keys not configured as function secrets' }, 500)
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: 'Supabase env missing' }, 500)
    }

    const body = await req.json()
    const userId = body.user_id as string | undefined
    const title = (body.title as string) || 'Cadens'
    const notifBody = (body.body as string) || ''
    const url = (body.url as string) || '/'

    if (!userId) return json({ error: 'user_id required' }, 400)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: subs, error } = await admin
      .from('daybook_push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (error) throw error
    if (!subs?.length) return json({ sent: 0, message: 'No subscriptions for user' })

    const payload = JSON.stringify({ title, body: notifBody, url })
    let sent = 0
    const removed: string[] = []
    const failures: { endpoint: string; status: number | string; detail?: string }[] = []

    for (const sub of subs) {
      try {
        const endpointUrl = new URL(sub.endpoint)
        const audience = `${endpointUrl.protocol}//${endpointUrl.host}`
        const jwt = await createVapidJwt(
          audience,
          VAPID_SUBJECT,
          VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY,
        )

        // Note: this sends an unsigned/unencrypted body with VAPID auth.
        // Chrome/Firefox accept this for many cases. For full RFC8291
        // encryption, swap in a dedicated web-push library build.
        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            TTL: '86400',
            'Content-Type': 'application/octet-stream',
            Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
            Urgency: 'normal',
          },
          body: payload,
        })

        if (res.status === 201 || res.status === 200) {
          sent++
        } else if (res.status === 404 || res.status === 410) {
          await admin.from('daybook_push_subscriptions').delete().eq('id', sub.id)
          removed.push(sub.endpoint)
        } else {
          failures.push({
            endpoint: sub.endpoint.slice(0, 48),
            status: res.status,
            detail: (await res.text()).slice(0, 200),
          })
        }
      } catch (e) {
        failures.push({ endpoint: sub.endpoint.slice(0, 48), status: 'error', detail: String(e) })
      }
    }

    return json({ sent, removed: removed.length, failures })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
