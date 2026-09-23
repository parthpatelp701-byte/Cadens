import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { createHabit, habitStreak, listHabits, setHabitChecked, type Habit } from '@/lib/habits'
import { pacificDay } from '@/lib/time'

export function HabitTodaySection() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const today = pacificDay()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setHabits(await listHabits()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load habits') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function addHabit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy('create')
    setError('')
    try {
      await createHabit({ name: trimmed })
      setName('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save habit')
    } finally { setBusy(null) }
  }

  async function toggle(habit: Habit) {
    if (busy) return
    setBusy(habit.id)
    setError('')
    try {
      await setHabitChecked(habit.id, today)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update habit')
    } finally { setBusy(null) }
  }

  return <section className="surface-elevated p-5" aria-labelledby="today-habits-title">
    <div className="flex items-center justify-between gap-3 mb-4">
      <div>
        <h2 id="today-habits-title" className="font-bold">habits</h2>
        <p className="text-sm text-[var(--color-dim)]">Daily rhythm checks stay in your Daybook.</p>
      </div>
      <span className="text-xs text-[var(--color-dim)]">{habits.length} active</span>
    </div>

    <form onSubmit={addHabit} className="flex gap-2 mb-4">
      <label htmlFor="habit-capture" className="sr-only">Add a habit</label>
      <input id="habit-capture" className="field flex-1 min-w-0" value={name} onChange={e => setName(e.target.value)} placeholder="Add a habit" maxLength={40} />
      <button className="px-3 rounded-xl border border-[var(--color-line2)]" disabled={!!busy || !name.trim()} aria-label="Add habit"><Plus size={18} /></button>
    </form>

    {error && <p role="alert" className="text-sm text-red-300 mb-3">{error}</p>}
    {loading ? <p role="status" className="text-sm text-[var(--color-dim)]">Loading habits…</p> : !habits.length ?
      <p className="text-sm text-[var(--color-dim)]">No habits yet. Add one small repeatable action for today.</p> :
      <ul className="space-y-2">
        {habits.slice(0, 6).map(habit => {
          const checked = !!habit.stamps[today]
          return <li key={habit.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-line2)] p-3">
            <button disabled={!!busy} onClick={() => void toggle(habit)} aria-pressed={checked} className="min-w-11 min-h-11 rounded-full border border-[var(--color-line2)]" aria-label={`${checked ? 'Clear' : 'Check'} ${habit.name}`}>{checked ? '✓' : habit.icon}</button>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{habit.name}</p>
              <p className="text-xs text-[var(--color-dim)]">{habit.frequency} · {habit.kind} · {habitStreak(habit, today)} day streak</p>
            </div>
          </li>
        })}
      </ul>}
  </section>
}
