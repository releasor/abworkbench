import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_HABIT_SCHEDULE,
  getHabitProgress,
  isHabitGoalMetOnDate,
  normalizeHabit,
  recomputeCompletedDates,
} from './habitSchedule.ts'

function makeHabit(overrides = {}) {
  return normalizeHabit({
    id: 'h1',
    name: '喝水',
    icon: '💧',
    color: '#3b82f6',
    completedDates: [],
    checkIns: [],
    schedule: { ...DEFAULT_HABIT_SCHEDULE },
    createdAt: Date.now(),
    ...overrides,
  })
}

test('once mode completes after one check-in', () => {
  const habit = makeHabit()
  const dateStr = '2026-09-01'
  const ts = new Date(2026, 8, 1, 10, 0, 0).getTime()
  const withCheckIn = { ...habit, checkIns: [ts] }
  const progress = getHabitProgress(withCheckIn, dateStr, ts)
  assert.equal(progress.count, 1)
  assert.equal(progress.met, true)
})

test('multiple mode needs target count', () => {
  const habit = makeHabit({
    schedule: { mode: 'multiple', targetCount: 3 },
    checkIns: [
      new Date(2026, 8, 1, 9, 0, 0).getTime(),
      new Date(2026, 8, 1, 12, 0, 0).getTime(),
    ],
  })
  assert.equal(isHabitGoalMetOnDate(habit, '2026-09-01'), false)
  const done = {
    ...habit,
    checkIns: [...habit.checkIns, new Date(2026, 8, 1, 18, 0, 0).getTime()],
  }
  assert.equal(isHabitGoalMetOnDate(done, '2026-09-01'), true)
})

test('window mode only counts check-ins inside window', () => {
  const habit = makeHabit({
    schedule: { mode: 'window', targetCount: 2, windowStartHour: 6, windowEndHour: 9 },
    checkIns: [
      new Date(2026, 8, 1, 7, 0, 0).getTime(),
      new Date(2026, 8, 1, 20, 0, 0).getTime(),
    ],
  })
  const progress = getHabitProgress(habit, '2026-09-01')
  assert.equal(progress.count, 1)
  assert.equal(progress.met, false)
})

test('normalizeHabit migrates completedDates', () => {
  const habit = normalizeHabit({
    id: 'h1',
    name: '阅读',
    icon: '📖',
    color: '#f59e0b',
    completedDates: ['2026-09-01'],
    createdAt: Date.now(),
  })
  assert.equal(habit.checkIns.length, 1)
  assert.deepEqual(recomputeCompletedDates(habit), ['2026-09-01'])
})
