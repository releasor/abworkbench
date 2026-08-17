import assert from 'node:assert/strict'
import test from 'node:test'

import { buildMacroLocalState, runLocalMacro } from './commandMacroRunner.ts'

function createStorage() {
  const data = new Map()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

test('buildMacroLocalState avoids navigating to removed workspace page', () => {
  assert.deepEqual(buildMacroLocalState('macro-clear-inbox'), { target: 'dashboard', inboxFilter: 'high' })
  assert.deepEqual(buildMacroLocalState('macro-project-scan'), { target: 'taskflow', projectScan: true })
})

test('runLocalMacro writes macro state and DND state', () => {
  const storage = createStorage()
  const result = runLocalMacro('macro-start-work', storage)

  assert.equal(result.targetPage, 'taskflow')
  assert.equal(storage.getItem('abworkbench-focus-dnd'), 'true')
  assert.equal(JSON.parse(storage.getItem('abworkbench-macro-state')).target, 'taskflow')
})
