import assert from 'node:assert/strict'
import test from 'node:test'

import { estimateChapterCount } from '../../../electron/reader/chapterCache.ts'

test('estimateChapterCount ignores nextUrl that duplicates last chapter url', () => {
  const count = estimateChapterCount({
    catalog: [],
    nextUrl: 'https://example.com/3',
    chapterUrls: ['https://example.com/1', 'https://example.com/2', 'https://example.com/3'],
  }, 2)
  assert.equal(count, 3)
})

test('estimateChapterCount grows when nextUrl is ahead', () => {
  const count = estimateChapterCount({
    catalog: [],
    nextUrl: 'https://example.com/4',
    chapterUrls: ['https://example.com/1', 'https://example.com/2', 'https://example.com/3'],
  }, 2)
  assert.equal(count, 4)
})
