import assert from 'node:assert/strict'
import test from 'node:test'
import { createHostRoom, applyHostCommand } from './hostRoomState.ts'

test('join registers member; non-lead cannot promote', () => {
  let room = createHostRoom({
    hostUser: { id: 'host', displayName: 'Host' },
    roomCode: 'ABCD',
    passphrase: '',
    nowIso: 't0',
  })
  room = applyHostCommand(room, {
    type: 'shareProject',
    project: { id: 'p1', name: 'P', leadIds: ['host'], createdAt: 't0', updatedAt: 't0' },
    mainlineSeed: [],
    nowIso: 't1',
  }).room
  room = applyHostCommand(room, {
    type: 'join',
    user: { id: 'u2', displayName: 'Bob' },
    passphrase: '',
    nowIso: 't2',
  }).room
  const denied = applyHostCommand(room, {
    type: 'promote',
    actorId: 'u2',
    projectId: 'p1',
    sourceTask: {
      id: 's1', projectId: 'p1', space: 'pool', title: 'X', status: 'todo',
      authorId: 'u2', order: 0, updatedAt: 't2',
    },
    nowIso: 't3',
  })
  assert.equal(denied.ok, false)
  assert.equal(room.members.some((m) => m.id === 'u2'), true)
})

test('lead promote from pool creates mainline task', () => {
  let room = createHostRoom({
    hostUser: { id: 'host', displayName: 'Host' },
    roomCode: 'ABCD',
    passphrase: '',
    nowIso: 't0',
  })
  room = applyHostCommand(room, {
    type: 'shareProject',
    project: { id: 'p1', name: 'P', leadIds: ['host'], createdAt: 't0', updatedAt: 't0' },
    mainlineSeed: [],
    nowIso: 't1',
  }).room
  room = applyHostCommand(room, {
    type: 'join',
    user: { id: 'u2', displayName: 'Bob' },
    passphrase: '',
    nowIso: 't2',
  }).room
  room = applyHostCommand(room, {
    type: 'submitToPool',
    actorId: 'u2',
    projectId: 'p1',
    task: {
      id: 's1',
      projectId: 'p1',
      space: 'pool',
      title: 'X',
      status: 'todo',
      authorId: 'u2',
      order: 0,
      updatedAt: 't2',
    },
    nowIso: 't3',
  }).room
  const promoted = applyHostCommand(room, {
    type: 'promote',
    actorId: 'host',
    projectId: 'p1',
    sourceTask: room.projects.p1.pool[0],
    nowIso: 't4',
  })
  assert.equal(promoted.ok, true)
  assert.equal(promoted.room.projects.p1.mainline.length, 1)
  assert.equal(promoted.room.projects.p1.mainline[0].sourceTaskId, 's1')
  assert.equal(promoted.room.projects.p1.mainline[0].authorId, 'u2')
})

test('wrong passphrase on join fails', () => {
  let room = createHostRoom({
    hostUser: { id: 'host', displayName: 'Host' },
    roomCode: 'ABCD',
    passphrase: 'secret',
    nowIso: 't0',
  })
  const denied = applyHostCommand(room, {
    type: 'join',
    user: { id: 'u2', displayName: 'Bob' },
    passphrase: 'wrong',
    nowIso: 't1',
  })
  assert.equal(denied.ok, false)
  assert.equal(denied.room.members.some((m) => m.id === 'u2'), false)
})

test('room accepts only one project', () => {
  let room = createHostRoom({
    hostUser: { id: 'host', displayName: 'Host' },
    roomCode: 'ABCD',
    passphrase: '',
    nowIso: 't0',
  })
  room = applyHostCommand(room, {
    type: 'shareProject',
    project: { id: 'p1', name: 'One', leadIds: ['host'], createdAt: 't0', updatedAt: 't0' },
    mainlineSeed: [],
    nowIso: 't1',
  }).room
  const second = applyHostCommand(room, {
    type: 'shareProject',
    project: { id: 'p2', name: 'Two', leadIds: ['host'], createdAt: 't0', updatedAt: 't0' },
    mainlineSeed: [],
    nowIso: 't2',
  })
  assert.equal(second.ok, false)
  assert.equal(Object.keys(room.projects).length, 1)
  assert.ok(room.projects.p1)

  const resync = applyHostCommand(room, {
    type: 'shareProject',
    project: { id: 'p1', name: 'One renamed', leadIds: ['host'], createdAt: 't0', updatedAt: 't0' },
    mainlineSeed: [],
    nowIso: 't3',
  })
  assert.equal(resync.ok, true)
  assert.equal(resync.room.projects.p1.project.name, 'One renamed')
})
