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
  assert.deepEqual(buildMacroLocalState('macro-clear-inbox'), { target: 'taskflow', clearInbox: true })
  assert.deepEqual(buildMacroLocalState('macro-project-scan'), { target: 'taskflow', projectScan: true })
  assert.deepEqual(buildMacroLocalState('macro-bulk-import'), { target: 'taskflow', bulkImport: true })
})

test('runLocalMacro evening review targets notes', () => {
  const result = runLocalMacro('macro-evening-review')
  assert.equal(result.targetPage, 'notes')
  assert.equal(result.createEveningReview, true)
})

test('runLocalMacro writes macro state and DND state', () => {
  const storage = createStorage()
  const result = runLocalMacro('macro-start-work', storage)

  assert.equal(result.targetPage, 'taskflow')
  assert.equal(storage.getItem('abworkbench-focus-dnd'), 'true')
  const state = JSON.parse(storage.getItem('abworkbench-macro-state'))
  assert.equal(state.target, 'taskflow')
  assert.equal(state.startWork, true)
})
