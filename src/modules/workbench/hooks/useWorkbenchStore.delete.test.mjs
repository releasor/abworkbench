import assert from 'node:assert/strict'
import test from 'node:test'
import { useWorkbenchStore } from './useWorkbenchStore.ts'

function resetStore() {
  useWorkbenchStore.setState({
    user: { id: 'host', displayName: 'Host' },
    projects: [{ id: 'p1', name: 'P', leadIds: ['host'], createdAt: 't0', updatedAt: 't0' }],
    tasks: [
      {
        id: 'local-1',
        projectId: 'p1',
        space: 'mainline',
        title: 'Personal',
        status: 'todo',
        authorId: 'host',
        assigneeId: 'host',
        order: 0,
        updatedAt: 't1',
      },
    ],
    hydrated: true,
    connection: {
      mode: 'hosting',
      projectId: 'p1',
      projectName: 'P',
      roomCode: 'ABCD',
      hostBaseUrl: 'http://127.0.0.1:1',
      lanUrls: [],
      localUser: { id: 'host', displayName: 'Host' },
    },
    remotePool: [],
    remoteMainline: [
      {
        id: 'local-1',
        projectId: 'p1',
        space: 'mainline',
        title: 'Team copy',
        status: 'todo',
        authorId: 'host',
        assigneeId: 'host',
        order: 0,
        updatedAt: 't2',
      },
    ],
    remoteLeadIds: ['host'],
    remoteMembers: [],
    disconnectBanner: null,
  })
}

test('delete personal mainline task only removes local copy', async () => {
  resetStore()
  delete globalThis.window
  const result = await useWorkbenchStore.getState().deleteMainlineTask('local-1', 'personalMainline')
  assert.equal(result.ok, true)
  assert.equal(useWorkbenchStore.getState().tasks.length, 0)
  assert.equal(useWorkbenchStore.getState().remoteMainline.length, 1)
})

test('delete team mainline task does not remove personal mainline task with same id', async () => {
  resetStore()
  delete globalThis.window
  const result = await useWorkbenchStore.getState().deleteMainlineTask('local-1', 'teamMainline')
  assert.equal(result.ok, false)
  assert.equal(useWorkbenchStore.getState().tasks.length, 1)
  assert.equal(useWorkbenchStore.getState().remoteMainline.length, 1)
})
