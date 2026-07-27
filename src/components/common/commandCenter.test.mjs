import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCommandCenterSuggestions } from './commandCenter.ts'

const notes = [
  {
    id: 'n1',
    title: '项目复盘',
    content: '今天完成工作台命令中心设计',
    updatedAt: 10,
  },
  {
    id: 'n2',
    title: '健康记录',
    content: '睡眠和饮水',
    updatedAt: 20,
  },
]

test('buildCommandCenterSuggestions turns free text into a new task action', () => {
  const suggestions = buildCommandCenterSuggestions('整理发票', notes)

  assert.equal(suggestions[0].kind, 'create-task')
  assert.equal(suggestions[0].payload, '整理发票')
  assert.match(suggestions[0].label, /新建任务/)
})

test('buildCommandCenterSuggestions recognizes expense, health and reminder prefixes', () => {
  const expense = buildCommandCenterSuggestions('支出 午餐 36', notes)[0]
  const health = buildCommandCenterSuggestions('健康 跑步 20 分钟', notes)[0]
  const reminder = buildCommandCenterSuggestions('提醒 明天 10 点交材料', notes)[0]

  assert.equal(expense.kind, 'quick-expense')
  assert.equal(health.kind, 'quick-health')
  assert.equal(reminder.kind, 'quick-reminder')
})

test('buildCommandCenterSuggestions returns matching notes after action shortcuts', () => {
  const suggestions = buildCommandCenterSuggestions('工作台', notes)

  assert.equal(suggestions.some((item) => item.kind === 'open-note' && item.id === 'note-n1'), true)
})
