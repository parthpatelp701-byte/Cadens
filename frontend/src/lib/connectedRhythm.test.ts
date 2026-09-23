import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectFocusSession, projectMoodCheckin } from './connectedRhythm'

test('projects focus sessions with safe defaults and preserves unknown fields', () => {
  const focus = projectFocusSession({ id: 'f1', title: 'Deep work', duration_minutes: 90, state: 'completed', custom: { keep: true } }, 'f1')
  assert.equal(focus.title, 'Deep work')
  assert.equal(focus.duration_minutes, 90)
  assert.equal(focus.state, 'completed')
  assert.deepEqual(focus.metadata.custom, { keep: true })
})

test('clamps invalid focus duration without dropping metadata', () => {
  const focus = projectFocusSession({ id: 'f1', duration_minutes: 999, state: 'bad' as never, color: 'pink' }, 'f1')
  assert.equal(focus.duration_minutes, 480)
  assert.equal(focus.state, 'planned')
  assert.equal(focus.metadata.color, 'pink')
})

test('projects mood checkins with bounded energy and valid mood defaults', () => {
  const mood = projectMoodCheckin({ id: 'm1', day: '2026-09-22', mood: 'great', energy: 7, note: 'steady' }, 'm1')
  assert.equal(mood.day, '2026-09-22')
  assert.equal(mood.mood, 'great')
  assert.equal(mood.energy, 5)
  assert.equal(mood.note, 'steady')
})

test('keeps unknown mood fields for forward compatibility', () => {
  const mood = projectMoodCheckin({ id: 'm1', mood: 'unknown' as never, energy: 0, context: ['work'] }, 'm1')
  assert.equal(mood.mood, 'okay')
  assert.equal(mood.energy, 1)
  assert.deepEqual(mood.metadata.context, ['work'])
})
