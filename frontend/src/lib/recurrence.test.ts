import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expandRecurringEvents } from './recurrence'
import { pacificInput, pacificTime } from './time'
import type { CalendarEvent } from './calendar'
import { parseQuickEvent } from './quickEvent'

const event: CalendarEvent = { id: 'series', calendar_id: 'private', title: 'Walk',
  starts_at: pacificInput('2024-01-01', '09:00').toISOString(), all_day: false, recur_rule: 'daily' }

test('long-running series remains visible years after its start', () => {
  const result = expandRecurringEvents([event], pacificInput('2026-09-12'), pacificInput('2026-09-13'))
  assert.equal(result.length, 1)
  assert.equal(result[0].series_id, 'series')
  assert.equal(pacificTime(result[0].starts_at), '9:00 AM')
})
test('daily recurrence keeps Pacific wall time across both DST transitions', () => {
  for (const day of ['2026-03-07', '2026-10-31']) {
    const from = pacificInput(day); const to = pacificInput(day); to.setDate(to.getDate() + 4)
    const result = expandRecurringEvents([event], from, to)
    assert.equal(result.length, 4)
    assert.ok(result.every(e => pacificTime(e.starts_at) === '9:00 AM'))
  }
})
test('recurrence end date includes its final Pacific day', () => {
  const result = expandRecurringEvents([{ ...event, recur_until: '2026-09-12' }], pacificInput('2026-09-12'), pacificInput('2026-09-15'))
  assert.equal(result.length, 1)
})
test('range excludes next midnight but includes an overlapping multi-day event', () => {
  const from = pacificInput('2026-09-12'); const to = pacificInput('2026-09-13')
  const result = expandRecurringEvents([
    { ...event, recur_rule: null, starts_at: to.toISOString() },
    { ...event, id: 'trip', recur_rule: null, starts_at: pacificInput('2026-09-11').toISOString(), ends_at: to.toISOString() },
  ], from, to)
  assert.deepEqual(result.map(e => e.id), ['trip'])
})
test('quick add preserves numbers in ordinary task titles', () => {
  assert.equal(parseQuickEvent('Buy 3 notebooks').title, 'Buy 3 notebooks')
  assert.equal(parseQuickEvent('Review chapter 12').title, 'Review chapter 12')
})
test('quick add recognizes explicit times and preserves Pacific time', () => {
  const parsed = parseQuickEvent('Dentist tomorrow 3pm')
  assert.equal(parsed.title, 'Dentist')
  assert.equal(pacificTime(parsed.startsAt), '3:00 PM')
  assert.equal(parseQuickEvent('Meeting 25:99').title, 'Meeting 25:99')
})
