import assert from 'node:assert/strict'
import test from 'node:test'

import { clearTaskFlowLocalData } from './desktopBackup.ts'

function createMockStorage(seed = {}) {
  const data = new Map(Object.entries(seed))
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    _data: data,
  }
}

test('clearTaskFlowLocalData removes tasks, categories, backups and prefs', () => {
  const storage = createMockStorage({
    'taskflow-offline-tasks': '[]',
    'taskflow-offline-categories': '[]',
    'taskflow-offline-backups': '[]',
    'taskflow-viewMode': 'kanban',
    'taskflow-sort-by': 'priority',
    'abworkbench-reminders': '[{"id":"r1"}]',
    'dashboard-storage': '{}',
  })
  globalThis.localStorage = storage

  clearTaskFlowLocalData()

  assert.equal(storage.getItem('taskflow-offline-tasks'), null)
  assert.equal(storage.getItem('taskflow-offline-categories'), null)
  assert.equal(storage.getItem('taskflow-offline-backups'), null)
  assert.equal(storage.getItem('taskflow-viewMode'), null)
  assert.equal(storage.getItem('taskflow-sort-by'), null)
  assert.equal(storage.getItem('abworkbench-reminders'), null)
  assert.equal(storage.getItem('dashboard-storage'), '{}')

  delete globalThis.localStorage
})
