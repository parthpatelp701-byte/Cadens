import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckSquare, Calendar, BookOpen, ChevronRight } from 'lucide-react'
import { listTasks, type Task } from '@/lib/tasks'
import { listUpcoming, type CalendarEvent } from '@/lib/calendar'
import { getStreak, listEntries } from '@/lib/journal'
import { format, parseISO, isToday } from 'date-fns'

/** Phase 3 — Today strip: due tasks, next Plan event, journal status */
export function TodayStrip() {
  const [dueTasks, setDueTasks] = useState<Task[]>([])
  const [nextEvent, setNextEvent] = useState<CalendarEvent | null>(null)
  const [streak, setStreak] = useState(0)
  const [wroteToday, setWroteToday] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [tasks, upcoming, streakData, entries] = await Promise.all([
          listTasks('open').catch(() => [] as Task[]),
          listUpcoming(3).catch(() => [] as CalendarEvent[]),
          getStreak().catch(() => ({ current: 0, longest: 0, total_entries: 0 })),
          listEntries({ limit: 5 }).catch(() => []),
        ])
        if (!mounted) return
        const due = tasks.filter((t) => {
          if (!t.due_at) return false
          try {
            return isToday(parseISO(t.due_at))
          } catch {
            return false
          }
        })
        setDueTasks(due.slice(0, 3))
        setNextEvent(upcoming[0] || null)
        setStreak(streakData.current || 0)
        const day = new Date().toISOString().slice(0, 10)
        setWroteToday(entries.some((e: { entry_date?: string }) => e.entry_date === day))
      } catch {
        /* optional */
      } finally {
        if (mounted) setReady(true)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  if (!ready) return null
  if (dueTasks.length === 0 && !nextEvent && wroteToday && streak === 0) return null

  return (
    <section
      className="rounded-2xl border border-[var(--color-line2)] bg-[var(--color-s1)] overflow-hidden"
      aria-label="Today"
    >
      <div className="px-3.5 py-2 border-b border-[var(--color-line2)] flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-mute)]">
          Today
        </span>
        <span className="text-[11px] text-[var(--color-mute)]">
          {format(new Date(), 'EEE · MMM d')}
        </span>
      </div>
      <ul className="divide-y divide-[var(--color-line2)]">
        {dueTasks.map((t) => (
          <li key={t.id}>
            <Link
              to="/tasks"
              className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-[var(--color-s2)] min-h-11"
            >
              <CheckSquare size={16} className="text-[var(--color-acc)] shrink-0" />
              <span className="flex-1 text-sm font-medium truncate">{t.title}</span>
              <span className="text-[11px] text-[var(--color-mute)] shrink-0">
                {t.all_day
                  ? 'All day'
                  : t.due_at
                    ? format(parseISO(t.due_at), 'h:mm a')
                    : ''}
              </span>
            </Link>
          </li>
        ))}
        {nextEvent && (
          <li>
            <Link
              to="/calendar"
              className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-[var(--color-s2)] min-h-11"
            >
              <Calendar size={16} className="text-[var(--color-acc2)] shrink-0" />
              <span className="flex-1 text-sm font-medium truncate">{nextEvent.title}</span>
              <span className="text-[11px] text-[var(--color-mute)] shrink-0">
                {format(parseISO(nextEvent.starts_at), 'h:mm a')}
              </span>
            </Link>
          </li>
        )}
        <li>
          <Link
            to="/journal"
            className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-[var(--color-s2)] min-h-11"
          >
            <BookOpen size={16} className="text-[var(--color-acc3)] shrink-0" />
            <span className="flex-1 text-sm font-medium truncate">
              {wroteToday
                ? streak > 0
                  ? `Journal · ${streak}-day streak`
                  : 'Journal · done today'
                : streak > 0
                  ? `Keep your ${streak}-day streak`
                  : 'Write today’s journal'}
            </span>
            <ChevronRight size={14} className="text-[var(--color-mute)]" />
          </Link>
        </li>
      </ul>
    </section>
  )
}
