import { pacificDay, pacificInput, pacificTime } from './time'
let journalTimer: ReturnType<typeof setTimeout> | undefined
const eventTimers = new Map<string, ReturnType<typeof setTimeout>>()
export function clearLocalReminders() {
  clearTimeout(journalTimer); journalTimer=undefined
  for (const timer of eventTimers.values()) clearTimeout(timer)
  eventTimers.clear()
}
/**
 * Retention helpers — habit loops for Journal + Calendar (Plan).
 * Local-first reminders; streak risk; once-per-day prompts.
 */

const REMINDER_KEY = 'cadens-journal-reminder'
const LAST_PROMPT_KEY = 'cadens-retention-prompt-day'
const CHECKIN_KEY = 'cadens-last-checkin-day'

export interface JournalReminder {
  enabled: boolean
  /** Local time HH:mm */
  time: string
}

export function getJournalReminder(): JournalReminder {
  try {
    const raw = localStorage.getItem(REMINDER_KEY)
    if (raw) return JSON.parse(raw) as JournalReminder
  } catch {
    /* ignore */
  }
  return { enabled: false, time: '20:00' }
}

export function setJournalReminder(prefs: JournalReminder) {
  localStorage.setItem(REMINDER_KEY, JSON.stringify(prefs))
  scheduleJournalReminder(prefs)
}

function todayKey() {
  return pacificDay()
}

export function markCheckinToday() {
  try {
    localStorage.setItem(CHECKIN_KEY, todayKey())
  } catch {
    /* ignore */
  }
}

export function checkedInToday(): boolean {
  try {
    return localStorage.getItem(CHECKIN_KEY) === todayKey()
  } catch {
    return false
  }
}

/** Show soft retention card at most once per day */
export function shouldShowDailyRetentionPrompt(): boolean {
  try {
    const last = localStorage.getItem(LAST_PROMPT_KEY)
    return last !== todayKey()
  } catch {
    return true
  }
}

export function markDailyRetentionPromptShown() {
  try {
    localStorage.setItem(LAST_PROMPT_KEY, todayKey())
  } catch {
    /* ignore */
  }
}

/**
 * Schedule a one-shot browser notification near the preferred local time.
 * Re-run on app load. Requires Notification permission.
 */
export function scheduleJournalReminder(prefs: JournalReminder = getJournalReminder()) {
  clearTimeout(journalTimer)
  if (!prefs.enabled) return
  if (typeof window === 'undefined' || !('Notification' in window)) return

  const fire = () => {
    if (Notification.permission !== 'granted') return
    if (checkedInToday()) return
    try {
      new Notification('Cadens Journal', {
        body: 'Keep your streak — a few lines is enough.',
        icon: '/cadens-icon-192.png',
        tag: 'cadens-journal-reminder',
      })
    } catch {
      /* ignore */
    }
  }

  const now = new Date()
  const target = pacificInput(pacificDay(), prefs.time)
  if (target.getTime() <= now.getTime()) {
    // Missed today's slot — don't spam; wait until tomorrow load
    return
  }
  const delay = target.getTime() - now.getTime()
  journalTimer = setTimeout(fire, Math.min(delay, 2147483647))
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const res = await Notification.requestPermission()
  return res === 'granted'
}

export function streakRiskMessage(currentStreak: number, wroteToday: boolean): string | null {
  if (wroteToday) return null
  if (currentStreak <= 0) {
    return 'Start a 1-day streak with a 2-minute journal entry.'
  }
  if (currentStreak === 1) {
    return 'You started a streak yesterday — write today to make it 2.'
  }
  return `Don’t break your ${currentStreak}-day streak — open Journal when you’re ready.`
}

/** Milestone celebrations (local, once each) */
const MILESTONES_KEY = 'cadens-streak-milestones'

export function celebrateStreakIfNeeded(current: number): string | null {
  const milestones = [3, 7, 14, 30, 60, 100]
  if (!milestones.includes(current)) return null
  try {
    const raw = localStorage.getItem(MILESTONES_KEY)
    const seen: number[] = raw ? JSON.parse(raw) : []
    if (seen.includes(current)) return null
    seen.push(current)
    localStorage.setItem(MILESTONES_KEY, JSON.stringify(seen))
  } catch {
    /* still show once per session */
  }
  if (current === 3) return '3-day streak — the habit is forming.'
  if (current === 7) return '7-day streak — a full week of reflection.'
  if (current === 14) return '2-week streak. That’s real consistency.'
  if (current === 30) return '30 days. You’re building a life log.'
  return `${current}-day streak. Keep going.`
}

export async function fetchJournalTodayStatus(): Promise<{
  wrote_today: boolean
  entries_today: number
  current_streak: number
  longest_streak: number
}> {
  const { supabase } = await import('@/lib/supabase')
  const { data, error } = await supabase.rpc('journal_today_status')
  if (error || !data) {
    return { wrote_today: false, entries_today: 0, current_streak: 0, longest_streak: 0 }
  }
  return data as {
    wrote_today: boolean
    entries_today: number
    current_streak: number
    longest_streak: number
  }
}

/** Build a "Reflect on today" journal body from today's calendar events */
export function buildReflectBody(
  events: { title: string; starts_at: string; all_day?: boolean }[],
  prompt: string
): string {
  const lines = ['## Reflect on today', '', prompt, '']
  if (events.length) {
    lines.push('### What was on the calendar')
    for (const ev of events) {
      const t = new Date(ev.starts_at)
      const when = ev.all_day
        ? 'All day'
        : pacificTime(t)
      lines.push(`- ${when}: ${ev.title}`)
    }
    lines.push('')
  }
  lines.push('### How it went', '')
  return lines.join('\n')
}

/** Schedule local notifications for upcoming events (next 24h) */
export function scheduleEventReminders(
  events: { id: string; title: string; starts_at: string }[]
) {
  for (const timer of eventTimers.values()) clearTimeout(timer)
  eventTimers.clear()
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  const now = Date.now()
  for (const ev of events) {
    const start = new Date(ev.starts_at).getTime()
    const remindAt = start - 15 * 60 * 1000 // 15 min before
    if (remindAt <= now || start > now + 24 * 3600 * 1000) continue
    const delay = remindAt - now
    eventTimers.set(ev.id, setTimeout(() => {
      eventTimers.delete(ev.id)
      try {
        new Notification(ev.title, {
          body: 'Starts in 15 minutes',
          tag: `cadens-event-${ev.id}`,
          icon: '/cadens-icon-192.png',
        })
      } catch {
        /* ignore */
      }
    }, Math.min(delay, 2147483647)))
  }
}
