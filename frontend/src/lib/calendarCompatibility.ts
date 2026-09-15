import { pacificInput } from './time'
import type { LegacyRecord } from './legacyRecords'
import type { CalendarEvent } from './calendar'

/** Project canonical Daybook records without migrating or duplicating them. */
export function projectLegacyCalendar(records: LegacyRecord[], calendarId: string, from: Date, to: Date): CalendarEvent[] {
  const output: CalendarEvent[] = []
  for (const record of records) {
    const p = record.payload
    const isTask = record.collection === 'tasks'
    if (!isTask && record.collection !== 'events') continue
    if (isTask && (p.is_done || p.status === 'cancelled')) continue
    const day = isTask ? p.planned_date || p.due_date : p.date
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
    const allDay = isTask ? !p.due_time : !!p.allDay
    const start = pacificInput(day, allDay ? '00:00' : (isTask ? p.due_time : p.start) || '09:00')
    let end: Date | null = isTask ? null : pacificInput(day, p.end || p.start || '10:00')
    if (allDay && !isTask) { end = pacificInput(day); end.setDate(end.getDate() + 1) }
    if (!Number.isFinite(start.getTime()) || (end && !Number.isFinite(end.getTime()))) continue
    if (start >= to || (end && end > start ? end <= from : start < from)) continue
    output.push({ id: `${isTask?'task':'legacy-event'}:${record.id}`, calendar_id: calendarId,
      title: isTask ? p.text || p.title || 'Task' : p.title || 'Event', notes: p.notes || null,
      starts_at: start.toISOString(), ends_at: end?.toISOString() ?? null, all_day: allDay,
      task_id: isTask ? record.id : null, legacy_id: isTask ? undefined : record.id,
      calendar_name: isTask ? 'Tasks' : 'Original calendar', calendar_color: p.color || '#22C55E',
    })
  }
  return output
}
