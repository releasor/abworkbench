import assert from 'node:assert/strict'
import test from 'node:test'

import { dockLabelAnimateY, dockLabelClassName } from './dockLabelPlacement.ts'

test('dockLabelClassName marks above vs below placement', () => {
  assert.equal(dockLabelClassName('above'), 'dock-label dock-label--above')
  assert.equal(dockLabelClassName('below', 'extra'), 'dock-label dock-label--below extra')
})

test('dockLabelAnimateY moves below labels downward and above labels upward', () => {
  assert.ok(dockLabelAnimateY('below') > 0)
  assert.ok(dockLabelAnimateY('above') < 0)
})
