import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Calendar, CheckSquare, Flame, X } from 'lucide-react'
import { getStreak, listEntries } from '@/lib/journal'
import { listUpcoming } from '@/lib/calendar'
import { listTasks } from '@/lib/tasks'
import {
  shouldShowDailyRetentionPrompt,
  markDailyRetentionPromptShown,
  streakRiskMessage,
  scheduleJournalReminder,
} from '@/lib/retention'
import { format, parseISO, isToday } from 'date-fns'

/** Soft daily nudge — streak, due tasks, next Plan event */
export function RetentionNudge({ compact }: { compact?: boolean }) {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [streak, setStreak] = useState(0)
  const [dueCount, setDueCount] = useState(0)
  const [nextEvent, setNextEvent] = useState<string | null>(null)

  useEffect(() => {
    scheduleJournalReminder()
    if (!shouldShowDailyRetentionPrompt()) return

    let mounted = true
    ;(async () => {
      try {
        const [st, entries, upcoming, tasks] = await Promise.all([
          getStreak().catch(() => ({ current: 0, longest: 0, total_entries: 0 })),
          listEntries({ limit: 5 }).catch(() => []),
          listUpcoming(3).catch(() => []),
          listTasks('open').catch(() => []),
        ])
        if (!mounted) return
        const today = new Date().toISOString().slice(0, 10)
        const wroteToday = entries.some((e: { entry_date?: string }) => e.entry_date === today)
        const due = tasks.filter((t) => t.due_at && isToday(parseISO(t.due_at)))
        setDueCount(due.length)
        setStreak(st.current)
        if (upcoming[0]) {
          setNextEvent(
            `${upcoming[0].title} · ${format(parseISO(upcoming[0].starts_at), 'EEE h:mm a')}`
          )
        }
        const risk = streakRiskMessage(st.current, wroteToday)
        if (due.length > 0) {
          setMessage(
            due.length === 1
              ? `1 task due today: ${due[0].title}`
              : `${due.length} tasks due today`
          )
          setVisible(true)
        } else if (risk) {
          setMessage(risk)
          setVisible(true)
        } else if (upcoming[0] && !compact) {
          setMessage('You have something coming up on Plan.')
          setVisible(true)
        }
      } catch {
        /* optional modules */
      }
    })()
    return () => {
      mounted = false
    }
  }, [compact])

  if (!visible) return null

  return (
    <div className="relative rounded-2xl border border-[var(--color-acc)]/30 bg-gradient-to-r from-[var(--color-acc)]/10 to-transparent p-4">
      <button
        type="button"
        className="absolute top-2 right-2 p-1.5 rounded-lg text-[var(--color-mute)] hover:bg-[var(--color-s2)]"
        aria-label="Dismiss"
        onClick={() => {
          markDailyRetentionPromptShown()
          setVisible(false)
        }}
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
          <Flame size={20} className="text-orange-400" />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium leading-snug">{message}</p>
          {streak > 0 && (
            <p className="text-xs text-[var(--color-mute)]">{streak}-day journal streak</p>
          )}
          {nextEvent && (
            <p className="text-xs text-[var(--color-dim)] truncate">Next: {nextEvent}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {dueCount > 0 && (
              <Link
                to="/tasks"
                onClick={() => markDailyRetentionPromptShown()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-acc)] text-[var(--color-ink)] min-h-9"
              >
                <CheckSquare size={14} />
                Tasks
              </Link>
            )}
            <Link
              to="/journal"
              onClick={() => markDailyRetentionPromptShown()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-s2)] border border-[var(--color-line)] min-h-9"
            >
              <BookOpen size={14} />
              Journal
            </Link>
            <Link
              to="/calendar"
              onClick={() => markDailyRetentionPromptShown()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-s2)] border border-[var(--color-line)] min-h-9"
            >
              <Calendar size={14} />
              Plan
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
