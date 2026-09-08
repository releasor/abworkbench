import assert from 'node:assert/strict'
import test from 'node:test'

import { todayStr } from './dateUtils.ts'

test('todayStr uses Beijing calendar date not UTC', () => {
  // 2026-07-29 20:00 UTC is still 2026-07-30 in Asia/Shanghai
  const beijingMorning = new Date('2026-07-29T20:00:00.000Z')
  assert.equal(todayStr(beijingMorning), '2026-07-30')
})

test('dayKeyFromMs and formatLocalYMD stay on Beijing calendar', async () => {
  const { dayKeyFromMs, formatLocalYMD } = await import('./dateUtils.ts')
  const beijingMorning = new Date('2026-07-29T20:00:00.000Z')
  assert.equal(formatLocalYMD(beijingMorning), '2026-07-30')
  assert.equal(dayKeyFromMs(beijingMorning.getTime()), '2026-07-30')
})

test('dayKeyFromIso uses Beijing calendar for ISO timestamps', async () => {
  const { dayKeyFromIso } = await import('./dateUtils.ts')
  assert.equal(dayKeyFromIso('2026-07-29T20:00:00.000Z'), '2026-07-30')
  assert.equal(dayKeyFromIso(''), '')
  assert.equal(dayKeyFromIso(undefined), '')
})

test('formatLocalDateTimeMinute uses Beijing wall clock', async () => {
  const { formatLocalDateTimeMinute } = await import('./dateUtils.ts')
  // 01:05 UTC == 09:05 Asia/Shanghai
  const instant = new Date('2026-07-30T01:05:00.000Z')
  assert.equal(formatLocalDateTimeMinute(instant), '2026-07-30T09:05')
})
