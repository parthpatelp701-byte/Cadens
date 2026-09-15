/** Toggle body.is-offline for CSS banner + optional subscribers */
export function bindOnlineStatus() {
  if (typeof window === 'undefined') return () => {}

  const sync = () => {
    document.body.classList.toggle('is-offline', !navigator.onLine)
  }
  sync()
  window.addEventListener('online', sync)
  window.addEventListener('offline', sync)
  return () => {
    window.removeEventListener('online', sync)
    window.removeEventListener('offline', sync)
  }
}
