import { supabase } from './supabase'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export async function registerServiceWorker() {
  if (import.meta.env.VITE_ENABLE_PWA !== 'true' || !('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.register('/sw.js')
  return reg
}

export async function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!(await isPushSupported())) return 'unsupported'
  return Notification.permission
}

/**
 * Subscribe to push. Requires VITE_VAPID_PUBLIC_KEY in env.
 * Generate VAPID keys once (e.g. npx web-push generate-vapid-keys)
 * and store the private key only on a server/Edge function for sending.
 */
export async function subscribeToPush() {
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    throw new Error('VITE_VAPID_PUBLIC_KEY is not set')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission denied')
  }

  const reg = await registerServiceWorker()
  if (!reg) throw new Error('Service worker not available')

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }

  const json = sub.toJSON()
  await supabase.rpc('daybook_push_subscribe', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: navigator.userAgent,
  })

  return sub
}

export async function unsubscribeFromPush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    await supabase.rpc('daybook_push_unsubscribe', { p_endpoint: endpoint })
  }
}
