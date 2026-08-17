import assert from 'node:assert/strict'
import test from 'node:test'

import { LEGACY_CATEGORY_IDS, migrateLegacyTaskCategories } from './legacyCategoryMigrate.ts'

test('migrateLegacyTaskCategories rewrites known legacy ids', () => {
  const input = [
    { id: '1', category: 'work' },
    { id: '2', category: 'personal' },
    { id: '3', category: 'cat-study' },
  ]
  const out = migrateLegacyTaskCategories(input)
  assert.equal(out[0].category, 'cat-work')
  assert.equal(out[1].category, 'cat-personal')
  assert.equal(out[2].category, 'cat-study')
  assert.notEqual(out, input)
})

test('migrateLegacyTaskCategories returns same reference when unchanged', () => {
  const input = [{ id: '1', category: 'cat-work' }]
  assert.equal(migrateLegacyTaskCategories(input), input)
})

test('LEGACY_CATEGORY_IDS covers default category names', () => {
  assert.equal(LEGACY_CATEGORY_IDS.work, 'cat-work')
  assert.equal(LEGACY_CATEGORY_IDS.health, 'cat-health')
})
