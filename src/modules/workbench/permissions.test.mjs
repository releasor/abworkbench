import assert from 'node:assert/strict'
import test from 'node:test'
import { canPromoteToMainline, canSubmitToPool } from './permissions.ts'

const base = {
  connected: false,
  localUserId: 'u1',
  leadIds: ['lead1'],
}

test('offline: anyone can promote own personal to local mainline', () => {
  assert.equal(
    canPromoteToMainline({ ...base, connected: false, actorId: 'u1', sourceSpace: 'personal', sourceAuthorId: 'u1' }),
    true,
  )
})

test('offline: cannot promote others personal', () => {
  assert.equal(
    canPromoteToMainline({ ...base, connected: false, actorId: 'u1', sourceSpace: 'personal', sourceAuthorId: 'u2' }),
    false,
  )
})

test('online: only lead can promote pool or personal to team mainline', () => {
  assert.equal(
    canPromoteToMainline({ ...base, connected: true, actorId: 'lead1', sourceSpace: 'pool', sourceAuthorId: 'u2' }),
    true,
  )
  assert.equal(
    canPromoteToMainline({ ...base, connected: true, actorId: 'u1', sourceSpace: 'pool', sourceAuthorId: 'u2' }),
    false,
  )
})

test('submitToPool requires connection', () => {
  assert.equal(canSubmitToPool({ connected: false }), false)
  assert.equal(canSubmitToPool({ connected: true }), true)
})
