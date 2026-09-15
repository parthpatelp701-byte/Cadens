import { supabase } from '@/lib/supabase'
import { pacificNow, pacificDay } from './time'
import { expandRecurringEvents } from './recurrence'
import { loadLegacyBook } from './legacyRecords'
import { projectLegacyCalendar } from './calendarCompatibility'
export { expandRecurringEvents } from './recurrence'

export interface Calendar {
  id: string
  user_id: string
  name: string
  color: string
  kind: 'personal' | 'work' | 'group' | 'focus'
  is_default: boolean
}

export interface CalendarEvent {
  id: string
  calendar_id: string
  series_id?: string
  legacy_id?: string
  updated_at?: string
  title: string
  notes?: string | null
  location_label?: string | null
  starts_at: string
  ends_at?: string | null
  all_day: boolean
  calendar_name?: string
  calendar_color?: string
  recur_rule?: 'daily' | 'weekly' | null
  recur_until?: string | null
  task_id?: string | null
}

export async function ensureDefaultCalendar(): Promise<Calendar> {
  const { data, error } = await supabase.rpc('ensure_default_calendar')
  if (error) throw error
  return data as Calendar
}

export async function listCalendars(): Promise<Calendar[]> {
  await ensureDefaultCalendar()
  const { data, error } = await supabase
    .from('calendars')
    .select('*')
    .order('is_default', { ascending: false })
  if (error) throw error
  return (data as Calendar[]) || []
}

export async function createCalendar(name: string, color = '#22C55E', kind: Calendar['kind'] = 'personal', groupId?: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { data, error } = await supabase
    .from('calendars')
    .insert({ user_id: user.id, name, color, kind, group_id: groupId || null })
    .select()
    .single()
  if (error) throw error
  return data as Calendar
}

export async function listEventsInRange(
  from: Date,
  to: Date,
  calendarId?: string
): Promise<CalendarEvent[]> {
  const [response, book, personal] = await Promise.all([supabase.rpc('list_calendar_events', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_calendar_id: calendarId || null,
  }), loadLegacyBook(), ensureDefaultCalendar()])
  const { data, error } = response
  if (error) throw error
  const original = !calendarId || calendarId === personal.id ? projectLegacyCalendar(book.records, personal.id, from, to) : []
  return [...((data as CalendarEvent[]) || []), ...original]
}

export async function listUpcoming(days = 7): Promise<CalendarEvent[]> {
  const from = pacificNow(), to = pacificNow()
  to.setDate(to.getDate() + days)
  return expandRecurringEvents(await listEventsInRange(from, to), from, to).slice(0, 30)
}

export async function createEvent(input: {
  title: string
  startsAt: Date
  endsAt?: Date
  allDay?: boolean
  notes?: string
  location?: string
  calendarId?: string
  recurRule?: 'daily' | 'weekly'
  recurUntil?: Date
}): Promise<CalendarEvent> {
  const { data, error } = await supabase.rpc('create_calendar_event', {
    p_title: input.title,
    p_starts_at: input.startsAt.toISOString(),
    p_ends_at: input.endsAt?.toISOString() || null,
    p_all_day: input.allDay ?? false,
    p_notes: input.notes || null,
    p_location_label: input.location || null,
    p_calendar_id: input.calendarId || null,
    p_recur_rule: input.recurRule || null,
    p_recur_until: input.recurUntil ? pacificDay(input.recurUntil) : null,
  })
  if (error) throw error
  return data as CalendarEvent
}

export async function updateEvent(input: {
  id: string; title: string; notes: string | null; startsAt: Date; endsAt: Date | null;
  allDay: boolean; location: string | null; calendarId: string; recurRule: 'daily' | 'weekly' | null;
  updatedAt: string;
}): Promise<CalendarEvent> {
  const { data, error } = await supabase.from('calendar_events').update({
    title: input.title, notes: input.notes, starts_at: input.startsAt.toISOString(),
    ends_at: input.endsAt?.toISOString() ?? null, all_day: input.allDay,
    location_label: input.location, calendar_id: input.calendarId, recur_rule: input.recurRule,
  }).eq('id', input.id).eq('updated_at', input.updatedAt).select().maybeSingle()
  if (error) throw error
  if (!data) throw new Error('This event changed or access was removed. Reload the calendar before editing again.')
  return data as CalendarEvent
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('calendar_events').delete().eq('id', id)
  if (error) throw error
}

export { parseQuickEvent } from './quickEvent'
