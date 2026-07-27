import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAchievements } from './achievements.ts'

const DAY = 86400000
const todayMidnightMs = Date.UTC(2026, 5, 9)

test('buildAchievements awards focus streak, habit streak, inbox zero and weekly review', () => {
  const result = buildAchievements({
    todayStr: '2026-06-09',
    todayMidnightMs,
    tasks: [{ id: 'done', completed: true }],
    habits: [{ id: 'h1', name: '阅读', completedDates: ['2026-06-07', '2026-06-08', '2026-06-09'] }],
    notes: [{ id: 'n1', title: '每周复盘', content: '', createdAt: todayMidnightMs }],
    pomodoroSessions: [0, 1, 2].map((offset) => ({
      id: `p${offset}`,
      startedAt: todayMidnightMs - offset * DAY + 9 * 3600000,
      endedAt: todayMidnightMs - offset * DAY + 10 * 3600000,
      type: 'work',
      completed: true,
    })),
  })

  assert.equal(result.badges.find((badge) => badge.id === 'focus-streak').unlocked, true)
  assert.equal(result.badges.find((badge) => badge.id === 'habit-streak').value, '3 天')
  assert.equal(result.badges.find((badge) => badge.id === 'inbox-zero').unlocked, true)
  assert.equal(result.badges.find((badge) => badge.id === 'weekly-review').unlocked, true)
})

