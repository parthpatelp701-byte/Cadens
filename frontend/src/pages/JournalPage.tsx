import { pacificDay } from '@/lib/time'
import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Plus,
  Search,
  Star,
  Flame,
  Calendar,
  Sparkles,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import {
  listJournals,
  listEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  onThisDay,
  getStreak,
  calendarMonth,
  promptForToday,
  JOURNAL_TEMPLATES,
  type Journal,
  type JournalEntry,
  type JournalStreak,
  type Mood,
} from '@/lib/journal'
import {
  celebrateStreakIfNeeded, buildReflectBody,
  getJournalReminder,
  setJournalReminder,
  markCheckinToday,
  ensureNotificationPermission,
  scheduleJournalReminder,
} from '@/lib/retention'
import { createEvent, listEventsInRange } from '@/lib/calendar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Card'
import { clsx } from 'clsx'
import { useToast } from '@/components/ui/Toast'

const MOODS: { id: Mood; label: string; emoji: string }[] = [
  { id: 'great', label: 'Great', emoji: '😄' },
  { id: 'good', label: 'Good', emoji: '🙂' },
  { id: 'ok', label: 'OK', emoji: '😐' },
  { id: 'low', label: 'Low', emoji: '😔' },
  { id: 'hard', label: 'Hard', emoji: '🌧️' },
]

