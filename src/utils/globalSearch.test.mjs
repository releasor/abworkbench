import assert from 'node:assert/strict'
import test from 'node:test'

import { buildGlobalSearchResults, parseGlobalSearchQuery } from './globalSearch.ts'

const data = {
  tasks: [{ id: 't1', title: '写工作方案', description: '工作台', tags: ['工作'], category: 'cat-work', archived: false }],
  notes: [{ id: 'n1', title: '工作笔记', content: '会议记录' }],
  habits: [{ id: 'h1', name: '阅读' }],
  projects: [{ id: 'cat-work', name: '工作' }],
  files: [{ id: 'f1', name: '工作方案.docx', path: 'E:/work/工作方案.docx', projectId: 'cat-work' }],
}

test('parseGlobalSearchQuery extracts filters and text', () => {
  assert.deepEqual(parseGlobalSearchQuery('type:note project:工作 会议'), {
    text: '会议',
    type: 'note',
    project: '工作',
  })
})

test('buildGlobalSearchResults searches across local entities', () => {
  const results = buildGlobalSearchResults('工作', data)

  assert.equal(results.some((item) => item.type === 'task' && item.id === 't1'), true)
  assert.equal(results.some((item) => item.type === 'note' && item.id === 'n1'), true)
  assert.equal(results.some((item) => item.type === 'project' && item.id === 'cat-work'), true)
})

test('buildGlobalSearchResults supports type and project filters', () => {
  const results = buildGlobalSearchResults('type:task project:工作 工作台', data)

  assert.deepEqual(results.map((item) => item.type), ['task'])
  assert.equal(results[0].id, 't1')
})

test('buildGlobalSearchResults supports indexed files', () => {
  const results = buildGlobalSearchResults('type:file project:工作 方案', data)

  assert.deepEqual(results.map((item) => item.type), ['file'])
  assert.equal(results[0].id, 'f1')
})
