import assert from 'node:assert/strict'
import test from 'node:test'
import { createHostRoom, applyHostCommand } from './hostRoomState.ts'

test('shareProject starts with empty team mainline by default', () => {
  let room = createHostRoom({
    hostUser: { id: 'host', displayName: 'Host' },
    roomCode: 'ABCD',
    passphrase: '',
    nowIso: 't0',
  })
  const shared = applyHostCommand(room, {
    type: 'shareProject',
    project: { id: 'p1', name: 'P', leadIds: ['host'], createdAt: 't0', updatedAt: 't0' },
    mainlineSeed: [],
    nowIso: 't1',
  })
  assert.equal(shared.ok, true)
  assert.equal(shared.room.projects.p1.mainline.length, 0)
})
