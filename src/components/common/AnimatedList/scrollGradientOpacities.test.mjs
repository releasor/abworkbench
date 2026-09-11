import assert from 'node:assert/strict'
import test from 'node:test'

import { scrollGradientOpacities } from './scrollGradientOpacities.ts'

test('scrollGradientOpacities starts with bottom fade when content overflows', () => {
  const { top, bottom } = scrollGradientOpacities(0, 800, 400)
  assert.equal(top, 0)
  assert.equal(bottom, 1)
})

test('scrollGradientOpacities clears bottom fade near the end', () => {
  const { top, bottom } = scrollGradientOpacities(400, 800, 400)
  assert.equal(top, 1)
  assert.equal(bottom, 0)
})

test('scrollGradientOpacities hides both fades when content fits', () => {
  const { top, bottom } = scrollGradientOpacities(0, 200, 400)
  assert.equal(top, 0)
  assert.equal(bottom, 0)
})
