import assert from 'node:assert/strict'
import { test } from 'node:test'
import { habitStreak, projectHabit, toggleHabitStamp, visibleHabits } from './habits'

const today = '2026-09-20'

test('projects legacy S.habits records without losing stamps or unknown fields', () => {
  const habit = projectHabit({
    id: 'h1',
    name: 'Read',
    icon: 'R',
    stamps: {'2026-09-18': true, '2026-09-19': true},
    custom: { keep: true },
  }, 'h1')

  assert.equal(habit.name, 'Read')
  assert.equal(habit.icon, 'R')
  assert.equal(habit.frequency, 'daily')
  assert.equal(habit.kind, 'positive')
  assert.deepEqual(habit.metadata.custom, { keep: true })
  assert.deepEqual(habit.stamps, {'2026-09-18': true, '2026-09-19': true})
})

test('calculates a legacy daily habit streak by walking back from today', () => {
  const habit = projectHabit({id: 'h1', name: 'Read', stamps: {'2026-09-18': true, '2026-09-19': true, '2026-09-20': true}}, 'h1')
  assert.equal(habitStreak(habit, today), 3)
  assert.equal(habitStreak({...habit, stamps: {...habit.stamps, '2026-09-19': false}}, today), 1)
})

test('filters archived habits out of the default visible list', () => {
  const active = projectHabit({id: 'h1', name: 'Move'}, 'h1')
  const archived = projectHabit({id: 'h2', name: 'Old', archived: true}, 'h2')
  assert.deepEqual(visibleHabits([archived, active]).map(h => h.id), ['h1'])
  assert.deepEqual(visibleHabits([archived, active], true).map(h => h.id), ['h2', 'h1'])
})

test('toggles today stamp while preserving the original payload fields', () => {
  const checked = toggleHabitStamp({id: 'h1', name: 'Read', icon: 'R', stamps: {}, custom: 1}, today)
  assert.equal(checked.stamps?.[today], true)
  assert.equal(checked.custom, 1)

  const unchecked = toggleHabitStamp(checked, today)
  assert.equal(unchecked.stamps?.[today], undefined)
  assert.equal(unchecked.custom, 1)
})
