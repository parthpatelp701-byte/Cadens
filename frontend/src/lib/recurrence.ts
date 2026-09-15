import { TZDate } from '@date-fns/tz'
import { TIME_ZONE, pacificDay } from './time'
import type { CalendarEvent } from './calendar'

/** Ranges are start-inclusive, end-exclusive. Repeat at the same Pacific wall time. */
export function expandRecurringEvents(events: CalendarEvent[], from: Date, to: Date): CalendarEvent[] {
  const result: CalendarEvent[] = []
  for (const event of events) {
    const start = new TZDate(event.starts_at, TIME_ZONE)
    const duration = event.ends_at ? Math.max(0, Date.parse(event.ends_at) - start.getTime()) : 0
    const overlaps = (date: Date) => date < to && (duration ? date.getTime() + duration > from.getTime() : date >= from)
    if (!event.recur_rule) {
      if (overlaps(start)) result.push(event)
      continue
    }
    const step = event.recur_rule === 'daily' ? 1 : 7
    const cursor = new TZDate(start, TIME_ZONE)
    // Jump close to the range instead of truncating a long-running series at 120 repeats.
    const skip = Math.max(0, Math.floor((from.getTime() - duration - start.getTime()) / 86400000 / step) - 2)
    cursor.setDate(cursor.getDate() + skip * step)
    while (cursor < to) {
      if (event.recur_until && pacificDay(cursor) > event.recur_until) break
      if (overlaps(cursor)) {
        const isOriginal = cursor.getTime() === start.getTime()
        result.push({ ...event,
          id: isOriginal ? event.id : `${event.id}_${cursor.toISOString()}`,
          series_id: event.id,
          starts_at: cursor.toISOString(),
          ends_at: event.ends_at ? new Date(cursor.getTime() + duration).toISOString() : null,
        })
      }
      cursor.setDate(cursor.getDate() + step)
    }
  }
  return result.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
}
