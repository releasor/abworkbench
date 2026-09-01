import assert from 'node:assert/strict'
import test from 'node:test'
import { mapLegacyStatus } from './statusMap.ts'

test('maps legacy statuses to three-state', () => {
  assert.equal(mapLegacyStatus('todo'), 'todo')
  assert.equal(mapLegacyStatus('in-progress'), 'doing')
  assert.equal(mapLegacyStatus('review'), 'doing')
  assert.equal(mapLegacyStatus('done'), 'done')
  assert.equal(mapLegacyStatus('unknown'), 'todo')
})
