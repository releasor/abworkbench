import assert from 'node:assert/strict'
import test from 'node:test'

import { buildHeaderDockSlots } from './headerDockModel.ts'

test('buildHeaderDockSlots returns quick-nav order with badges', () => {
  const slots = buildHeaderDockSlots({
    activePage: 'habits',
    labels: {
      pomodoro: '番茄钟',
      habits: '习惯',
      notes: '笔记',
      weather: '天气',
    },
    badges: {
      pomodoro: '0/2',
      habits: '3/3',
      pomodoroGoalMet: false,
      habitsAllDone: true,
    },
  })

  assert.deepEqual(
    slots.map((s) => s.id),
    ['pomodoro', 'habits', 'notes', 'weather'],
  )

  const habits = slots.find((s) => s.id === 'habits')
  assert.equal(habits?.kind, 'nav')
  assert.equal(habits?.active, true)
  assert.equal(habits?.badgeText, '3/3')
  assert.equal(habits?.badgeTone, 'success')

  const pomo = slots.find((s) => s.id === 'pomodoro')
  assert.equal(pomo?.kind, 'nav')
  assert.equal(pomo?.active, false)
  assert.equal(pomo?.badgeText, '0/2')
  assert.equal(pomo?.badgeTone, 'primary')
})
