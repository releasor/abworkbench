import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDataHealthReport } from './dataHealth.ts'

test('buildDataHealthReport detects duplicate tasks and empty notes', () => {
  const report = buildDataHealthReport({
    todos: [],
    notes: [
      { id: 'n1', title: '空笔记', content: '' },
      { id: 'n2', title: '有效笔记', content: 'hello' },
      { id: 'n3', title: '', content: '有正文无标题' },
    ],
    pomodoroSessions: [],
    habits: [],
    taskFlowTasks: [
      { id: 't1', title: '重复任务', status: 'todo' },
      { id: 't2', title: '重复任务', status: 'todo' },
    ],
    backups: [{ modified: '2026-06-09T00:00:00.000Z' }],
  })

  assert.equal(report.backupStatus, 'ok')
  assert.equal(report.duplicateTaskCount, 1)
  assert.equal(report.emptyNoteCount, 1)
  assert.ok(report.issues.some((issue) => issue.id === 'untitled-notes'))
  assert.equal(report.issues.length >= 3, true)
})

