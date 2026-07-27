import assert from 'node:assert/strict'
import test from 'node:test'

import { parseQuickCreateInput } from './quickCreateParser.ts'

test('parseQuickCreateInput extracts task planning fields', () => {
  const result = parseQuickCreateInput('明天 10点 高精力 45分钟 #工作 完成方案 / 拆需求 / 写初稿', {
    today: '2026-06-09',
    projects: [{ id: 'work', name: '工作' }],
  })

  assert.equal(result.kind, 'task')
  assert.equal(result.title, '完成方案')
  assert.equal(result.dueDate, '2026-06-10')
  assert.equal(result.dueTime, '10:00')
  assert.equal(result.estimatedMinutes, 45)
  assert.equal(result.energyLevel, 'high')
  assert.equal(result.projectId, 'work')
  assert.deepEqual(result.tags, ['工作'])
  assert.deepEqual(result.subtasks, ['拆需求', '写初稿'])
})

test('parseQuickCreateInput detects recurring reminders', () => {
  const result = parseQuickCreateInput('每周 提醒 周五 18:30 复盘 #工作', {
    today: '2026-06-09',
    projects: [{ id: 'work', name: '工作' }],
  })

  assert.equal(result.kind, 'reminder')
  assert.equal(result.title, '复盘')
  assert.equal(result.repeat, 'weekly')
  assert.equal(result.dueDate, '2026-06-12')
  assert.equal(result.dueTime, '18:30')
  assert.equal(result.projectId, 'work')
})

test('parseQuickCreateInput supports low energy notes without date', () => {
  const result = parseQuickCreateInput('笔记 低精力 读书摘录 #学习', {
    today: '2026-06-09',
    projects: [{ id: 'study', name: '学习' }],
  })

  assert.equal(result.kind, 'note')
  assert.equal(result.title, '读书摘录')
  assert.equal(result.energyLevel, 'low')
  assert.equal(result.projectId, 'study')
  assert.equal(result.dueDate, null)
})

test('parseQuickCreateInput recognizes project creation intent', () => {
  const result = parseQuickCreateInput('项目 新官网 #工作', {
    today: '2026-06-09',
    projects: [{ id: 'work', name: '工作' }],
  })

  assert.equal(result.kind, 'project')
  assert.equal(result.title, '新官网')
  assert.deepEqual(result.tags, ['工作'])
})
