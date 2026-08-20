import assert from 'node:assert/strict'
import test from 'node:test'

import { buildHighlightParts, findTextMatches } from './readingFind.ts'

test('findTextMatches is case-insensitive and capped', () => {
  assert.deepEqual(findTextMatches('Hello HELLO hello', 'hello'), [0, 6, 12])
  assert.deepEqual(findTextMatches('aaa', 'a', 2), [0, 1])
  assert.deepEqual(findTextMatches('abc', '  '), [])
})

test('buildHighlightParts wraps matches', () => {
  const body = 'foo bar foo'
  const matches = findTextMatches(body, 'foo')
  const parts = buildHighlightParts(body, 'foo', matches)
  assert.equal(parts.length, 3)
  assert.equal(parts[0].hitIndex, 0)
  assert.equal(parts[1].text, ' bar ')
  assert.equal(parts[2].hitIndex, 1)
})
