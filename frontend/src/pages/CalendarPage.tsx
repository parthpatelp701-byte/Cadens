import { CalendarCreate } from '@/components/CalendarCreate'
import { TZDate } from '@date-fns/tz'
import { TIME_ZONE, pacificInput, pacificNow } from '@/lib/time'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Calendar as CalIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Clock,
  MapPin,
  BookOpen,
  Filter,
  Inbox,
  Check,
  Ban,
  HelpCircle,
} from 'lucide-react'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  startOfDay,
  endOfDay,
  isToday,
  isTomorrow,
} from 'date-fns'
import {
  listEventsInRange,
  listUpcoming,
  createEvent,
  updateEvent,
  deleteEvent,
  parseQuickEvent,
  listCalendars,
  expandRecurringEvents,
  type CalendarEvent,
  type Calendar,
} from '@/lib/calendar'
import { scheduleEventReminders } from '@/lib/retention'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { clsx } from 'clsx'
import { Link, useNavigate } from 'react-router-dom'

const parseISO = (value: string) => /Z$|[+-]\d{2}:?\d{2}$/.test(value) ? new TZDate(value, TIME_ZONE) : pacificInput(value.slice(0,10), value.slice(11,16) || '00:00')

type ViewMode = 'month' | 'week' | 'day'

const CATEGORY_META: Record<
  string,
  { label: string; color: string; kind: Calendar['kind'] }
> = {
  work: { label: 'Work', color: 'var(--color-acc)', kind: 'work' },
  personal: { label: 'Personal', color: 'var(--color-acc)', kind: 'personal' },
  focus: { label: 'Focus', color: 'var(--color-acc)', kind: 'focus' },
  group: { label: 'Group', color: 'var(--color-acc)', kind: 'group' },
}

function eventColor(_ev: CalendarEvent, _calendars: Calendar[]): string {
  // Presentation follows the brand. Stored calendar colors remain untouched.
  return 'var(--color-acc)'
}

function dayLabel(d: Date): string {
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'EEE, MMM d')
}

