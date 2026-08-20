import assert from 'node:assert/strict'
import test from 'node:test'

import { completeReminder, nextReminderDueAt } from './reminders.ts'

test('nextReminderDueAt rolls daily and weekly', () => {
  assert.equal(nextReminderDueAt('2026-07-30T09:00', 'once'), null)
  assert.equal(nextReminderDueAt('2026-07-30T09:00', 'daily'), '2026-07-31T09:00')
  assert.equal(nextReminderDueAt('2026-07-30T09:00', 'weekly'), '2026-08-06T09:00')
})

test('completeReminder keeps open when repeating', () => {
  const once = completeReminder({ id: '1', title: 'x', dueAt: '2026-07-30T09:00', repeat: 'once' })
  assert.equal(once.done, true)
  const daily = completeReminder({ id: '2', title: 'y', dueAt: '2026-07-30T09:00', repeat: 'daily' })
  assert.equal(daily.done, false)
  assert.equal(daily.dueAt, '2026-07-31T09:00')
})
