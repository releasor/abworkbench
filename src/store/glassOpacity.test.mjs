import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  GLASS_OPACITY_DEFAULT,
  GLASS_OPACITY_MAX,
  GLASS_OPACITY_MIN,
  clampGlassOpacity,
} from './glassOpacity.ts'

describe('clampGlassOpacity', () => {
  it('defaults invalid values to 90', () => {
    assert.equal(clampGlassOpacity(undefined), GLASS_OPACITY_DEFAULT)
    assert.equal(clampGlassOpacity(null), GLASS_OPACITY_DEFAULT)
    assert.equal(clampGlassOpacity('80'), GLASS_OPACITY_DEFAULT)
    assert.equal(clampGlassOpacity(Number.NaN), GLASS_OPACITY_DEFAULT)
  })

  it('clamps to 40–100 and rounds', () => {
    assert.equal(clampGlassOpacity(10), GLASS_OPACITY_MIN)
    assert.equal(clampGlassOpacity(140), GLASS_OPACITY_MAX)
    assert.equal(clampGlassOpacity(72.4), 72)
    assert.equal(clampGlassOpacity(72.6), 73)
  })
})
