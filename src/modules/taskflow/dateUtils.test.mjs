import assert from 'node:assert/strict'
import test from 'node:test'

import { todayStr } from './dateUtils.ts'

test('todayStr uses local calendar date not UTC', () => {
  // 2026-07-30 01:00 in UTC+8 is still 2026-07-30 local, but UTC is 2026-07-29.
  const localMorning = new Date(2026, 6, 30, 1, 0, 0)
  assert.equal(todayStr(localMorning), '2026-07-30')
})

test('dayKeyFromMs and formatLocalYMD stay on local calendar', async () => {
  const { dayKeyFromMs, formatLocalYMD } = await import('./dateUtils.ts')
  const localMorning = new Date(2026, 6, 30, 1, 0, 0)
  assert.equal(formatLocalYMD(localMorning), '2026-07-30')
  assert.equal(dayKeyFromMs(localMorning.getTime()), '2026-07-30')
})

test('dayKeyFromIso uses local calendar for ISO timestamps', async () => {
  const { dayKeyFromIso } = await import('./dateUtils.ts')
  const localMorning = new Date(2026, 6, 30, 1, 0, 0)
  assert.equal(dayKeyFromIso(localMorning.toISOString()), '2026-07-30')
  assert.equal(dayKeyFromIso(''), '')
  assert.equal(dayKeyFromIso(undefined), '')
})

test('formatLocalDateTimeMinute uses local wall clock', async () => {
  const { formatLocalDateTimeMinute } = await import('./dateUtils.ts')
  const local = new Date(2026, 6, 30, 9, 5, 0)
  assert.equal(formatLocalDateTimeMinute(local), '2026-07-30T09:05')
})
