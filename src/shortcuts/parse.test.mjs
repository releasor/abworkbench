import assert from 'node:assert/strict'
import test from 'node:test'
import {
  acceleratorFromEvent,
  formatAccelerator,
  matchesAccelerator,
  normalizeAccelerator,
  parseAccelerator,
  toElectronAccelerator,
} from './parse.ts'

test('parses ctrl+alt+space', () => {
  const parsed = parseAccelerator('Ctrl+Alt+Space')
  assert.ok(parsed)
  assert.equal(parsed.ctrl, true)
  assert.equal(parsed.alt, true)
  assert.equal(parsed.key, ' ')
  assert.equal(normalizeAccelerator('ctrl+alt+space'), 'Ctrl+Alt+Space')
})

test('formats and converts to electron accelerator', () => {
  assert.equal(formatAccelerator({ ctrl: true, alt: false, shift: true, meta: false, key: ' ' }), 'Ctrl+Shift+Space')
  assert.equal(toElectronAccelerator('Ctrl+Shift+Space'), 'CommandOrControl+Shift+Space')
})

test('matches keyboard events', () => {
  const event = {
    key: 'k',
    code: 'KeyK',
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  }
  assert.equal(matchesAccelerator(event, 'Ctrl+K'), true)
  assert.equal(matchesAccelerator(event, 'Ctrl+Alt+K'), false)
})

test('builds accelerator from event', () => {
  const event = {
    key: ' ',
    code: 'Space',
    ctrlKey: true,
    metaKey: false,
    altKey: true,
    shiftKey: false,
  }
  assert.equal(acceleratorFromEvent(event), 'Ctrl+Alt+Space')
})
