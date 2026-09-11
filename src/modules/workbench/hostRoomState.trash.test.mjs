import assert from 'node:assert/strict'
import test from 'node:test'
import { createHostRoom, applyHostCommand } from './hostRoomState.ts'

function setupRoom() {
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
  const submitted = applyHostCommand(room, {
    type: 'submitToTeamMainline',
    actorId: 'host',
    projectId: 'p1',
    sourceTask: {
      id: 's1', projectId: 'p1', space: 'mainline', title: 'Task A', status: 'todo',
      authorId: 'host', order: 0, updatedAt: 't2',
    },
    nowIso: 't3',
  })
  return submitted
}

test('delete moves team task to trash and logs activity', () => {
  const submitted = setupRoom()
  assert.equal(submitted.ok, true)
  const taskId = submitted.room.projects.p1.mainline[0].id
  const deleted = applyHostCommand(submitted.room, {
    type: 'deleteMainlineTask',
    actorId: 'host',
    projectId: 'p1',
    taskId,
    nowIso: 't4',
  })
  assert.equal(deleted.ok, true)
  assert.equal(deleted.room.projects.p1.mainline.length, 0)
  assert.equal(deleted.room.projects.p1.mainlineTrash.length, 1)
  assert.equal(deleted.room.projects.p1.mainlineTrash[0].task.title, 'Task A')
  assert.equal(deleted.room.projects.p1.activityLog.some((e) => e.action === 'deleted'), true)
})

test('restore brings task back from trash', () => {
  const submitted = setupRoom()
  const taskId = submitted.room.projects.p1.mainline[0].id
  const deleted = applyHostCommand(submitted.room, {
    type: 'deleteMainlineTask',
    actorId: 'host',
    projectId: 'p1',
    taskId,
    nowIso: 't4',
  }).room
  const restored = applyHostCommand(deleted, {
    type: 'restoreMainlineTask',
    actorId: 'host',
    projectId: 'p1',
    taskId,
    nowIso: 't5',
  })
  assert.equal(restored.ok, true)
  assert.equal(restored.room.projects.p1.mainline.length, 1)
  assert.equal(restored.room.projects.p1.mainlineTrash.length, 0)
})