export function CalendarPage() {
  const navigate = useNavigate()
  const [anchor, setAnchor] = useState<Date>(() => pacificNow())
  const [view, setView] = useState<ViewMode>('month')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [series, setSeries] = useState<CalendarEvent[]>([])
  const [upcoming, setUpcoming] = useState<CalendarEvent[]>([])
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quick, setQuick] = useState('')
  const [saving, setSaving] = useState(false)

  // Filters: which calendar kinds are visible
  const [visibleKinds, setVisibleKinds] = useState<Set<Calendar['kind']>>(
    () => new Set(['personal', 'work', 'group', 'focus'])
  )

  // Composer / details
  const [composer, setComposer] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState(() => format(pacificNow(), 'yyyy-MM-dd'))
  const [formEndDate, setFormEndDate] = useState(() => format(pacificNow(), 'yyyy-MM-dd'))
  const [formTime, setFormTime] = useState('09:00')
  const [formEndTime, setFormEndTime] = useState('10:00')
  const [formAllDay, setFormAllDay] = useState(false)
  const [formNotes, setFormNotes] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formRecur, setFormRecur] = useState<'none' | 'daily' | 'weekly'>('none')
  const [formCalendarId, setFormCalendarId] = useState<string | undefined>()

  // Mobile left panel drawer
  const [leftOpen, setLeftOpen] = useState(false)

  const range = useMemo(() => {
    if (view === 'week') {
      const from = startOfWeek(anchor)
      return { from, to: endOfWeek(anchor) }
    }
    if (view === 'day') {
      return { from: startOfDay(anchor), to: endOfDay(anchor) }
    }
    const from = startOfWeek(startOfMonth(anchor))
    const to = endOfWeek(endOfMonth(anchor))
    return { from, to }
  }, [anchor, view])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [ev, cals, up] = await Promise.all([
        listEventsInRange(range.from, range.to),
        listCalendars(),
        listUpcoming(14),
      ])
      const expanded = expandRecurringEvents(ev, range.from, range.to)
      setSeries(ev)
      setEvents(expanded)
      setUpcoming(up)
      scheduleEventReminders(up)
      setCalendars(cals)
      if (!formCalendarId && cals.length) {
        const def = cals.find((c) => c.is_default) || cals[0]
        setFormCalendarId(def.id)
      }
    } catch (e: any) {
      setError(e.message || 'Could not load your calendar. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [range.from.getTime(), range.to.getTime(), formCalendarId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const cal = calendars.find((c) => c.id === ev.calendar_id)
      const kind = cal?.kind || 'personal'
      return visibleKinds.has(kind)
    })
  }, [events, calendars, visibleKinds])

  const filteredUpcoming = useMemo(() => {
    return upcoming.filter((ev) => {
      const cal = calendars.find((c) => c.id === ev.calendar_id)
      const kind = cal?.kind || 'personal'
      return visibleKinds.has(kind)
    })
  }, [upcoming, calendars, visibleKinds])

  // Group upcoming by day
  const upcomingByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of filteredUpcoming) {
      const key = format(parseISO(ev.starts_at), 'yyyy-MM-dd')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredUpcoming])

  function toggleKind(kind: Calendar['kind']) {
    setVisibleKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  function openCreate(day?: Date) {
    setEditing(null)
    const d = day || anchor
    setFormDate(format(d, 'yyyy-MM-dd'))
    setFormEndDate(format(d, 'yyyy-MM-dd'))
    setFormTime('09:00')
    setFormEndTime('10:00')
    setFormAllDay(false)
    setFormTitle('')
    setFormNotes('')
    setFormLocation('')
    setFormRecur('none')
    setComposer(true)
  }

  function openEdit(ev: CalendarEvent) {
    if (ev.task_id) { navigate('/tasks'); return }
    if (ev.legacy_id) { window.location.assign('/app.html?mode=calendar'); return }
    if (ev.series_id) {
      const master = series.find(item => item.id === ev.series_id)
      if (!master) { setError('Reload the calendar to edit this series.'); return }
      ev = master
    }
    setEditing(ev)
    const start = parseISO(ev.starts_at)
    setFormTitle(ev.title)
    setFormDate(format(start, 'yyyy-MM-dd'))
    setFormTime(format(start, 'HH:mm'))
    if (ev.ends_at) {
      const end = parseISO(ev.ends_at)
      if (ev.all_day) end.setMilliseconds(end.getMilliseconds() - 1)
      setFormEndDate(format(end, 'yyyy-MM-dd'))
      setFormEndTime(format(end, 'HH:mm'))
    } else {
      setFormEndDate(format(start, 'yyyy-MM-dd'))
      setFormEndTime('10:00')
    }
    setFormAllDay(ev.all_day)
    setFormNotes(ev.notes || '')
    setFormLocation(ev.location_label || '')
    setFormRecur(ev.recur_rule || 'none')
    setFormCalendarId(ev.calendar_id)
    setComposer(true)
  }

  async function handleQuickAdd(e?: React.FormEvent) {
    e?.preventDefault()
    if (!quick.trim()) return
    setSaving(true)
    setError('')
    try {
      const parsed = parseQuickEvent(quick)
      await createEvent({
        title: parsed.title,
        startsAt: parsed.startsAt,
        allDay: parsed.allDay,
        calendarId: formCalendarId,
      })
      setQuick('')
      await refresh()
    } catch (err: any) {
      setError(err.message || 'Could not create event')
    } finally {
      setSaving(false)
    }
  }

  async function handleFormSave() {
    if (!formTitle.trim()) return
    setSaving(true)
    setError('')
    try {
      const starts = formAllDay
        ? pacificInput(formDate)
        : pacificInput(formDate, formTime)
      const ends = formAllDay
        ? addDays(pacificInput(formEndDate), 1)
        : pacificInput(formEndDate, formEndTime)

      if (ends <= starts) throw new Error('End time must be after start time.')
      if (editing) {
        if (!editing.updated_at) throw new Error('Reload the calendar before editing this event.')
        await updateEvent({
          id: editing.id,
          updatedAt: editing.updated_at,
          title: formTitle.trim(),
          notes: formNotes || null,
          startsAt: starts,
          endsAt: ends,
          allDay: formAllDay,
          location: formLocation || null,
          calendarId: formCalendarId || editing.calendar_id,
          recurRule: formRecur === 'none' ? null : formRecur,
        })
      } else {
        await createEvent({
          title: formTitle.trim(),
          startsAt: starts,
          endsAt: ends,
          allDay: formAllDay,
          notes: formNotes || undefined,
          location: formLocation || undefined,
          calendarId: formCalendarId,
          recurRule: formRecur === 'none' ? undefined : formRecur,
        })
      }
      setComposer(false)
      setEditing(null)
      setFormTitle('')
      setFormNotes('')
      setFormLocation('')
      setFormRecur('none')
      await refresh()
    } catch (err: any) {
      setError(err.message || 'Could not save event')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing || editing.id.includes('_')) return
    if (!confirm('Delete this event?')) return
    setSaving(true)
    try {
      await deleteEvent(editing.id)
      setComposer(false)
      setEditing(null)
      await refresh()
    } catch (err: any) {
      setError(err.message || 'Could not delete')
    } finally {
      setSaving(false)
    }
  }

  function jumpToDate(d: Date) {
    setAnchor(d)
    setLeftOpen(false)
  }

  function jumpToEvent(ev: CalendarEvent) {
    const d = parseISO(ev.starts_at)
    setAnchor(d)
    setView('day')
    setLeftOpen(false)
    // brief highlight could be added via CSS class
  }

  const monthCells = useMemo(() => {
    const start = startOfWeek(startOfMonth(anchor))
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [anchor])

  const weekDays = useMemo(() => {
    const start = startOfWeek(anchor)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [anchor])

  function eventsOn(day: Date) {
    const from = startOfDay(day), to = addDays(from, 1)
    return filteredEvents.filter(ev => {
      const start = parseISO(ev.starts_at), end = ev.ends_at ? parseISO(ev.ends_at) : start
      return start < to && (end > start ? end > from : start >= from)
    })
  }

  // Mini calendar for left panel
  const miniMonth = useMemo(() => {
    const start = startOfWeek(startOfMonth(anchor))
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [anchor])

  return (
    <div className="space-y-4 page-enter">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.65rem] font-bold tracking-tight flex items-center gap-2 text-balance">
            <CalIcon size={24} className="text-[var(--color-acc)] shrink-0" aria-hidden />
            Plan
          </h1>
          <p className="text-sm text-[var(--color-dim)] mt-1 text-pretty">
            Dashboard · month / week / day · filters · quick jumps
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setLeftOpen(true)}
            className="lg:hidden inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full bg-[var(--color-s2)] border border-[var(--color-line2)] text-sm font-semibold"
            aria-label="Open sidebar"
          >
            <Inbox size={16} aria-hidden />
            Lists
          </button>
          <button
            type="button"
            onClick={() => openCreate()}
            className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] border-2 border-[var(--color-ink)] text-sm font-bold shadow-[4px_4px_0_var(--color-ink)]"
          >
            <Plus size={18} aria-hidden /> Event
          </button>
        </div>
      </header>

      {/* Quick add */}
      <form onSubmit={handleQuickAdd} className="flex gap-2 items-center">
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder='Quick add — e.g. "Team sync tomorrow 3pm"'
          aria-label="Quick add event"
          className="field flex-1 !rounded-full"
        />
        <Button type="submit" disabled={saving || !quick.trim()}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : 'Add'}
        </Button>
      </form>

      {/* Links + category filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/tasks"
          className="inline-flex items-center gap-2 min-h-9 px-3 py-2 rounded-full text-xs font-semibold bg-[var(--color-s2)] border border-[var(--color-line2)] hover:border-[var(--color-line)]"
        >
          Tasks
        </Link>
        <Link
          to="/journal"
          className="inline-flex items-center gap-2 min-h-9 px-3 py-2 rounded-full text-xs font-semibold bg-[var(--color-s2)] border border-[var(--color-line2)] hover:border-[var(--color-line)]"
        >
          <BookOpen size={14} className="text-[var(--color-acc)]" aria-hidden />
          Journal today
        </Link>

        <div className="flex flex-wrap gap-1.5 ml-auto" role="group" aria-label="Category filters">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-mute)] mr-1">
            <Filter size={12} aria-hidden /> Filters
          </span>
          {(Object.keys(CATEGORY_META) as Array<keyof typeof CATEGORY_META>).map((key) => {
            const meta = CATEGORY_META[key]
            const on = visibleKinds.has(meta.kind)
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleKind(meta.kind)}
                aria-pressed={on}
                className={clsx(
                  'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-opacity',
                  on
                    ? 'border-[var(--color-line)] bg-[var(--color-s2)]'
                    : 'border-transparent opacity-40 line-through'
                )}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: meta.color }}
                  aria-hidden
                />
                {meta.label}
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/10 px-3 py-2 rounded-xl">
          {error}
        </div>
      )}

      {/* Two-column dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* LEFT PANEL — desktop always visible; mobile as drawer */}
        <aside
          className={clsx(
            'space-y-4 lg:col-span-1',
            // mobile drawer
            'fixed inset-y-0 left-0 z-[90] w-[min(100%,20rem)] bg-[var(--color-s1)] border-r border-[var(--color-line)] p-4 overflow-y-auto transition-transform lg:static lg:translate-x-0 lg:p-0 lg:border-0 lg:bg-transparent lg:overflow-visible',
            leftOpen ? 'translate-x-0' : '-translate-x-full'
          )}
          aria-label="Calendar sidebar"
        >
          <div className="flex items-center justify-between lg:hidden mb-2">
            <span className="font-bold text-sm">Sidebar</span>
            <button
              type="button"
              onClick={() => setLeftOpen(false)}
              className="p-2 rounded-xl hover:bg-[var(--color-s2)]"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          </div>

          <CalendarCreate onCreated={refresh}/>
          {/* Mini month calendar */}
          <Card className="!p-3 space-y-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-[var(--color-s2)]"
                onClick={() => setAnchor((d) => addMonths(d, -1))}
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold">{format(anchor, 'MMM yyyy')}</span>
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-[var(--color-s2)]"
                onClick={() => setAnchor((d) => addMonths(d, 1))}
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-7 text-[9px] font-bold uppercase tracking-wide text-[var(--color-mute)] text-center">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="py-0.5">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {miniMonth.map((day) => {
                const inMonth = isSameMonth(day, anchor)
                const selected = isSameDay(day, anchor)
                const today = isSameDay(day, pacificNow())
                const hasEv = filteredEvents.some((ev) =>
                  isSameDay(parseISO(ev.starts_at), day)
                )
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => jumpToDate(day)}
                    className={clsx(
                      'aspect-square text-[11px] font-semibold rounded-lg flex items-center justify-center relative',
                      !inMonth && 'opacity-30',
                      selected && 'bg-[var(--color-acc)] text-[var(--color-ink)]',
                      !selected && today && 'ring-1 ring-[var(--color-acc)]',
                      !selected && 'hover:bg-[var(--color-s2)]'
                    )}
                    aria-label={format(day, 'MMMM d, yyyy')}
                    aria-current={selected ? 'date' : undefined}
                  >
                    {format(day, 'd')}
                    {hasEv && !selected && (
                      <span
                        className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-acc)]"
                        aria-hidden
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Upcoming events */}
          <Card className="!p-3 space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--color-mute)]">
              Upcoming
            </h2>
            {upcomingByDay.length === 0 ? (
              <p className="text-xs text-[var(--color-mute)] py-2">No events in the next 2 weeks</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {upcomingByDay.map(([dateKey, dayEvs]) => (
                  <div key={dateKey}>
                    <div className="text-[10px] font-bold text-[var(--color-dim)] mb-1">
                      {dayLabel(parseISO(dateKey + 'T12:00:00'))}
                    </div>
                    <ul className="space-y-1">
                      {dayEvs.map((ev) => (
                        <li key={ev.id}>
                          <button
                            type="button"
                            onClick={() => jumpToEvent(ev)}
                            className="w-full text-left flex items-start gap-2 p-1.5 rounded-lg hover:bg-[var(--color-s2)] group"
                          >
                            <span
                              className="w-1 self-stretch rounded-full shrink-0 min-h-[1.25rem] mt-0.5"
                              style={{ background: eventColor(ev, calendars) }}
                              aria-hidden
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold truncate group-hover:text-[var(--color-acc)]">
                                {ev.title}
                              </div>
                              <div className="text-[10px] text-[var(--color-mute)]">
                                {ev.all_day
                                  ? 'All day'
                                  : format(parseISO(ev.starts_at), 'h:mm a')}
                              </div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Meeting invitations / tentative — placeholder using notes heuristic or empty state */}
          <Card className="!p-3 space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--color-mute)] flex items-center gap-1.5">
              <Inbox size={12} aria-hidden />
              Invitations
            </h2>
            <p className="text-xs text-[var(--color-mute)] py-1">
              No pending invitations. Accept/decline actions will appear here when RSVP support is enabled.
            </p>
            {/* Example action row for future RSVP */}
            <div className="hidden flex gap-1 pt-1">
              <button
                type="button"
                className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg bg-emerald-500/15 text-emerald-600"
              >
                <Check size={12} /> Accept
              </button>
              <button
                type="button"
                className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg bg-amber-500/15 text-amber-600"
              >
                <HelpCircle size={12} /> Maybe
              </button>
              <button
                type="button"
                className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg bg-rose-500/15 text-rose-600"
              >
                <Ban size={12} /> Decline
              </button>
            </div>
          </Card>
        </aside>

        {/* Mobile drawer backdrop */}
        {leftOpen && (
          <div
            className="fixed inset-0 z-[80] bg-black/50 lg:hidden"
            onClick={() => setLeftOpen(false)}
            aria-hidden
          />
        )}

        {/* RIGHT — main calendar */}
        <main className="lg:col-span-3 space-y-3 min-w-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex gap-1 p-1 rounded-full bg-[var(--color-s2)] border border-[var(--color-line2)]"
              role="tablist"
              aria-label="Calendar view"
            >
              {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={clsx(
                    'px-3.5 py-1.5 rounded-full text-xs font-bold capitalize min-h-9 transition-colors',
                    view === v
                      ? 'bg-[var(--color-acc)] text-[var(--color-ink)]'
                      : 'text-[var(--color-dim)] hover:text-[var(--color-txt)]'
                  )}
                  role="tab"
                  aria-selected={view === v}
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--color-s2)] border border-[var(--color-line2)] hover:border-[var(--color-line)] min-h-9"
                onClick={() => setAnchor(pacificNow())}
              >
                Today
              </button>
              <button
                type="button"
                className="p-2 rounded-xl hover:bg-[var(--color-s2)] min-h-9 min-w-9"
                onClick={() =>
                  setAnchor((d) =>
                    view === 'month'
                      ? addMonths(d, -1)
                      : view === 'week'
                        ? addDays(d, -7)
                        : addDays(d, -1)
                  )
                }
                aria-label="Previous"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="px-2 text-sm font-semibold min-w-[8rem] text-center">
                {view === 'month'
                  ? format(anchor, 'MMMM yyyy')
                  : view === 'week'
                    ? `${format(startOfWeek(anchor), 'MMM d')} – ${format(endOfWeek(anchor), 'MMM d')}`
                    : format(anchor, 'EEE, MMM d')}
              </span>
              <button
                type="button"
                className="p-2 rounded-xl hover:bg-[var(--color-s2)] min-h-9 min-w-9"
                onClick={() =>
                  setAnchor((d) =>
                    view === 'month'
                      ? addMonths(d, 1)
                      : view === 'week'
                        ? addDays(d, 7)
                        : addDays(d, 1)
                  )
                }
                aria-label="Next"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Calendar grids */}
          {loading ? (
            <div className="h-72 rounded-2xl bg-[var(--color-s2)] animate-pulse" />
          ) : view === 'month' ? (
            <div className="rounded-2xl border border-[var(--color-line)] overflow-hidden bg-[var(--color-s1)]">
              <div className="grid grid-cols-7 text-[10px] font-bold uppercase tracking-wide text-[var(--color-mute)] border-b border-[var(--color-line2)]">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="px-1 py-2 text-center">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthCells.map((day) => {
                  const dayEvents = eventsOn(day)
                  const inMonth = isSameMonth(day, anchor)
                  const today = isSameDay(day, pacificNow())
                  return (
                    <div
                      key={day.toISOString()}
                      className={clsx(
                        'min-h-[5.5rem] p-1 border-t border-r border-[var(--color-line2)] text-left align-top',
                        !inMonth && 'opacity-40 bg-[var(--color-s2)]/30'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => openCreate(day)}
                        className="w-full text-left"
                        aria-label={`Add event on ${format(day, 'MMMM d')}`}
                      >
                        <div
                          className={clsx(
                            'text-[11px] font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-0.5',
                            today && 'bg-[var(--color-acc)] text-[var(--color-ink)]'
                          )}
                        >
                          {format(day, 'd')}
                        </div>
                      </button>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => openEdit(ev)}
                            className="w-full text-left text-[9px] leading-tight truncate rounded px-1 py-0.5 font-medium hover:ring-1 hover:ring-[var(--color-line)]"
                            style={{
                              background: 'color-mix(in srgb, var(--color-acc) 16%, var(--color-s1))',
                              color: 'var(--color-txt)',
                              borderLeft: `2px solid ${eventColor(ev, calendars)}`,
                            }}
                            title={ev.title}
                          >
                            {!ev.all_day && (
                              <span className="opacity-70 mr-0.5">
                                {format(parseISO(ev.starts_at), 'h:mma')}
                              </span>
                            )}
                            {ev.title}
                          </button>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[9px] text-[var(--color-mute)] px-0.5">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : view === 'week' ? (
            <div className="space-y-2">
              {weekDays.map((day) => {
                const dayEvents = eventsOn(day)
                return (
                  <Card key={day.toISOString()} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={clsx(
                          'text-sm font-semibold',
                          isSameDay(day, pacificNow()) && 'text-[var(--color-acc)]'
                        )}
                      >
                        {format(day, 'EEE, MMM d')}
                      </span>
                      <button
                        type="button"
                        className="text-xs text-[var(--color-acc)] font-semibold min-h-9 px-2"
                        onClick={() => openCreate(day)}
                      >
                        + Add
                      </button>
                    </div>
                    {dayEvents.length === 0 ? (
                      <p className="text-xs text-[var(--color-mute)]">No events</p>
                    ) : (
                      dayEvents.map((ev) => (
                        <EventRow
                          key={ev.id}
                          event={ev}
                          color={eventColor(ev, calendars)}
                          onOpen={() => openEdit(ev)}
                          onDelete={async () => {
                            
                            await deleteEvent(ev.id)
                            await refresh()
                          }}
                        />
                      ))
                    )}
                  </Card>
                )
              })}
            </div>
          ) : (
            /* Day view */
            <Card className="space-y-3 min-h-[20rem]">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg">
                  {format(anchor, 'EEEE, MMMM d')}
                </h2>
                <button
                  type="button"
                  className="text-xs text-[var(--color-acc)] font-semibold min-h-9 px-2"
                  onClick={() => openCreate(anchor)}
                >
                  + Add event
                </button>
              </div>
              {eventsOn(anchor).length === 0 ? (
                <EmptyState
                  icon={<CalIcon size={28} className="text-[var(--color-mute)]" />}
                  title="Nothing scheduled"
                  description="Add an event for this day or jump to another date from the mini calendar."
                  action={
                    <Button variant="secondary" leftIcon={<Plus size={16} />} onClick={() => openCreate(anchor)}>
                      New event
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {eventsOn(anchor).map((ev) => (
                    <EventRow
                      key={ev.id}
                      event={ev}
                      color={eventColor(ev, calendars)}
                      showDate={false}
                      onOpen={() => openEdit(ev)}
                      onDelete={async () => {
                        
                        await deleteEvent(ev.id)
                        await refresh()
                      }}
                    />
                  ))}
                </div>
              )}
            </Card>
          )}
        </main>
      </div>

      {/* Event create / edit modal */}
      {composer && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setComposer(false)
              setEditing(null)
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-form-title"
            className="relative w-full sm:max-w-md bg-[var(--color-s1)] border border-[var(--color-line)] rounded-t-3xl sm:rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 id="event-form-title" className="font-bold text-lg">
                {editing?.recur_rule ? 'Edit recurring series' : editing ? 'Edit event' : 'New event'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setComposer(false)
                  setEditing(null)
                }}
                className="p-2 rounded-xl hover:bg-[var(--color-s2)]"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Title"
              autoFocus
              className="field"
              required
            />

            {calendars.length > 1 && (
              <div>
                <label className="text-xs font-semibold text-[var(--color-dim)] mb-1 block">
                  Calendar
                </label>
                <select
                  value={formCalendarId || ''}
                  disabled={!!editing}
                  onChange={(e) => setFormCalendarId(e.target.value || undefined)}
                  className="field"
                >
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-[var(--color-dim)] mb-1 block">
                  Start date
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => {
                    setFormDate(e.target.value)
                    if (e.target.value > formEndDate) setFormEndDate(e.target.value)
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--color-s2)] border border-[var(--color-line)] text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--color-dim)] mb-1 block">
                  End date
                </label>
                <input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--color-s2)] border border-[var(--color-line)] text-sm"
                />
              </div>
            </div>

            {!formAllDay && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-[var(--color-dim)] mb-1 block">
                    Start time
                  </label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--color-s2)] border border-[var(--color-line)] text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--color-dim)] mb-1 block">
                    End time
                  </label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--color-s2)] border border-[var(--color-line)] text-sm"
                  />
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-[var(--color-dim)]">
              <input
                type="checkbox"
                checked={formAllDay}
                onChange={(e) => setFormAllDay(e.target.checked)}
              />
              All day
            </label>

            <div>
              <div className="text-xs font-semibold text-[var(--color-dim)] mb-1">Repeat</div>
              <div className="flex gap-1">
                {(['none', 'daily', 'weekly'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFormRecur(r)}
                    className={
                      formRecur === r
                        ? 'px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--color-acc)] text-[var(--color-ink)]'
                        : 'px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--color-s2)] border border-[var(--color-line)] text-[var(--color-dim)]'
                    }
                  >
                    {r === 'none' ? 'Once' : r === 'daily' ? 'Daily' : 'Weekly'}
                  </button>
                ))}
              </div>
            </div>

            <input
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              placeholder="Location (optional)"
              className="field"
            />

            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="field !min-h-[4.5rem] resize-none py-3"
            />

            <div className="flex gap-2">
              {editing && !editing.id.includes('_') && (
                <Button
                  variant="secondary"
                  className="!text-[var(--color-danger)]"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  Delete
                </Button>
              )}
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setComposer(false)
                  setEditing(null)
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={!formTitle.trim() || saving}
                onClick={handleFormSave}
                leftIcon={saving ? <Loader2 size={16} className="animate-spin" /> : undefined}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EventRow({
  event,
  color,
  showDate,
  onOpen,
  onDelete,
}: {
  event: CalendarEvent
  color: string
  showDate?: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  const start = parseISO(event.starts_at)
  return (
    <article className="surface-elevated p-3.5 flex items-start gap-3 group">
      <div
        className="w-1 self-stretch rounded-full shrink-0 min-h-[2.5rem]"
        style={{ background: color }}
        aria-hidden
      />
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
        <div className="font-semibold text-sm tracking-tight truncate hover:text-[var(--color-acc)]">
          {event.title}
        </div>
        <div className="text-xs text-[var(--color-mute)] flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
          <span className="inline-flex items-center gap-1 font-medium">
            <Clock size={12} aria-hidden />
            {event.all_day
              ? 'All day'
              : format(start, showDate ? 'MMM d · h:mm a' : 'h:mm a')}
          </span>
          {event.location_label && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} aria-hidden />
              {event.location_label}
            </span>
          )}
          {event.task_id && (
            <Link to="/tasks" className="font-bold text-[var(--color-acc)]">
              From task
            </Link>
          )}
        </div>
        {event.notes && (
          <p className="text-xs text-[var(--color-dim)] mt-1.5 line-clamp-2 text-pretty">
            {event.notes}
          </p>
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="text-xs font-bold text-[var(--color-danger)] min-h-11 px-2 rounded-xl hover:bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] sm:opacity-70 sm:group-hover:opacity-100"
      >
        Delete
      </button>
    </article>
  )
}
