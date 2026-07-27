import assert from 'node:assert/strict'
import test from 'node:test'

import { buildLifeReport } from './lifeReports.ts'

const data = {
  tasks: [
    { id: 't1', title: '完成方案', status: 'done', completedAt: '2026-06-08T10:00:00+08:00', dueDate: '2026-06-07', priority: 'high', category: 'work' },
    { id: 't2', title: '拖延合同', status: 'todo', completedAt: null, dueDate: '2026-06-01', priority: 'urgent', category: 'work' },
  ],
  habits: [{ id: 'h1', name: '阅读', completedDates: ['2026-06-08', '2026-06-09'] }],
  pomodoroSessions: [
    { completed: true, type: 'work', startedAt: Date.parse('2026-06-08T09:00:00+08:00'), duration: 25 },
    { completed: true, type: 'work', startedAt: Date.parse('2026-06-09T09:00:00+08:00'), duration: 25 },
  ],
  notes: [{ id: 'n1', title: '复盘', content: '项目推进顺利', updatedAt: Date.parse('2026-06-09T20:00:00+08:00') }],
  projects: [{ id: 'work', name: '工作' }],
}

test('buildLifeReport creates weekly markdown with metrics and suggestions', () => {
  const report = buildLifeReport({ ...data, period: 'weekly', referenceDate: '2026-06-09' })

  assert.equal(report.title, '周报 - 2026-06-09')
  assert.equal(report.metrics.completedTasks, 1)
  assert.equal(report.metrics.focusSessions, 2)
  assert.equal(report.metrics.overdueTasks, 1)
  assert.equal(report.markdown.includes('## 本周完成'), true)
  assert.equal(report.markdown.includes('完成方案'), true)
  assert.equal(report.markdown.includes('拖延合同'), true)
})

test('buildLifeReport creates monthly markdown with project summary', () => {
  const report = buildLifeReport({ ...data, period: 'monthly', referenceDate: '2026-06-09' })

  assert.equal(report.title, '月报 - 2026-06')
  assert.equal(report.markdown.includes('## 项目概览'), true)
  assert.equal(report.markdown.includes('工作'), true)
  assert.equal(report.markdown.includes('下月建议'), true)
})
