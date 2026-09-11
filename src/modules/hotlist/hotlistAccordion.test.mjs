import assert from 'node:assert/strict'
import test from 'node:test'

import { buildHotlistCover, mapHotlistItemsToAccordion } from './hotlistAccordion.ts'

test('buildHotlistCover returns stable svg data url', () => {
  const a = buildHotlistCover('测试标题', 1, 'weibo')
  const b = buildHotlistCover('测试标题', 1, 'weibo')
  const c = buildHotlistCover('测试标题', 2, 'weibo')
  assert.match(a, /^data:image\/svg\+xml/)
  assert.equal(a, b)
  assert.notEqual(a, c)
})

test('mapHotlistItemsToAccordion keeps top N with labels and links', () => {
  const panels = mapHotlistItemsToAccordion(
    [
      { rank: 1, title: '甲', url: 'https://a.example', hot: '100万' },
      { rank: 2, title: '乙', url: 'https://b.example' },
      { rank: 3, title: '丙', url: 'https://c.example' },
      { rank: 4, title: '丁', url: 'https://d.example' },
    ],
    'zhihu',
    3,
  )
  assert.equal(panels.length, 3)
  assert.equal(panels[0].link, 'https://a.example')
  assert.match(panels[0].label, /1\. 甲/)
  assert.match(panels[0].image, /^data:image\/svg\+xml/)
})
