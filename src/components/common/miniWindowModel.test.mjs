import assert from 'node:assert/strict'
import test from 'node:test'

import { buildMiniWindowModel } from './miniWindowModel.ts'

const now = Date.UTC(2026, 5, 9, 9)

test('buildMiniWindowModel picks top three tasks and next reminder', () => {
  const model = buildMiniWindowModel({
    now,
    tasks: [
      { id: '1', title: '低优先级', status: 'todo', priority: 'low', pinned: false, archived: false, dueDate: '2026-06-09T00:00:00.000Z' },
      { id: '2', title: '置顶任务', status: 'todo', priority: 'medium', pinned: true, archived: false, dueDate: null },
      { id: '3', title: '紧急任务', status: 'todo', priority: 'urgent', pinned: false, archived: false, dueDate: '2026-06-09T00:00:00.000Z' },
      { id: '4', title: '已完成', status: 'done', priority: 'urgent', pinned: true, archived: false, dueDate: '2026-06-09T00:00:00.000Z' },
      { id: '5', title: '正在专注', status: 'in-progress', priority: 'high', pinned: false, archived: false, dueDate: null, timeEntries: [{ endTime: null }] },
    ],
    reminders: [
      { id: 'r0', title: '过期提醒', dueAt: '2026-06-09T08:00', done: false },
      { id: 'r1', title: '晚上提醒', dueAt: '2026-06-09T20:00', done: false },
      { id: 'r2', title: '已完成提醒', dueAt: '2026-06-09T10:00', done: true },
    ],
    pomodoroSessions: [],
  })

  assert.deepEqual(model.topTasks.map((task) => task.id), ['3', '2', '1'])
  assert.equal(model.nextReminder?.id, 'r0')
  assert.equal(model.reminderOverdue, true)
  assert.equal(model.activeTask?.id, '5')
})
