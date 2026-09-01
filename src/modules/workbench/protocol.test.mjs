import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decodeClientRequest,
  decodeServerEvent,
  encodeClientRequest,
  encodeServerEvent,
  formatSseData,
} from './protocol.ts'

test('encode/decode ClientRequest join roundtrip', () => {
  const req = {
    op: 'join',
    user: { id: 'u1', displayName: 'Ada' },
    passphrase: 'secret',
  }
  const raw = encodeClientRequest(req)
  const decoded = decodeClientRequest(raw)
  assert.deepEqual(decoded, req)
})

test('encode/decode ServerEvent snapshot roundtrip', () => {
  const ev = {
    type: 'snapshot',
    projectId: 'p1',
    pool: [],
    mainline: [],
    leadIds: ['u1'],
    members: [{ id: 'u1', displayName: 'Ada' }],
  }
  const raw = encodeServerEvent(ev)
  const decoded = decodeServerEvent(raw)
  assert.deepEqual(decoded, ev)
})

test('formatSseData wraps event as SSE data line', () => {
  const ev = { type: 'error', message: 'boom' }
  const line = formatSseData(ev)
  assert.ok(line.startsWith('data: '))
  assert.ok(line.endsWith('\n\n'))
  assert.deepEqual(JSON.parse(line.slice(6, -2)), ev)
})
