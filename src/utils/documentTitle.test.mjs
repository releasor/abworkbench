import assert from 'node:assert/strict'
import test from 'node:test'

import { isPomodoroTitleActive, setPomodoroTitleActive } from './documentTitle.ts'

test('setPomodoroTitleActive toggles ownership flag', () => {
  setPomodoroTitleActive(false)
  assert.equal(isPomodoroTitleActive(), false)
  setPomodoroTitleActive(true)
  assert.equal(isPomodoroTitleActive(), true)
  setPomodoroTitleActive(false)
  assert.equal(isPomodoroTitleActive(), false)
})
