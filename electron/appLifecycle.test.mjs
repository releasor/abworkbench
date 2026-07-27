import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldQuitForExistingInstance } from './appLifecycle.ts'

test('shouldQuitForExistingInstance exits when another instance owns the lock', () => {
  assert.equal(shouldQuitForExistingInstance(false), true)
})

test('shouldQuitForExistingInstance continues when this instance owns the lock', () => {
  assert.equal(shouldQuitForExistingInstance(true), false)
})
