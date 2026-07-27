import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LOCAL_DATA_CHANGE_EVENT,
  appendLocalCollection,
  readLocalCollection,
  updateLocalCollection,
  writeLocalCollection,
  writeLocalValue,
} from './localData.ts'

function createStorage(seed = {}) {
  const data = new Map(Object.entries(seed))
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

function createDispatcher() {
  const events = []
  return {
    events,
    dispatchEvent: (event) => {
      events.push(event)
      return true
    },
  }
}

test('readLocalCollection falls back when JSON is invalid', () => {
  const storage = createStorage({ items: '{bad json' })

  assert.deepEqual(readLocalCollection('items', ['fallback'], storage), ['fallback'])
})

test('writeLocalCollection stores JSON and dispatches change event', () => {
  const storage = createStorage()
  const dispatcher = createDispatcher()

  writeLocalCollection('items', [{ id: 'a' }], storage, dispatcher)

  assert.deepEqual(JSON.parse(storage.getItem('items')), [{ id: 'a' }])
  assert.equal(dispatcher.events[0].type, LOCAL_DATA_CHANGE_EVENT)
  assert.equal(dispatcher.events[0].detail.key, 'items')
})

test('appendLocalCollection and updateLocalCollection mutate collections safely', () => {
  const storage = createStorage({ items: JSON.stringify([{ id: 'a', done: false }]) })

  appendLocalCollection('items', { id: 'b', done: false }, storage)
  updateLocalCollection('items', 'a', { done: true }, storage)

  assert.deepEqual(readLocalCollection('items', [], storage), [
    { id: 'b', done: false },
    { id: 'a', done: true },
  ])
})

test('writeLocalValue dispatches scalar changes', () => {
  const storage = createStorage()
  const dispatcher = createDispatcher()

  writeLocalValue('flag', 'true', storage, dispatcher)

  assert.equal(storage.getItem('flag'), 'true')
  assert.equal(dispatcher.events[0].detail.key, 'flag')
  assert.equal(dispatcher.events[0].detail.value, 'true')
})
