/** Register service worker (production / HTTPS / localhost). */
export function registerServiceWorker() {
  if (import.meta.env.DEV || import.meta.env.VITE_ENABLE_PWA !== 'true') return
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  const isLocal =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname === '[::1]'

  // Allow local + secure contexts
  if (!window.isSecureContext && !isLocal) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing
          if (!worker) return
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version ready — activate on next load; optional UX toast later
              console.info('[Cadens] App update available')
            }
          })
        })
      })
      .catch((err) => {
        console.warn('[Cadens] SW registration failed', err)
      })
  })
}
