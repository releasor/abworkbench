import assert from 'node:assert/strict'
import test from 'node:test'

import { extractNoteLinkTokens, findRelatedTasksForNote } from './noteTaskLinks.ts'

test('extractNoteLinkTokens reads wiki links and hashtags', () => {
  const tokens = extractNoteLinkTokens('推进 [[工作台]]，记录 #工作 和 #project-alpha')

  assert.deepEqual(tokens, ['工作台', '工作', 'project-alpha'])
})

test('findRelatedTasksForNote matches task title, tags and category name', () => {
  const note = {
    id: 'note-1',
    title: '工作台会议',
    content: '今天讨论 [[工作台]] 和 #工作',
  }
  const tasks = [
    { id: 'task-1', title: '工作台命令中心', description: '', tags: [], category: 'cat-work', status: 'todo', archived: false },
    { id: 'task-2', title: '整理发票', description: '', tags: ['工作'], category: 'cat-home', status: 'done', archived: false },
    { id: 'task-3', title: '隐藏任务', description: '工作台', tags: [], category: 'cat-work', status: 'todo', archived: true },
  ]
  const categories = [
    { id: 'cat-work', name: '工作' },
    { id: 'cat-home', name: '生活' },
  ]

  const related = findRelatedTasksForNote(note, tasks, categories)

  assert.deepEqual(related.map((task) => task.id), ['task-1', 'task-2'])
})