export function JournalPage() {
  const [journals, setJournals] = useState<Journal[]>([])
  const [journalId, setJournalId] = useState<string | undefined>()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [memories, setMemories] = useState<JournalEntry[]>([])
  const [streak, setStreak] = useState<JournalStreak>({ current: 0, longest: 0, total_entries: 0 })
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [mood, setMood] = useState<Mood | undefined>()
  const [templateKey, setTemplateKey] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1)
  const [calDays, setCalDays] = useState<Record<string, number>>({})
  const [showCal, setShowCal] = useState(false)
  const [reminder, setReminder] = useState(() => getJournalReminder())
  const [wroteToday, setWroteToday] = useState(true)
  const [milestone, setMilestone] = useState('')
  const { toast } = useToast()

  const prompt = useMemo(() => promptForToday(), [])

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const [js, es, mem, st] = await Promise.all([
        listJournals(),
        listEntries({ journalId, query: query || undefined }),
        onThisDay(),
        getStreak(),
      ])
      setJournals(js)
      if (!journalId && js[0]) setJournalId(js[0].id)
      setEntries(es)
      setMemories(mem)
      setStreak(st)
      const today = pacificDay(new Date())
      setWroteToday(es.some((e) => e.entry_date === today))

    } catch (e: any) {
      setError(e.message || 'Could not load your journal. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [journalId])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void listEntries({ journalId, query: query || undefined }).then(setEntries).catch(() => {})
    }, 280)
    return () => clearTimeout(t)
  }, [query, journalId])

  useEffect(() => {
    if (!showCal) return
    calendarMonth(calYear, calMonth)
      .then((rows) => {
        const map: Record<string, number> = {}
        for (const r of rows) map[r.entry_date] = Number(r.entry_count)
        setCalDays(map)
      })
      .catch(() => setCalDays({}))
  }, [showCal, calYear, calMonth])

  async function handleSave() {
    if (!body.trim()) return
    setSaving(true)
    setError('')
    try {
      await createEntry({
        journalId,
        body: body.trim(),
        title: title.trim() || undefined,
        mood,
        templateKey,
      })
      markCheckinToday()
      setWroteToday(true)
      const st = await getStreak()
      setStreak(st)
      const msg = celebrateStreakIfNeeded(st.current)
      if (msg) {
        setMilestone(msg)
        toast(msg, 'success')
      }
      setComposerOpen(false)
      setTitle('')
      setBody('')
      setMood(undefined)
      setTemplateKey(undefined)
      await refresh()
    } catch (e: any) {
      setError(e.message || 'Could not save entry')
    } finally {
      setSaving(false)
    }
  }

  function applyTemplate(key: string) {
    const t = JOURNAL_TEMPLATES.find((x) => x.key === key)
    if (!t) return
    setTemplateKey(key)
    setBody(t.body)
    if (!title) setTitle(t.name)
  }

  function usePrompt() {
    setBody((prev) => (prev.trim() ? prev : prompt + '\n\n'))
    setComposerOpen(true)
  }

  const daysInMonth = new Date(calYear, calMonth, 0).getDate()

  async function scheduleReflection() {
    try {
      const starts = new Date()
      starts.setHours(20, 0, 0, 0)
      if (starts.getTime() < Date.now()) starts.setDate(starts.getDate() + 1)
      await createEvent({
        title: 'Journal reflection',
        startsAt: starts,
        notes: 'Cadens reminder to write in Journal',
      })
      toast('Added to Plan for this evening', 'success')
    } catch (e: any) {
      toast(e.message || 'Could not add to Plan', 'error')
    }
  }

  async function reflectOnToday() {
    try {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const end = new Date()
      end.setHours(23, 59, 59, 999)
      const events = await listEventsInRange(start, end)
      setBody(buildReflectBody(events, prompt))
      setTitle('Today')
      setTemplateKey(undefined)
      setComposerOpen(true)
    } catch {
      setBody(buildReflectBody([], prompt))
      setTitle('Today')
      setComposerOpen(true)
    }
  }


  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen size={24} className="text-[var(--color-acc)]" />
            Journal
          </h1>
          <p className="text-sm text-[var(--color-dim)] mt-0.5">
            Private entries · prompts · On This Day · streaks
          </p>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={() => setComposerOpen(true)}>
          Write
        </Button>
      </header>

      {!wroteToday && (
        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div className="font-semibold text-sm flex items-center gap-2">
              <Flame size={16} className="text-orange-400" />
              Keep your streak alive
            </div>
            <p className="text-xs text-[var(--color-dim)] mt-0.5">
              {streak.current > 0
                ? `You’re on a ${streak.current}-day streak. A few lines counts.`
                : 'Two minutes today starts your streak.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={scheduleReflection}>
              Schedule on Plan
            </Button>
            <Button size="sm" variant="secondary" onClick={reflectOnToday}>
              Reflect on today
            </Button>
            <Button size="sm" onClick={() => setComposerOpen(true)}>
              Write today’s entry
            </Button>
          </div>
        </div>
      )}

      {milestone && (
        <div className="rounded-xl bg-[var(--color-ok)]/15 text-[var(--color-ok)] text-sm px-3 py-2 font-medium">
          {milestone}
        </div>
      )}

      {/* Streak + prompt */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-orange-500/15 flex items-center justify-center">
            <Flame size={22} className="text-orange-400" />
          </div>
          <div>
            <div className="font-bold text-lg tabular-nums">{streak.current} day streak</div>
            <div className="text-xs text-[var(--color-mute)]">
              Longest {streak.longest} · {streak.total_entries} entries
            </div>
          </div>
        </Card>
        <button
          type="button"
          onClick={usePrompt}
          className="text-left rounded-2xl border border-[var(--color-line)] bg-[var(--color-s2)] p-4 hover:bg-[var(--color-s3)] transition-colors"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--color-acc)] mb-1">
            <Sparkles size={14} />
            Today’s prompt
          </div>
          <p className="text-sm font-medium leading-snug">{prompt}</p>
        </button>
      </div>


      {/* Daily reminder — retention */}
      <Card className="flex flex-wrap items-center gap-3 justify-between">
        <div className="text-sm">
          <div className="font-semibold">Daily journal reminder</div>
          <div className="text-xs text-[var(--color-mute)]">
            Browser notification at your preferred time (when the app is open or permission granted)
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={reminder.time}
            onChange={(e) => {
              const next = { ...reminder, time: e.target.value }
              setReminder(next)
              if (next.enabled) setJournalReminder(next)
            }}
            className="px-2 py-1.5 rounded-lg bg-[var(--color-s2)] border border-[var(--color-line)] text-sm"
          />
          <button
            type="button"
            onClick={async () => {
              const enabled = !reminder.enabled
              if (enabled) {
                const ok = await ensureNotificationPermission()
                if (!ok) {
                  setError('Notification permission is required for reminders')
                  return
                }
              }
              const next = { ...reminder, enabled }
              setReminder(next)
              setJournalReminder(next)
              scheduleJournalReminder(next)
            }}
            className={
              reminder.enabled
                ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-ok)]/20 text-[var(--color-ok)]'
                : 'px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-s3)] text-[var(--color-dim)]'
            }
          >
            {reminder.enabled ? 'On' : 'Off'}
          </button>
        </div>
      </Card>

      {/* Journals + search */}
      <div className="flex flex-wrap gap-2 items-center">
        {journals.map((j) => (
          <button
            key={j.id}
            type="button"
            onClick={() => setJournalId(j.id)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
              journalId === j.id
                ? 'bg-[var(--color-acc)] text-[var(--color-ink)] border-transparent'
                : 'bg-[var(--color-s2)] border-[var(--color-line)] text-[var(--color-dim)]'
            )}
          >
            {j.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCal((v) => !v)}
          className="ml-auto p-2 rounded-xl hover:bg-[var(--color-s2)] text-[var(--color-mute)]"
          aria-label="Calendar"
        >
          <Calendar size={18} />
        </button>
      </div>

      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)]"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entries…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--color-s2)] border border-[var(--color-line)] text-sm outline-none focus:border-[var(--color-acc)]"
        />
      </div>

      {showCal && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="p-1"
              onClick={() => {
                if (calMonth === 1) {
                  setCalMonth(12)
                  setCalYear((y) => y - 1)
                } else setCalMonth((m) => m - 1)
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold">
              {calYear}-{String(calMonth).padStart(2, '0')}
            </span>
            <button
              type="button"
              className="p-1"
              onClick={() => {
                if (calMonth === 12) {
                  setCalMonth(1)
                  setCalYear((y) => y + 1)
                } else setCalMonth((m) => m + 1)
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[var(--color-mute)]">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
              <div key={d}>{d}</div>
            ))}
            {Array.from({ length: new Date(calYear, calMonth - 1, 1).getDay() }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const key = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const count = calDays[key] || 0
              return (
                <div
                  key={key}
                  className={clsx(
                    'aspect-square rounded-md flex items-center justify-center text-[11px]',
                    count > 0
                      ? 'bg-[var(--color-acc)]/30 text-[var(--color-txt)] font-semibold'
                      : 'text-[var(--color-mute)]'
                  )}
                  title={count ? `${count} entries` : undefined}
                >
                  {day}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {error && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/10 px-3 py-2 rounded-xl">
          {error}
        </div>
      )}

      {/* On This Day */}
      {memories.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--color-dim)]">
            On this day
          </h2>
          <div className="space-y-2">
            {memories.slice(0, 3).map((m) => (
              <Card key={m.id} className="text-sm">
                <div className="text-xs text-[var(--color-mute)] mb-1">
                  {format(parseISO(m.entry_date), 'MMM d, yyyy')}
                </div>
                {m.title && <div className="font-semibold mb-0.5">{m.title}</div>}
                <p className="text-[var(--color-dim)] line-clamp-2 whitespace-pre-wrap">{m.body}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Entries */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-[var(--color-s2)] animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={28} className="text-[var(--color-mute)]" />}
          title="Your journal is empty"
          description="Write freely, use a prompt, or start from a template — private to you only."
          action={
            <Button variant="secondary" leftIcon={<Plus size={16} />} onClick={() => setComposerOpen(true)}>
              First entry
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <Card key={e.id} className="space-y-2 group">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs text-[var(--color-mute)]">
                  {format(parseISO(e.entry_date), 'EEE, MMM d, yyyy')}
                  {e.mood && (
                    <span className="ml-2">
                      {MOODS.find((m) => m.id === e.mood)?.emoji} {e.mood}
                    </span>
                  )}
                  {e.word_count > 0 && <span className="ml-2">{e.word_count} words</span>}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await updateEntry(e.id, { is_favorite: !e.is_favorite })
                    setEntries((prev) =>
                      prev.map((x) =>
                        x.id === e.id ? { ...x, is_favorite: !x.is_favorite } : x
                      )
                    )
                  }}
                  className={clsx(
                    'p-1 rounded-lg',
                    e.is_favorite ? 'text-amber-400' : 'text-[var(--color-mute)] opacity-0 group-hover:opacity-100'
                  )}
                  aria-label="Favorite"
                >
                  <Star size={16} fill={e.is_favorite ? 'currentColor' : 'none'} />
                </button>
              </div>
              {e.title && <h3 className="font-semibold">{e.title}</h3>}
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-[var(--color-txt)]">
                {e.body}
              </p>
              <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  className="text-xs text-[var(--color-danger)] hover:underline"
                  onClick={async () => {
                    if (confirm('Delete this entry?')) {
                      await deleteEntry(e.id)
                      await refresh()
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Composer */}
      {composerOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setComposerOpen(false)} />
          <div className="relative w-full sm:max-w-lg bg-[var(--color-s1)] border border-[var(--color-line)] rounded-t-3xl sm:rounded-2xl p-5 space-y-3 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">New entry</h2>
              <button type="button" onClick={() => setComposerOpen(false)} className="p-2 rounded-xl hover:bg-[var(--color-s2)]">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {JOURNAL_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => applyTemplate(t.key)}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-[11px] font-semibold border',
                    templateKey === t.key
                      ? 'border-[var(--color-acc)] bg-[var(--color-acc)]/15 text-[var(--color-acc)]'
                      : 'border-[var(--color-line)] text-[var(--color-dim)]'
                  )}
                >
                  {t.name}
                </button>
              ))}
              <button
                type="button"
                onClick={usePrompt}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-[var(--color-line)] text-[var(--color-dim)]"
              >
                Use prompt
              </button>
            </div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full px-3 py-2 rounded-xl bg-[var(--color-s2)] border border-[var(--color-line)] text-sm outline-none focus:border-[var(--color-acc)]"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What’s on your mind…"
              rows={8}
              autoFocus
              className="w-full px-3 py-3 rounded-xl bg-[var(--color-s2)] border border-[var(--color-line)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-acc)]/40 resize-none leading-relaxed"
            />

            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMood(mood === m.id ? undefined : m.id)}
                  className={clsx(
                    'px-2 py-1 rounded-lg text-xs border',
                    mood === m.id
                      ? 'border-[var(--color-acc)] bg-[var(--color-acc)]/15'
                      : 'border-[var(--color-line)]'
                  )}
                >
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setComposerOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={!body.trim() || saving}
                onClick={handleSave}
                leftIcon={saving ? <Loader2 size={16} className="animate-spin" /> : undefined}
              >
                Save entry
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
