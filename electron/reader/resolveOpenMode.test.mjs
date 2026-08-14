import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveOpenMode, sanitizeProgress } from './resolveOpenMode.ts'

test('auto with valid progress returns reading + bookId', () => {
  const r = resolveOpenMode('auto', {
    books: [{ id: 'b1', title: '书', source: 'local', path: 'C:\\a.txt', updatedAt: 1 }],
    progress: { bookId: 'b1', chapterIndex: 2, offset: 10, updatedAt: 2 },
  }, () => true)
  assert.deepEqual(r, { mode: 'reading', bookId: 'b1' })
})

test('auto without progress returns library', () => {
  const r = resolveOpenMode('auto', { books: [], progress: null })
  assert.deepEqual(r, { mode: 'library' })
})

test('auto with stale progress returns library', () => {
  const r = resolveOpenMode('auto', {
    books: [],
    progress: { bookId: 'missing', chapterIndex: 0, offset: 0, updatedAt: 1 },
  })
  assert.deepEqual(r, { mode: 'library' })
})

test('library mode always library', () => {
  const r = resolveOpenMode('library', {
    books: [{ id: 'b1', title: '书', source: 'local', path: 'C:\\a.txt', updatedAt: 1 }],
    progress: { bookId: 'b1', chapterIndex: 0, offset: 0, updatedAt: 1 },
  })
  assert.deepEqual(r, { mode: 'library' })
})

test('auto with missing local file returns library', () => {
  const r = resolveOpenMode('auto', {
    books: [{ id: 'b1', title: '书', source: 'local', path: 'C:\\gone.txt', updatedAt: 1 }],
    progress: { bookId: 'b1', chapterIndex: 0, offset: 0, updatedAt: 1 },
  }, () => false)
  assert.deepEqual(r, { mode: 'library' })
})

test('sanitizeProgress clears missing local file', () => {
  const cleaned = sanitizeProgress({
    books: [{ id: 'b1', title: '书', source: 'local', path: 'C:\\gone.txt', updatedAt: 1 }],
    progress: { bookId: 'b1', chapterIndex: 0, offset: 0, updatedAt: 1 },
  }, () => false)
  assert.equal(cleaned.progress, null)
})
