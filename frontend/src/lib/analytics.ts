/**
 * Lightweight analytics for PRD success metrics.
 * Events are buffered to localStorage and console in dev;
 * swap `send` for your provider (PostHog, Plausible, etc.) later.
 */

export type AnalyticsEvent =
  | 'save_created'
  | 'save_search'
  | 'progress_posted'
  | 'board_created'
  | 'idea_added'
  | 'board_decided'
  | 'app_installed'
  | 'share_target_used'

interface EventPayload {
  event: AnalyticsEvent
  props?: Record<string, string | number | boolean | null | undefined>
  ts: string
}

const KEY = 'cadens-analytics-buffer'
const MAX = 200

function buffer(entry: EventPayload) {
  try {
    const raw = localStorage.getItem(KEY)
    const list: EventPayload[] = raw ? JSON.parse(raw) : []
    list.push(entry)
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)))
  } catch {
    // ignore quota / private mode
  }
}

function send(entry: EventPayload) {
  // Dev visibility
  if (import.meta.env.DEV) {
    console.info('[analytics]', entry.event, entry.props || {})
  }
  // Optional: window.gtag / posthog / custom endpoint
  const w = window as unknown as { cadensAnalytics?: (e: EventPayload) => void }
  if (typeof w.cadensAnalytics === 'function') {
    try {
      w.cadensAnalytics(entry)
    } catch {
      /* no-op */
    }
  }
}

export function track(
  event: AnalyticsEvent,
  props?: Record<string, string | number | boolean | null | undefined>
) {
  const entry: EventPayload = {
    event,
    props,
    ts: new Date().toISOString(),
  }
  buffer(entry)
  send(entry)
}

export function getAnalyticsBuffer(): EventPayload[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
