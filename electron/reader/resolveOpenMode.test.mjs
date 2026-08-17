import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveOpenMode, sanitizeProgress } from './resolveOpenMode.ts'

test('auto with valid progress returns reading + bookId', () => {
  const r = resolveOpenMode('auto', {
    books: [{ id: 'b1', title: '书', source: 'local', path: 'C:\\a.txt', updatedAt: 1 }],
    progress: { bookId: 'b1', chapterIndex: 2, offset: 10, updatedAt: 2 },
    progressByBook: {
      b1: { bookId: 'b1', chapterIndex: 2, offset: 10, updatedAt: 2 },
    },
  }, () => true)
  assert.deepEqual(r, { mode: 'reading', bookId: 'b1' })
})

test('auto without progress returns library', () => {
  const r = resolveOpenMode('auto', { books: [], progress: null, progressByBook: {} })
  assert.deepEqual(r, { mode: 'library' })
})

test('auto with stale progress returns library', () => {
  const r = resolveOpenMode('auto', {
    books: [],
    progress: { bookId: 'missing', chapterIndex: 0, offset: 0, updatedAt: 1 },
    progressByBook: {
      missing: { bookId: 'missing', chapterIndex: 0, offset: 0, updatedAt: 1 },
    },
  })
  assert.deepEqual(r, { mode: 'library' })
})

test('library mode always library', () => {
  const r = resolveOpenMode('library', {
    books: [{ id: 'b1', title: '书', source: 'local', path: 'C:\\a.txt', updatedAt: 1 }],
    progress: { bookId: 'b1', chapterIndex: 0, offset: 0, updatedAt: 1 },
    progressByBook: {
      b1: { bookId: 'b1', chapterIndex: 0, offset: 0, updatedAt: 1 },
    },
  })
  assert.deepEqual(r, { mode: 'library' })
})

test('auto with missing local file returns library', () => {
  const r = resolveOpenMode('auto', {
    books: [{ id: 'b1', title: '书', source: 'local', path: 'C:\\gone.txt', updatedAt: 1 }],
    progress: { bookId: 'b1', chapterIndex: 0, offset: 0, updatedAt: 1 },
    progressByBook: {
      b1: { bookId: 'b1', chapterIndex: 0, offset: 0, updatedAt: 1 },
    },
  }, () => false)
  assert.deepEqual(r, { mode: 'library' })
})

test('sanitizeProgress clears missing local file', () => {
  const cleaned = sanitizeProgress({
    books: [{ id: 'b1', title: '书', source: 'local', path: 'C:\\gone.txt', updatedAt: 1 }],
    progress: { bookId: 'b1', chapterIndex: 0, offset: 0, updatedAt: 1 },
    progressByBook: {
      b1: { bookId: 'b1', chapterIndex: 0, offset: 0, updatedAt: 1 },
    },
  }, () => false)
  assert.equal(cleaned.progress, null)
  assert.equal(cleaned.progressByBook.b1, undefined)
})

test('sanitizeProgress clears web book without urls', () => {
  const cleaned = sanitizeProgress({
    books: [{ id: 'w1', title: 'web', source: 'web', updatedAt: 1 }],
    progress: { bookId: 'w1', chapterIndex: 0, offset: 0, updatedAt: 1 },
    progressByBook: {
      w1: { bookId: 'w1', chapterIndex: 0, offset: 0, updatedAt: 1 },
    },
  })
  assert.equal(cleaned.progress, null)
})

test('sanitizeProgress keeps other books when one is invalid', () => {
  const cleaned = sanitizeProgress({
    books: [
      { id: 'ok', title: '好', source: 'local', path: 'C:\\a.txt', updatedAt: 1 },
      { id: 'gone', title: '坏', source: 'local', path: 'C:\\gone.txt', updatedAt: 1 },
    ],
    progress: { bookId: 'gone', chapterIndex: 0, offset: 0, updatedAt: 9 },
    progressByBook: {
      ok: { bookId: 'ok', chapterIndex: 3, offset: 1, updatedAt: 5 },
      gone: { bookId: 'gone', chapterIndex: 0, offset: 0, updatedAt: 9 },
    },
  }, (p) => p.includes('a.txt'))
  assert.equal(cleaned.progressByBook.gone, undefined)
  assert.equal(cleaned.progress?.bookId, 'ok')
  assert.equal(cleaned.progress?.chapterIndex, 3)
})
