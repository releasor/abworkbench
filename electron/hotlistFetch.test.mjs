import test from 'node:test'
import assert from 'node:assert/strict'
import { HOTLIST_PLATFORMS } from './hotlistPlatforms.ts'
import { fetchHotlistBoard } from './hotlistFetch.ts'

test('HOTLIST_PLATFORMS includes primary and extended sources', () => {
  assert.equal(HOTLIST_PLATFORMS.length, 108)
  const ids = HOTLIST_PLATFORMS.map((p) => p.id)
  assert.equal(new Set(ids).size, ids.length, 'platform ids must be unique')
  assert.ok(ids.includes('weibo'))
  assert.ok(ids.includes('zhihu'))
  assert.ok(ids.includes('xiaohongshu'))
  assert.ok(ids.includes('douban-group'))
  assert.ok(ids.includes('bilibili'))
  assert.ok(ids.includes('zaker'))
})

test('fetchHotlistBoard returns structured board for v2ex', async () => {
  const board = await fetchHotlistBoard('v2ex', { noCache: true })
  assert.equal(board.id, 'v2ex')
  assert.equal(board.title, 'V2EX')
  if (board.error) {
    assert.equal(board.items.length, 0)
    return
  }
  assert.ok(board.items.length > 0)
  assert.ok(board.items[0].url.startsWith('http'))
})
