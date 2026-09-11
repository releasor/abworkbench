import assert from 'node:assert/strict'
import test from 'node:test'

import { buildWorkbenchProjectOverview } from './projectOverview.ts'

const projects = [
  { id: 'p1', name: '第一个项目' },
  { id: 'p2', name: '空项目' },
  { id: 'p3', name: '收尾项目' },
]

const tasks = [
  { projectId: 'p1', title: '进行中任务', status: 'doing', dueDate: null, order: 1 },
  { projectId: 'p1', title: '待办任务', status: 'todo', dueDate: '2026-09-10', order: 2 },
  { projectId: 'p1', title: '已完成', status: 'done', dueDate: null, order: 0 },
  { projectId: 'p3', title: '最后一项', status: 'done', dueDate: null, order: 0 },
  { projectId: 'p3', title: '快完成', status: 'todo', dueDate: null, order: 1 },
]

test('buildWorkbenchProjectOverview maps workbench projects and task progress', () => {
  const rows = buildWorkbenchProjectOverview(projects, tasks)

  assert.equal(rows.length, 3)
  assert.equal(rows[0].id, 'p1')
  assert.equal(rows[0].name, '第一个项目')
  assert.equal(rows[0].total, 3)
  assert.equal(rows[0].active, 2)
  assert.equal(rows[0].progress, 33)
  assert.equal(rows[0].nextTitle, '进行中任务')
})

test('buildWorkbenchProjectOverview includes empty projects so dashboard matches workbench list', () => {
  const rows = buildWorkbenchProjectOverview(projects, tasks)
  const empty = rows.find((r) => r.id === 'p2')
  assert.ok(empty)
  assert.equal(empty.total, 0)
  assert.equal(empty.active, 0)
  assert.equal(empty.progress, 0)
  assert.equal(empty.nextTitle, null)
})

test('buildWorkbenchProjectOverview sorts by active work then caps the list', () => {
  const rows = buildWorkbenchProjectOverview(projects, tasks, 2)
  assert.deepEqual(rows.map((r) => r.id), ['p1', 'p3'])
})

test('buildWorkbenchProjectOverview prefers due-date order among todo tasks', () => {
  const rows = buildWorkbenchProjectOverview(
    [{ id: 'p', name: 'P' }],
    [
      { projectId: 'p', title: '晚点', status: 'todo', dueDate: '2026-09-20', order: 0 },
      { projectId: 'p', title: '早点', status: 'todo', dueDate: '2026-09-11', order: 1 },
    ],
  )
  assert.equal(rows[0].nextTitle, '早点')
})
