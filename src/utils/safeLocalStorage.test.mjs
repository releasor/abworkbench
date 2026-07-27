import assert from 'node:assert/strict'
import test from 'node:test'

import { safeGet, safeSet, safeGetString, safeSetString, getBool, setBool } from './safeLocalStorage.ts'

function createMockStorage(seed = {}) {
  const data = new Map(Object.entries(seed))
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

// --- safeGet ---

test('safeGet returns parsed JSON when key exists', () => {
  const storage = createMockStorage({ config: JSON.stringify({ a: 1 }) })
  globalThis.localStorage = storage

  assert.deepEqual(safeGet('config', {}), { a: 1 })

  delete globalThis.localStorage
})

test('safeGet returns default when key is missing', () => {
  const storage = createMockStorage()
  globalThis.localStorage = storage

  assert.deepEqual(safeGet('missing', [1, 2, 3]), [1, 2, 3])

  delete globalThis.localStorage
})

test('safeGet returns default when JSON is corrupted', () => {
  const storage = createMockStorage({ bad: '{not valid json' })
  globalThis.localStorage = storage

  assert.equal(safeGet('bad', 'fallback'), 'fallback')

  delete globalThis.localStorage
})

test('safeGet returns default when localStorage throws', () => {
  globalThis.localStorage = {
    getItem() { throw new Error('blocked') },
    setItem() {},
  }

  assert.equal(safeGet('x', 42), 42)

  delete globalThis.localStorage
})

// --- safeSet ---

test('safeSet writes JSON to localStorage', () => {
  const storage = createMockStorage()
  globalThis.localStorage = storage

  safeSet('items', [1, 2, 3])

  assert.equal(storage.getItem('items'), '[1,2,3]')

  delete globalThis.localStorage
})

test('safeSet silently ignores write failures', () => {
  globalThis.localStorage = {
    getItem() { return null },
    setItem() { throw new Error('quota exceeded') },
  }

  // Should not throw
  safeSet('key', 'value')

  delete globalThis.localStorage
})

// --- safeGetString ---

test('safeGetString returns stored string', () => {
  const storage = createMockStorage({ theme: 'dark' })
  globalThis.localStorage = storage

  assert.equal(safeGetString('theme', 'light'), 'dark')

  delete globalThis.localStorage
})

test('safeGetString returns default when key is missing', () => {
  const storage = createMockStorage()
  globalThis.localStorage = storage

  assert.equal(safeGetString('theme', 'light'), 'light')

  delete globalThis.localStorage
})

test('safeGetString returns default when localStorage throws', () => {
  globalThis.localStorage = {
    getItem() { throw new Error('blocked') },
    setItem() {},
  }

  assert.equal(safeGetString('x', 'default'), 'default')

  delete globalThis.localStorage
})

// --- safeSetString ---

test('safeSetString writes raw string to localStorage', () => {
  const storage = createMockStorage()
  globalThis.localStorage = storage

  safeSetString('theme', 'dark')

  assert.equal(storage.getItem('theme'), 'dark')

  delete globalThis.localStorage
})

test('safeSetString silently ignores write failures', () => {
  globalThis.localStorage = {
    getItem() { return null },
    setItem() { throw new Error('quota exceeded') },
  }

  // Should not throw
  safeSetString('key', 'value')

  delete globalThis.localStorage
})

// --- getBool ---

test('getBool returns true when stored value is "true"', () => {
  const storage = createMockStorage({ flag: 'true' })
  globalThis.localStorage = storage

  assert.equal(getBool('flag', false), true)

  delete globalThis.localStorage
})

test('getBool returns false when stored value is "false"', () => {
  const storage = createMockStorage({ flag: 'false' })
  globalThis.localStorage = storage

  assert.equal(getBool('flag', true), false)

  delete globalThis.localStorage
})

test('getBool returns default when key is missing', () => {
  const storage = createMockStorage()
  globalThis.localStorage = storage

  assert.equal(getBool('flag', true), true)
  assert.equal(getBool('flag', false), false)

  delete globalThis.localStorage
})

test('getBool returns default when localStorage throws', () => {
  globalThis.localStorage = {
    getItem() { throw new Error('blocked') },
    setItem() {},
  }

  assert.equal(getBool('x', true), true)

  delete globalThis.localStorage
})

// --- setBool ---

test('setBool writes "true"/"false" string', () => {
  const storage = createMockStorage()
  globalThis.localStorage = storage

  setBool('flag', true)
  assert.equal(storage.getItem('flag'), 'true')

  setBool('flag', false)
  assert.equal(storage.getItem('flag'), 'false')

  delete globalThis.localStorage
})

test('setBool silently ignores write failures', () => {
  globalThis.localStorage = {
    getItem() { return null },
    setItem() { throw new Error('quota exceeded') },
  }

  // Should not throw
  setBool('key', true)

  delete globalThis.localStorage
})

// --- round-trip ---

test('safeGet/safeSet round-trip preserves complex objects', () => {
  const storage = createMockStorage()
  globalThis.localStorage = storage

  const data = { nested: { arr: [1, 2, { x: true }], str: 'hello' } }
  safeSet('complex', data)
  assert.deepEqual(safeGet('complex', null), data)

  delete globalThis.localStorage
})

test('getBool/setBool round-trip preserves boolean values', () => {
  const storage = createMockStorage()
  globalThis.localStorage = storage

  setBool('a', true)
  setBool('b', false)
  assert.equal(getBool('a', false), true)
  assert.equal(getBool('b', true), false)

  delete globalThis.localStorage
})
