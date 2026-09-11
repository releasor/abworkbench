import assert from 'node:assert/strict'
import test from 'node:test'

import {
  __resetHotlistStoreForTests,
  ensureHotlistPrefetch,
  getHotlistStoreSnapshot,
  refreshHotlist,
  setHotlistFetchersForTests,
  subscribeHotlistStore,
} from './hotlistStore.ts'

test('ensureHotlistPrefetch loads once and notifies subscribers', async () => {
  __resetHotlistStoreForTests()
  let calls = 0
  setHotlistFetchersForTests({
    platforms: async () => {
      calls += 1
      return [{ id: 'weibo', title: '微博', subtitle: '热搜' }]
    },
    batch: async (ids) =>
      ids.map((id) => ({
        id,
        title: '微博',
        updateTime: '2026-01-01T00:00:00.000Z',
        fromCache: false,
        items: [{ rank: 1, title: '甲', url: 'https://a.example' }],
      })),
  })

  let notifies = 0
  const unsub = subscribeHotlistStore(() => {
    notifies += 1
  })

  const first = ensureHotlistPrefetch()
  const second = ensureHotlistPrefetch()
  assert.equal(first, second)

  await first
  unsub()

  const snap = getHotlistStoreSnapshot()
  assert.equal(calls, 1)
  assert.equal(snap.loading, false)
  assert.equal(snap.error, null)
  assert.equal(snap.boards.length, 1)
  assert.equal(snap.boards[0].items[0].title, '甲')
  assert.ok(notifies >= 1)
})

test('refreshHotlist reloads with noCache and keeps prior boards until replaced', async () => {
  __resetHotlistStoreForTests()
  let batchCalls = 0
  setHotlistFetchersForTests({
    platforms: async () => [{ id: 'zhihu', title: '知乎' }],
    batch: async (ids, noCache) => {
      batchCalls += 1
      return ids.map((id) => ({
        id,
        title: '知乎',
        updateTime: '2026-01-01T00:00:00.000Z',
        fromCache: !noCache,
        items: [{ rank: 1, title: noCache ? '新' : '旧', url: 'https://z.example' }],
      }))
    },
  })

  await ensureHotlistPrefetch()
  assert.equal(getHotlistStoreSnapshot().boards[0].items[0].title, '旧')

  await refreshHotlist()
  assert.equal(batchCalls, 2)
  assert.equal(getHotlistStoreSnapshot().boards[0].items[0].title, '新')
  assert.equal(getHotlistStoreSnapshot().refreshing, false)
})
