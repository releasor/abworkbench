import assert from 'node:assert/strict'
import test from 'node:test'

import { beijingYMD, beijingDateTimeMinute } from './beijingTime.ts'

test('beijingYMD formats Asia/Shanghai calendar day', () => {
  // 2026-07-29 16:00 UTC = 2026-07-30 00:00 Beijing
  const instant = new Date('2026-07-29T16:00:00.000Z')
  assert.equal(beijingYMD(instant), '2026-07-30')
})

test('beijingDateTimeMinute keeps Beijing wall clock', () => {
  const instant = new Date('2026-07-29T16:05:00.000Z')
  assert.equal(beijingDateTimeMinute(instant), '2026-07-30T00:05')
})
