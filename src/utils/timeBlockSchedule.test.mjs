import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clampScheduleHour,
  clearTaskScheduledHour,
  getDayTaskHours,
  readTimeBlockSchedule,
  setTaskScheduledHour,
} from './timeBlockSchedule.ts'

function memoryStorage(seed = {}) {
  const data = { ...seed }
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value)
    },
    removeItem: (key) => {
      delete data[key]
    },
  }
}

test('clampScheduleHour keeps hours in 8–21', () => {
  assert.equal(clampScheduleHour(7), 8)
  assert.equal(clampScheduleHour(22), 21)
  assert.equal(clampScheduleHour(14.6), 15)
})

test('setTaskScheduledHour persists day overrides', () => {
  const storage = memoryStorage()
  setTaskScheduledHour('2026-08-17', 'task-1', 11, storage)
  assert.deepEqual(getDayTaskHours('2026-08-17', undefined, storage), { 'task-1': 11 })
  setTaskScheduledHour('2026-08-17', 'task-2', 9, storage)
  const map = readTimeBlockSchedule(storage)
  assert.equal(map['2026-08-17']['task-1'], 11)
  assert.equal(map['2026-08-17']['task-2'], 9)
  clearTaskScheduledHour('2026-08-17', 'task-1', storage)
  const after = readTimeBlockSchedule(storage)
  assert.equal(after['2026-08-17']['task-1'], undefined)
  assert.equal(after['2026-08-17']['task-2'], 9)
})
