import assert from 'node:assert/strict'
import test from 'node:test'
import {
  encodeWorkbenchDragPayload,
  readWorkbenchDragPayload,
  shouldUpdateMainlineStatus,
  WORKBENCH_TASK_DRAG_MIME,
} from './workbenchDrag.ts'

test('shouldUpdateMainlineStatus detects status changes', () => {
  assert.equal(shouldUpdateMainlineStatus('todo', 'doing'), true)
  assert.equal(shouldUpdateMainlineStatus('doing', 'doing'), false)
})

test('workbench drag payload roundtrip', () => {
  const payload = { taskId: 't1', source: 'personalMainline' }
  const dataTransfer = {
    getData(type) {
      return type === WORKBENCH_TASK_DRAG_MIME ? encodeWorkbenchDragPayload(payload) : ''
    },
  }
  assert.deepEqual(readWorkbenchDragPayload(dataTransfer), payload)
})
