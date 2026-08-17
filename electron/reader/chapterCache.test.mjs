import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  readCacheMeta,
  readChapterCache,
  resolveChapterUrl,
  estimateChapterCount,
  writeCacheMeta,
  writeChapterCache,
} from './chapterCache.ts'

test('chapter cache round-trip', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'abwb-cache-'))
  try {
    writeChapterCache(tmp, 'b1', 0, '正文A', '标题A')
    const cached = readChapterCache(tmp, 'b1', 0)
    assert.deepEqual(cached, { title: '标题A', body: '正文A' })
    assert.equal(readChapterCache(tmp, 'b1', 1), null)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('resolveChapterUrl prefers catalog then chapterUrls then nextUrl', () => {
  assert.equal(
    resolveChapterUrl({
      catalog: [{ title: '1', url: 'https://a/1' }, { title: '2', url: 'https://a/2' }],
      nextUrl: 'https://a/next',
      chapterUrls: ['https://a/1'],
    }, 1),
    'https://a/2',
  )
  assert.equal(
    resolveChapterUrl({
      catalog: [],
      nextUrl: 'https://a/2',
      chapterUrls: ['https://a/1'],
    }, 1),
    'https://a/2',
  )
  assert.equal(resolveChapterUrl(null, 0, 'https://a/0'), 'https://a/0')
  assert.equal(resolveChapterUrl({ catalog: [], nextUrl: null }, 3), null)
  // Jumping ahead of known chapterUrls must not invent nextUrl as chapter N.
  assert.equal(
    resolveChapterUrl({
      catalog: [],
      nextUrl: 'https://a/2',
      chapterUrls: ['https://a/1'],
    }, 5),
    null,
  )
  assert.equal(
    resolveChapterUrl({
      catalog: [],
      nextUrl: 'https://a/2',
      chapterUrls: ['https://a/1', ''],
    }, 2),
    null,
  )
  // Stale nextUrl equal to last known URL must not be reused as chapter N.
  assert.equal(
    resolveChapterUrl({
      catalog: [],
      nextUrl: 'https://a/1',
      chapterUrls: ['https://a/0', 'https://a/1'],
    }, 2),
    null,
  )
})

test('estimateChapterCount ignores stale duplicate nextUrl', () => {
  assert.equal(
    estimateChapterCount({
      catalog: [],
      nextUrl: 'https://a/1',
      chapterUrls: ['https://a/0', 'https://a/1'],
    }, 1),
    2,
  )
  assert.equal(
    estimateChapterCount({
      catalog: [],
      nextUrl: 'https://a/2',
      chapterUrls: ['https://a/0', 'https://a/1'],
    }, 1),
    3,
  )
})

test('writeCacheMeta then readCacheMeta', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'abwb-meta-'))
  try {
    writeCacheMeta(tmp, 'b2', {
      catalog: [{ title: 'x', url: 'https://x' }],
      nextUrl: 'https://y',
      chapterUrls: ['https://x'],
    })
    const meta = readCacheMeta(tmp, 'b2')
    assert.equal(meta?.nextUrl, 'https://y')
    assert.equal(meta?.catalog[0].url, 'https://x')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
