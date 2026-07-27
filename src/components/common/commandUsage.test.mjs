import assert from 'node:assert/strict'
import test from 'node:test'

import { recordCommandUse, sortCommandsByUsage } from './commandUsage.ts'

function createStorage() {
  const data = new Map()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

test('recordCommandUse tracks recent and frequent commands', () => {
  const storage = createStorage()
  recordCommandUse('nav-taskflow', storage, 100)
  recordCommandUse('nav-taskflow', storage, 200)
  recordCommandUse('new-note', storage, 300)

  const sorted = sortCommandsByUsage([
    { id: 'new-note', label: '新建笔记' },
    { id: 'nav-taskflow', label: '任务流' },
    { id: 'other', label: '其他' },
  ], storage)

  assert.deepEqual(sorted.map((item) => item.id), ['nav-taskflow', 'new-note', 'other'])
})
