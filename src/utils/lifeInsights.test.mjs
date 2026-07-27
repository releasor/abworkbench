import assert from 'node:assert/strict'
import test from 'node:test'

import { buildLifeInsights } from './lifeInsights.ts'

test('buildLifeInsights creates actionable suggestions', () => {
  const insights = buildLifeInsights({
    tasks: [
      { id: 't1', title: '逾期合同', status: 'todo', dueDate: '2026-06-08', priority: 'urgent' },
      { id: 't2', title: '普通任务', status: 'todo', dueDate: null, priority: 'medium' },
    ],
    inboxOpen: 6,
    focusSessionsToday: 0,
    habits: [{ id: 'h1', name: '阅读', completedToday: false }],
    projectRisks: [{ projectName: '工作', riskLevel: 'high', reason: '1 个任务已逾期' }],
    now: Date.parse('2026-06-09T09:00:00+08:00'),
  })

  assert.equal(insights.some((item) => item.id === 'overdue-tasks' && item.severity === 'high'), true)
  assert.equal(insights.some((item) => item.id === 'inbox-pile'), true)
  assert.equal(insights.some((item) => item.id === 'focus-empty'), true)
  assert.equal(insights[0].action.length > 0, true)
})
