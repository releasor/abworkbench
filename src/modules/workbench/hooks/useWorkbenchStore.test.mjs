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

test('createProject + createMainlineTask + tasksForProject (memory only)', async () => {
  resetStore()
  delete globalThis.window
  await useWorkbenchStore.getState().hydrate()
  useWorkbenchStore.getState().createProject('Beta')
  const projectId = useWorkbenchStore.getState().projects[0].id
  assert.ok(projectId)
  useWorkbenchStore.getState().createMainlineTask(projectId, 'Write store')
  const tasks = useWorkbenchStore.getState().tasksForProject(projectId)
  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].title, 'Write store')
  assert.equal(tasks[0].space, 'mainline')
})

test('createProject returns id and opens with empty name', () => {
  resetStore()
  const id = useWorkbenchStore.getState().createProject('   ')
  assert.ok(id)
  assert.equal(useWorkbenchStore.getState().projects[0]?.name, '未命名项目')
  assert.equal(useWorkbenchStore.getState().projects[0]?.id, id)
})

test('visiblePool returns stable empty list while offline', () => {
  resetStore()
  const first = useWorkbenchStore.getState().visiblePool('p1')
  const second = useWorkbenchStore.getState().visiblePool('p1')
  assert.equal(first.length, 0)
  assert.equal(first, second)
})

test('teamActivityLog and teamMainlineTrash filter by live project', () => {
  resetStore()
  useWorkbenchStore.setState({
    connection: {
      mode: 'hosting',
      projectId: 'p1',
      localUser: { id: 'u1', displayName: 'Lead' },
    },
    remoteActivityLog: [
      {
        id: 'a1',
        projectId: 'p1',
        timestamp: '2026-09-11T00:00:00.000Z',
        actorId: 'u1',
        action: 'deleted',
        taskId: 't1',
        taskTitle: 'Task A',
      },
      {
        id: 'a2',
        projectId: 'p2',
        timestamp: '2026-09-11T00:00:00.000Z',
        actorId: 'u1',
        action: 'deleted',
        taskId: 't2',
        taskTitle: 'Other',
      },
    ],
    remoteMainlineTrash: [
      {
        task: {
          id: 't1',
          projectId: 'p1',
          title: 'Task A',
          status: 'todo',
          space: 'mainline',
          order: 0,
          createdAt: '2026-09-11T00:00:00.000Z',
          updatedAt: '2026-09-11T00:00:00.000Z',
        },
        deletedAt: '2026-09-11T00:00:00.000Z',
        deletedBy: 'u1',
      },
    ],
  })

  const log = useWorkbenchStore.getState().teamActivityLog('p1')
  const trash = useWorkbenchStore.getState().teamMainlineTrash('p1')
  assert.equal(log.length, 1)
  assert.equal(log[0].taskTitle, 'Task A')
  assert.equal(trash.length, 1)
  assert.equal(trash[0].task.title, 'Task A')
  assert.equal(useWorkbenchStore.getState().teamActivityLog('p2').length, 0)
})
