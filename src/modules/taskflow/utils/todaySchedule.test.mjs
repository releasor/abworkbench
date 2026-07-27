import assert from 'node:assert/strict'
import test from 'node:test'

import { buildTodaySchedule } from './todaySchedule.ts'

test('buildTodaySchedule orders pinned, overdue and high priority tasks into today slots', () => {
  const schedule = buildTodaySchedule({
    today: '2026-06-09',
    startHour: 9,
    endHour: 12,
    tasks: [
      { id: 'low', title: '整理资料', status: 'todo', priority: 'low', pinned: false, archived: false, dueDate: '2026-06-09T00:00:00.000Z', estimatedMinutes: 30 },
      { id: 'pin', title: '置顶任务', status: 'todo', priority: 'medium', pinned: true, archived: false, dueDate: null, estimatedMinutes: 45 },
      { id: 'late', title: '逾期任务', status: 'todo', priority: 'high', pinned: false, archived: false, dueDate: '2026-06-08T00:00:00.000Z', estimatedMinutes: 60 },
      { id: 'done', title: '已完成', status: 'done', priority: 'urgent', pinned: true, archived: false, dueDate: '2026-06-09T00:00:00.000Z', estimatedMinutes: 15 },
    ],
  })

  assert.deepEqual(schedule.items.map((item) => item.taskId), ['pin', 'late', 'low'])
  assert.equal(schedule.items[0].slotLabel, '09:00')
  assert.equal(schedule.items[1].risk, 'overdue')
  assert.equal(schedule.totalMinutes, 135)
})
