/* Cadens service worker — offline shell, static cache, push */
const VERSION = 'cadens-v3'
const PRECACHE = `${VERSION}-shell`
const RUNTIME = `${VERSION}-runtime`

const SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/cadens-icon-192.png',
  '/cadens-icon-512.png',
]

function isApiRequest(url) {
  return (
    url.pathname.includes('/rest/v1') ||
    url.pathname.includes('/auth/v1') ||
    url.pathname.includes('/functions/v1') ||
    url.pathname.includes('/realtime/v1') ||
    url.hostname.includes('supabase')
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== PRECACHE && k !== RUNTIME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Never cache API / auth / realtime
  if (isApiRequest(url)) return

  // Cross-origin (fonts, etc.): network only
  if (url.origin !== self.location.origin) return

  // Navigations: network-first → offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(RUNTIME).then((c) => c.put('/index.html', copy)).catch(() => {})
          return res
        })
        .catch(async () => {
          const offline = await caches.match('/offline.html')
          return offline || caches.match('/index.html') || Response.error()
        })
    )
    return
  }

  // Same-origin static: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetching = fetch(request)
        .then((res) => {
          if (res && res.ok && (url.pathname.startsWith('/assets/') || url.pathname.match(/\.(js|css|png|svg|webp|woff2?)$/))) {
            const copy = res.clone()
            caches.open(RUNTIME).then((c) => c.put(request, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => cached)
      return cached || fetching
    })
  )
})

self.addEventListener('push', (event) => {
  let data = { title: 'Cadens', body: 'Something new happened', url: '/' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/cadens-icon-192.png',
      badge: '/cadens-icon-192.png',
      data: { url: data.url || '/' },
      vibrate: [100, 50, 100],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})
