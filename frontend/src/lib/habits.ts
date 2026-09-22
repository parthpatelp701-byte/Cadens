import { pacificDay } from './time'

export type HabitKind = 'positive' | 'negative'
export type HabitFrequency = 'daily' | 'weekly'

export interface HabitPayload {
  id?: string
  name?: string
  icon?: string
  stamps?: Record<string, boolean>
  kind?: HabitKind
  frequency?: HabitFrequency
  archived?: boolean
  created_at?: string
  updated_at?: string
  [key: string]: any
}

export interface Habit {
  id: string
  name: string
  icon: string
  kind: HabitKind
  frequency: HabitFrequency
  archived: boolean
  stamps: Record<string, boolean>
  created_at: string
  updated_at: string
  metadata: HabitPayload
}

export interface HabitInput {
  name?: string
  icon?: string
  kind?: HabitKind
  frequency?: HabitFrequency
  archived?: boolean
  metadata?: HabitPayload
  expectedUpdatedAt?: string
}

export function projectHabit(payload: HabitPayload, id: string): Habit {
  const stamps = payload.stamps && typeof payload.stamps === 'object' && !Array.isArray(payload.stamps) ? payload.stamps : {}
  const kind: HabitKind = payload.kind === 'negative' ? 'negative' : 'positive'
  const frequency: HabitFrequency = payload.frequency === 'weekly' ? 'weekly' : 'daily'
  const metadata = {...payload, id, stamps, kind, frequency, archived: !!payload.archived}
  return {
    id,
    name: String(payload.name || '').slice(0, 40),
    icon: String(payload.icon || '•').slice(0, 8),
    kind,
    frequency,
    archived: !!payload.archived,
    stamps,
    created_at: payload.created_at || '',
    updated_at: payload.updated_at || '',
    metadata,
  }
}

export function visibleHabits(habits: Habit[], includeArchived = false): Habit[] {
  return includeArchived ? habits : habits.filter(habit => !habit.archived)
}

export function habitStreak(habit: Habit, today = pacificDay()): number {
  let total = 0
  const cursor = new Date(`${today}T12:00:00Z`)
  for (;;) {
    const key = cursor.toISOString().slice(0, 10)
    if (!habit.stamps[key]) return total
    total++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
}

export function toggleHabitStamp(payload: HabitPayload, day = pacificDay()): HabitPayload {
  const stamps = {...(payload.stamps || {})}
  if (stamps[day]) delete stamps[day]
  else stamps[day] = true
  return {...payload, stamps, updated_at: new Date().toISOString()}
}

function patch(input: HabitInput): HabitPayload {
  const row: HabitPayload = {}
  if (input.metadata) {
    for (const field of ['stamps', 'target', 'days', 'notes', 'color']) {
      if (field in input.metadata) row[field] = input.metadata[field]
    }
  }
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) throw new Error('Enter a habit name')
    row.name = name.slice(0, 40)
  }
  if (input.icon !== undefined) row.icon = input.icon.trim().slice(0, 8) || '•'
  if (input.kind !== undefined) row.kind = input.kind === 'negative' ? 'negative' : 'positive'
  if (input.frequency !== undefined) row.frequency = input.frequency === 'weekly' ? 'weekly' : 'daily'
  if (input.archived !== undefined) row.archived = !!input.archived
  return row
}

export async function listHabits(includeArchived = false): Promise<Habit[]> {
  const { loadLegacyBook } = await import('./legacyRecords')
  const book = await loadLegacyBook()
  const habits = book.records
    .filter(r => r.collection === 'habits')
    .map(r => projectHabit(r.payload, r.id))
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
  return visibleHabits(habits, includeArchived)
}

export async function createHabit(input: HabitInput & {name: string}): Promise<Habit> {
  const { mutateLegacyBook } = await import('./legacyRecords')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const payload: HabitPayload = {id, name: '', icon: '•', stamps: {}, kind: 'positive', frequency: 'daily', archived: false, ...patch(input), created_at: now, updated_at: now}
  await mutateLegacyBook(() => ({changes: [{collection: 'habits', id, payload}]}))
  return projectHabit(payload, id)
}

export async function updateHabit(id: string, input: HabitInput): Promise<Habit> {
  const { mutateLegacyBook } = await import('./legacyRecords')
  let result: Habit | undefined
  await mutateLegacyBook(book => {
    const record = book.records.find(r => r.collection === 'habits' && r.id === id)
    if (!record) throw new Error('Habit no longer exists. Refresh and try again.')
    if (input.expectedUpdatedAt !== undefined && input.expectedUpdatedAt !== (record.payload.updated_at || '')) throw new Error('This habit changed elsewhere. Close the editor and refresh before saving.')
    const payload = {...record.payload, ...patch(input), id, updated_at: new Date().toISOString()}
    result = projectHabit(payload, id)
    return {changes: [{collection: 'habits', id, payload}]}
  })
  return result!
}

export async function setHabitChecked(id: string, day = pacificDay(), checked?: boolean): Promise<Habit> {
  const { mutateLegacyBook } = await import('./legacyRecords')
  let result: Habit | undefined
  await mutateLegacyBook(book => {
    const record = book.records.find(r => r.collection === 'habits' && r.id === id)
    if (!record) throw new Error('Habit no longer exists. Refresh and try again.')
    const current = !!record.payload.stamps?.[day]
    let payload = record.payload
    if (checked === undefined || checked !== current) payload = toggleHabitStamp(record.payload, day)
    result = projectHabit(payload, id)
    return {changes: [{collection: 'habits', id, payload}]}
  })
  return result!
}

export async function deleteHabit(id: string): Promise<void> {
  const { mutateLegacyBook } = await import('./legacyRecords')
  await mutateLegacyBook(() => ({changes: [{collection: 'habits', id, deleted: true}]}))
}
