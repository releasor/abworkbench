import test from 'node:test'
import assert from 'node:assert/strict'

const store = new Map()
globalThis.sessionStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)) },
  removeItem: (key) => { store.delete(key) },
  clear: () => { store.clear() },
}

const {
  claimActivePomodoro,
  clearActivePomodoro,
  getActiveRemainingSec,
  isActivePomodoroRunning,
  isForeignActivePomodoro,
  pauseActivePomodoro,
  readActivePomodoro,
  resumeActivePomodoro,
  writeActivePomodoro,
} = await import('./activePomodoro.ts')

function reset() {
  store.clear()
  writeActivePomodoro(null)
}

test('claimActivePomodoro stores source and remaining', () => {
  reset()
  claimActivePomodoro({
    source: 'taskflow',
    mode: 'work',
    targetEnd: Date.now() + 60_000,
    remainingSec: 60,
  })
  const state = readActivePomodoro()
  assert.equal(state?.source, 'taskflow')
  assert.equal(state?.mode, 'work')
  assert.ok((state?.targetEnd || 0) > Date.now())
})

test('isForeignActivePomodoro detects other owners', () => {
  reset()
  claimActivePomodoro({
    source: 'focus',
    mode: 'work',
    targetEnd: Date.now() + 30_000,
    remainingSec: 30,
  })
  assert.equal(isForeignActivePomodoro('main'), true)
  assert.equal(isForeignActivePomodoro('focus'), false)
})

test('pause and resume ActivePomodoro keep remaining', () => {
  reset()
  const end = Date.now() + 90_000
  claimActivePomodoro({
    source: 'main',
    mode: 'work',
    targetEnd: end,
    remainingSec: 90,
  })
  assert.equal(isActivePomodoroRunning(), true)
  pauseActivePomodoro('main')
  const paused = readActivePomodoro()
  assert.equal(paused?.targetEnd, null)
  assert.ok((paused?.remainingSec || 0) >= 85)
  assert.equal(isActivePomodoroRunning(), false)
  resumeActivePomodoro('main')
  assert.equal(isActivePomodoroRunning(), true)
  assert.ok(getActiveRemainingSec(readActivePomodoro()) >= 80)
})

test('clearActivePomodoro respects source ownership', () => {
  reset()
  claimActivePomodoro({
    source: 'taskflow',
    mode: 'work',
    targetEnd: Date.now() + 10_000,
    remainingSec: 10,
  })
  clearActivePomodoro('main')
  assert.equal(readActivePomodoro()?.source, 'taskflow')
  clearActivePomodoro('taskflow')
  assert.equal(readActivePomodoro(), null)
})
