import { pacificDay } from './time'

export type FocusSessionState = 'planned' | 'running' | 'completed' | 'cancelled'
export type MoodTone = 'great' | 'good' | 'okay' | 'low' | 'hard'

export interface FocusSessionPayload {
  id?: string
  title?: string
  started_at?: string | null
  ended_at?: string | null
  duration_minutes?: number
  state?: FocusSessionState
  linked_task_id?: string | null
  created_at?: string
  updated_at?: string
  [key: string]: any
}

export interface MoodCheckinPayload {
  id?: string
  day?: string
  mood?: MoodTone
  energy?: number
  note?: string
  created_at?: string
  updated_at?: string
  [key: string]: any
}

export interface FocusSession {
  id: string
  title: string
  started_at: string | null
  ended_at: string | null
  duration_minutes: number
  state: FocusSessionState
  linked_task_id: string | null
  created_at: string
  updated_at: string
  metadata: FocusSessionPayload
}

export interface MoodCheckin {
  id: string
  day: string
  mood: MoodTone
  energy: number
  note: string
  created_at: string
  updated_at: string
  metadata: MoodCheckinPayload
}

export function projectFocusSession(payload: FocusSessionPayload, id: string): FocusSession {
  const state: FocusSessionState = ['planned', 'running', 'completed', 'cancelled'].includes(String(payload.state)) ? payload.state as FocusSessionState : 'planned'
  const duration = Number.isFinite(payload.duration_minutes) ? Number(payload.duration_minutes) : 25
  const metadata = { ...payload, id, state, duration_minutes: duration }
  return {
    id,
    title: String(payload.title || 'Focus session').slice(0, 120),
    started_at: payload.started_at || null,
    ended_at: payload.ended_at || null,
    duration_minutes: Math.max(1, Math.min(480, Math.round(duration))),
    state,
    linked_task_id: payload.linked_task_id || null,
    created_at: payload.created_at || '',
    updated_at: payload.updated_at || '',
    metadata,
  }
}

export function projectMoodCheckin(payload: MoodCheckinPayload, id: string): MoodCheckin {
  const mood: MoodTone = ['great', 'good', 'okay', 'low', 'hard'].includes(String(payload.mood)) ? payload.mood as MoodTone : 'okay'
  const energy = Number.isFinite(payload.energy) ? Number(payload.energy) : 3
  const metadata = { ...payload, id, mood, energy }
  return {
    id,
    day: payload.day || pacificDay(payload.created_at || new Date()),
    mood,
    energy: Math.max(1, Math.min(5, Math.round(energy))),
    note: String(payload.note || '').slice(0, 1000),
    created_at: payload.created_at || '',
    updated_at: payload.updated_at || '',
    metadata,
  }
}

export async function listFocusSessions(): Promise<FocusSession[]> {
  const { loadLegacyBook } = await import('./legacyRecords')
  const book = await loadLegacyBook()
  return book.records
    .filter(r => r.collection === 'focus_sessions')
    .map(r => projectFocusSession(r.payload, r.id))
    .sort((a, b) => (b.started_at || b.created_at || '').localeCompare(a.started_at || a.created_at || ''))
}

export async function createFocusSession(input: Partial<FocusSessionPayload> = {}): Promise<FocusSession> {
  const { mutateLegacyBook } = await import('./legacyRecords')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const payload: FocusSessionPayload = { id, title: 'Focus session', duration_minutes: 25, state: 'planned', ...input, created_at: now, updated_at: now }
  await mutateLegacyBook(() => ({ changes: [{ collection: 'focus_sessions', id, payload }] }))
  return projectFocusSession(payload, id)
}

export async function saveMoodCheckin(input: MoodCheckinPayload): Promise<MoodCheckin> {
  const { mutateLegacyBook } = await import('./legacyRecords')
  const id = input.id || `${input.day || pacificDay()}-mood`
  const now = new Date().toISOString()
  const payload: MoodCheckinPayload = { id, day: pacificDay(), mood: 'okay', energy: 3, note: '', ...input, updated_at: now, created_at: input.created_at || now }
  await mutateLegacyBook(() => ({ changes: [{ collection: 'mood_checkins', id, payload }] }))
  return projectMoodCheckin(payload, id)
}

export async function listMoodCheckins(): Promise<MoodCheckin[]> {
  const { loadLegacyBook } = await import('./legacyRecords')
  const book = await loadLegacyBook()
  return book.records
    .filter(r => r.collection === 'mood_checkins')
    .map(r => projectMoodCheckin(r.payload, r.id))
    .sort((a, b) => b.day.localeCompare(a.day))
}
