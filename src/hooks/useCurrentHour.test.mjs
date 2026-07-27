import assert from 'node:assert/strict'
import test from 'node:test'

import { getSystemHour } from './useCurrentHour.ts'

test('getSystemHour returns the hour from the provided system Date', () => {
  const morningInChina = new Date('2026-06-09T08:30:00+08:00')

  assert.equal(getSystemHour(morningInChina), morningInChina.getHours())
})
