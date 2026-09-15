/** App Badging API — unread count on installed PWA icon */

export async function setAppBadge(count: number) {
  try {
    if (!('setAppBadge' in navigator)) return
    if (count > 0) {
      await (navigator as Navigator & { setAppBadge: (n?: number) => Promise<void> }).setAppBadge(
        count
      )
    } else {
      await clearAppBadge()
    }
  } catch {
    // unsupported or permission denied
  }
}

export async function clearAppBadge() {
  try {
    if ('clearAppBadge' in navigator) {
      await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge()
    }
  } catch {
    /* no-op */
  }
}
