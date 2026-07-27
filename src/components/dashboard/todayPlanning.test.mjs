import assert from 'node:assert/strict'
import test from 'node:test'

import { buildEveningReview, buildMorningSuggestions } from './todayPlanning.ts'

const DAY = 86400000
const todayMidnightMs = Date.UTC(2026, 5, 9)
const tomorrowMidnightMs = todayMidnightMs + DAY
const yesterdayMidnightMs = todayMidnightMs - DAY

const baseInput = {
  todayStr: '2026-06-09',
  yesterdayStr: '2026-06-08',
  todayMidnightMs,
  tomorrowMidnightMs,
  dailyPomodoroGoal: 4,
  tasks: [
    {
      id: 'due-today',
      title: '提交周报',
      completed: false,
      priority: 'high',
      createdAt: todayMidnightMs + 9 * 3600000,
      dueDate: '2026-06-09',
    },
    {
      id: 'yesterday-open',
      title: '整理客户资料',
      completed: false,
      priority: 'medium',
      createdAt: yesterdayMidnightMs + 15 * 3600000,
      dueDate: '2026-06-08',
    },
    {
      id: 'done-today',
      title: '完成晨会纪要',
      completed: true,
      priority: 'low',
      createdAt: todayMidnightMs + 8 * 3600000,
      completedAt: todayMidnightMs + 10 * 3600000,
    },
  ],
  habits: [
    { id: 'read', name: '阅读', completedDates: [] },
    { id: 'walk', name: '散步', completedDates: ['2026-06-09'] },
  ],
  pomodoroSessions: [
    {
      id: 'p1',
      startedAt: todayMidnightMs + 9 * 3600000,
      endedAt: todayMidnightMs + 9 * 3600000 + 25 * 60000,
      type: 'work',
      completed: true,
    },
  ],
}

test('buildMorningSuggestions highlights due tasks, yesterday unfinished work, habits and pomodoro gap', () => {
  const result = buildMorningSuggestions(baseInput)

  assert.equal(result.mode, 'morning')
  assert.equal(result.title, '今日建议')
  assert.match(result.headline, /4 个重点/)

  const sections = Object.fromEntries(result.sections.map((section) => [section.id, section]))
  assert.match(sections.due.items[0].text, /提交周报/)
  assert.match(sections.carryover.items[0].text, /整理客户资料/)
  assert.match(sections.habits.items[0].text, /阅读/)
  assert.match(sections.pomodoro.items[0].text, /还差 3 个番茄/)
})

test('buildEveningReview summarizes completion, procrastination and tomorrow first action', () => {
  const result = buildEveningReview(baseInput)

  assert.equal(result.mode, 'evening')
  assert.equal(result.title, '晚间复盘')
  assert.match(result.headline, /完成 1 项/)

  const sections = Object.fromEntries(result.sections.map((section) => [section.id, section]))
  assert.match(sections.completed.items[0].text, /完成晨会纪要/)
  assert.match(sections.delayed.items[0].text, /整理客户资料/)
  assert.match(sections.tomorrow.items[0].text, /明天先处理/)
  assert.match(sections.tomorrow.items[0].text, /整理客户资料/)
})

