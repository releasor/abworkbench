import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAppContextMenuItems,
  buildPathContextMenuItems,
  buildReaderContextMenuItems,
} from './launcherContextMenu.ts'

test('app context menu includes open, reveal, pin, and remove', () => {
  const items = buildAppContextMenuItems({ pinned: false })
  assert.deepEqual(
    items.map((item) => item.id),
    ['open', 'reveal', 'pin', 'remove'],
  )
  assert.equal(items.find((item) => item.id === 'remove')?.danger, true)
})

test('app context menu switches pin label when already pinned', () => {
  const items = buildAppContextMenuItems({ pinned: true })
  assert.ok(items.some((item) => item.id === 'unpin'))
  assert.ok(!items.some((item) => item.id === 'pin'))
})

test('app context menu can omit reveal', () => {
  const items = buildAppContextMenuItems({ pinned: false, canReveal: false })
  assert.deepEqual(
    items.map((item) => item.id),
    ['open', 'pin', 'remove'],
  )
})

test('path context menu for files includes open, reveal, copy; remove optional', () => {
  const withoutRemove = buildPathContextMenuItems({ isDir: false })
  assert.deepEqual(
    withoutRemove.map((item) => item.id),
    ['open', 'reveal', 'copy-path'],
  )

  const withRemove = buildPathContextMenuItems({ isDir: true, canRemove: true })
  assert.deepEqual(
    withRemove.map((item) => item.id),
    ['open', 'reveal', 'copy-path', 'remove'],
  )
  assert.equal(withRemove[0]?.label, '打开目录')
})

test('reader context menu only offers library entry', () => {
  const items = buildReaderContextMenuItems()
  assert.deepEqual(items.map((item) => item.id), ['reader-library'])
})
