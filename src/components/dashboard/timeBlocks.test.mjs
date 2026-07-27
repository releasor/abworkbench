import assert from 'node:assert/strict'
import test from 'node:test'

import { buildTodayTimeBlocks } from './timeBlocks.ts'

const DAY = 86400000
const todayMidnightMs = Date.UTC(2026, 5, 9)

test('buildTodayTimeBlocks places due tasks, pomodoros and habits into today schedule', () => {
  const result = buildTodayTimeBlocks({
    todayStr: '2026-06-09',
    todayMidnightMs,
    tomorrowMidnightMs: todayMidnightMs + DAY,
    tasks: [
      {
        id: 'task-1',
        title: '写项目方案',
        completed: false,
        priority: 'high',
        createdAt: todayMidnightMs,
        dueDate: '2026-06-09',
      },
    ],
    habits: [
      { id: 'habit-1', name: '阅读', completedDates: [] },
    ],
    pomodoroSessions: [
      {
        id: 'p1',
        startedAt: todayMidnightMs + 10 * 3600000,
        endedAt: todayMidnightMs + 10 * 3600000 + 25 * 60000,
        type: 'work',
        completed: true,
      },
    ],
  })

  assert.equal(result.blocks.length, 14)
  assert.equal(result.blocks[0].hour, 8)
  assert.equal(result.blocks.at(-1).hour, 21)
  assert.equal(result.blocks.some((block) => block.items.some((item) => item.title === '写项目方案')), true)
  assert.equal(result.blocks.find((block) => block.hour === 10).items.some((item) => item.type === 'pomodoro'), true)
  assert.equal(result.blocks.find((block) => block.hour === 18).items.some((item) => item.title === '阅读'), true)
})

