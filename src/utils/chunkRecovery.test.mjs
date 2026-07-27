import assert from 'node:assert/strict'
import test from 'node:test'

import { isStaleChunkError } from './chunkRecovery.ts'

test('isStaleChunkError detects dynamic import fetch failures', () => {
  assert.equal(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module')), true)
  assert.equal(isStaleChunkError(new Error('other')), false)
})
