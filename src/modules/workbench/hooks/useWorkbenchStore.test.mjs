import assert from 'node:assert/strict'
import test from 'node:test'
import { useWorkbenchStore } from './useWorkbenchStore.ts'

function resetStore() {
  useWorkbenchStore.setState({
    user: { id: 'local', displayName: '我' },
    projects: [],
    tasks: [],
    hydrated: false,
    connection: { mode: 'offline', localUser: { id: 'local', displayName: '我' } },
    remotePool: [],
    remoteMainline: [],
    remoteLeadIds: [],
    remoteMembers: [],
    disconnectBanner: null,
  })
}

test('hydrate without electronAPI starts empty and marks hydrated', async () => {
  resetStore()
  delete globalThis.window
  await useWorkbenchStore.getState().hydrate()
  const s = useWorkbenchStore.getState()
  assert.equal(s.hydrated, true)
  assert.equal(s.projects.length, 0)
  assert.equal(s.user.id, 'local')
  assert.equal(s.connection.mode, 'offline')
})

test('hydrate loads { user, projects, tasks } from workbenchLocalGet', async () => {
  resetStore()
  globalThis.window = {
    electronAPI: {
      workbenchLocalGet: async () => ({
        user: { id: 'u1', displayName: 'Ada' },
        projects: [
          {
            id: 'p1',
            name: 'Alpha',
            leadIds: ['u1'],
            createdAt: '2026-08-21T00:00:00.000Z',
            updatedAt: '2026-08-21T00:00:00.000Z',
          },
        ],
        tasks: [],
      }),
    },
  }
  await useWorkbenchStore.getState().hydrate()
  const s = useWorkbenchStore.getState()
  assert.equal(s.hydrated, true)
  assert.equal(s.user.displayName, 'Ada')
  assert.equal(s.projects[0]?.name, 'Alpha')
  delete globalThis.window
})

test('createProject + createPersonalTask + tasksForProject (memory only)', async () => {
  resetStore()
  delete globalThis.window
  await useWorkbenchStore.getState().hydrate()
  useWorkbenchStore.getState().createProject('Beta')
  const projectId = useWorkbenchStore.getState().projects[0].id
  assert.ok(projectId)
  useWorkbenchStore.getState().createPersonalTask(projectId, 'Write store')
  const tasks = useWorkbenchStore.getState().tasksForProject(projectId)
  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].title, 'Write store')
  assert.equal(tasks[0].space, 'personal')
})

test('createProject returns id and opens with empty name', () => {
  resetStore()
  const id = useWorkbenchStore.getState().createProject('   ')
  assert.ok(id)
  assert.equal(useWorkbenchStore.getState().projects[0]?.name, '未命名项目')
  assert.equal(useWorkbenchStore.getState().projects[0]?.id, id)
})
