import { create } from 'zustand'
import { safeGetString, safeSetString } from '../../../utils/safeLocalStorage.ts'
import { showToast } from '../../taskflow/utils/toastEvent.ts'
import { createLanClient, type LanClient } from '../lanClient.ts'
import {
  createEmptyLocalState,
  reduceLocal,
  type LocalAction,
  type LocalWorkbenchState,
} from '../localState.ts'
import type { ServerEvent } from '../protocol.ts'
import type {
  ConnectionState,
  WorkbenchTask,
  WorkbenchUser,
} from '../types.ts'

const USER_ID_KEY = 'workbench-user-id'
const PERSIST_DEBOUNCE_MS = 300

function electronApi() {
  return typeof window !== 'undefined' ? window.electronAPI : undefined
}

function resolveDefaultUser(): WorkbenchUser {
  let id = safeGetString(USER_ID_KEY, '')
  if (!id) {
    id = 'local'
    safeSetString(USER_ID_KEY, id)
  }
  return { id, displayName: '我' }
}

function looksLikeLocalState(value: unknown): value is LocalWorkbenchState {
  if (!value || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  return Boolean(o.user) && Array.isArray(o.projects) && Array.isArray(o.tasks)
}

function pickLocal(state: LocalWorkbenchState): LocalWorkbenchState {
  return {
    user: state.user,
    projects: state.projects,
    tasks: state.tasks,
  }
}

function sortByOrder(tasks: WorkbenchTask[]): WorkbenchTask[] {
  return tasks.slice().sort((a, b) => a.order - b.order)
}

function upsertById(list: WorkbenchTask[], task: WorkbenchTask): WorkbenchTask[] {
  const idx = list.findIndex((t) => t.id === task.id)
  if (idx < 0) return [...list, task]
  const next = list.slice()
  next[idx] = task
  return next
}

function isServerEvent(ev: unknown): ev is ServerEvent {
  return Boolean(ev && typeof ev === 'object' && typeof (ev as { type?: unknown }).type === 'string')
}

type TaskUpdatePatch = Extract<LocalAction, { type: 'task/update' }>['patch']

export interface WorkbenchStore extends LocalWorkbenchState {
  hydrated: boolean
  connection: ConnectionState
  remotePool: WorkbenchTask[]
  remoteMainline: WorkbenchTask[]
  remoteLeadIds: string[]
  remoteMembers: WorkbenchUser[]
  disconnectBanner: string | null

  hydrate: () => Promise<void>
  createProject: (name: string) => string
  renameProject: (projectId: string, name: string) => void
  createPersonalTask: (projectId: string, title: string) => void
  updateTask: (taskId: string, patch: TaskUpdatePatch) => void
  promoteToLocalMainline: (taskId: string) => void
  deleteMainlineTask: (taskId: string) => Promise<{ ok: true } | { ok: false; error: string }>
  isOnMainline: (sourceTaskId: string, projectId: string) => boolean
  importLegacyIntoProject: (projectId: string) => Promise<{ ok: true; count: number } | { ok: false; error: string }>
  tasksForProject: (projectId: string) => WorkbenchTask[]

  startHosting: (opts: { projectId: string; passphrase?: string }) => Promise<{ ok: true } | { ok: false; error: string }>
  joinRoom: (opts: {
    baseUrl: string
    passphrase?: string
    displayName?: string
    projectId?: string
  }) => Promise<{ ok: true; projectId: string } | { ok: false; error: string }>
  disconnect: (opts?: { reason?: 'manual' | 'heartbeat' }) => Promise<void>
  isLiveForProject: (projectId: string) => boolean
  submitToPool: (taskId: string) => Promise<{ ok: true } | { ok: false; error: string }>
  promoteRemote: (sourceTask: WorkbenchTask) => Promise<{ ok: true } | { ok: false; error: string }>
  updateRemoteMainlineTask: (
    taskId: string,
    patch: Partial<Pick<WorkbenchTask, 'title' | 'status' | 'dueDate' | 'description' | 'assigneeId' | 'order'>>,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  retryPendingPool: () => Promise<void>
  isLead: () => boolean
  visibleMainline: (projectId: string) => WorkbenchTask[]
  visiblePool: (projectId?: string) => WorkbenchTask[]
  findTaskEverywhere: (taskId: string) => WorkbenchTask | null
  unsyncedLocalMainline: (projectId: string) => WorkbenchTask[]
  submitLocalMainlineToPool: (projectId: string) => Promise<void>
  clearDisconnectBanner: () => void
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
let hydrateInFlight: Promise<void> | null = null
let unsubscribeEvents: (() => void) | null = null
let activeClient: LanClient | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let heartbeatFails = 0
let lastSnapshotAt: string | null = null

const HEARTBEAT_MS = 5000
const HEARTBEAT_FAIL_LIMIT = 2

function clearHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  heartbeatFails = 0
}

function clearLanSubscription(): void {
  clearHeartbeat()
  if (unsubscribeEvents) {
    unsubscribeEvents()
    unsubscribeEvents = null
  }
  activeClient = null
}

function startHeartbeat(get: () => WorkbenchStore): void {
  clearHeartbeat()
  heartbeatTimer = setInterval(() => {
    const client = activeClient
    const mode = get().connection.mode
    if (!client || mode === 'offline') return
    void client.listProjects().then((result) => {
      if (result.ok) {
        heartbeatFails = 0
        return
      }
      heartbeatFails += 1
      if (heartbeatFails >= HEARTBEAT_FAIL_LIMIT) {
        void get().disconnect({ reason: 'heartbeat' })
      }
    })
  }, HEARTBEAT_MS)
}

function schedulePersist(state: LocalWorkbenchState): void {
  const save = electronApi()?.workbenchLocalSet
  if (!save) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void save(pickLocal(state))
  }, PERSIST_DEBOUNCE_MS)
}

function applyMutation(
  get: () => WorkbenchStore,
  set: (partial: Partial<WorkbenchStore>) => void,
  action: Exclude<LocalAction, { type: 'hydrate' }>,
): void {
  const next = reduceLocal(pickLocal(get()), action)
  set({
    user: next.user,
    projects: next.projects,
    tasks: next.tasks,
  })
  schedulePersist(next)
}

function applyRemoteSnapshot(
  set: (partial: Partial<WorkbenchStore>) => void,
  snap: {
    pool: WorkbenchTask[]
    mainline: WorkbenchTask[]
    leadIds: string[]
    members: WorkbenchUser[]
  },
): void {
  lastSnapshotAt = new Date().toISOString()
  set({
    remotePool: snap.pool,
    remoteMainline: snap.mainline,
    remoteLeadIds: snap.leadIds,
    remoteMembers: snap.members,
  })
}

function handleServerEvent(
  set: (partial: Partial<WorkbenchStore>) => void,
  get: () => WorkbenchStore,
  raw: unknown,
): void {
  if (!isServerEvent(raw)) return
  switch (raw.type) {
    case 'snapshot':
      applyRemoteSnapshot(set, {
        pool: raw.pool,
        mainline: raw.mainline,
        leadIds: raw.leadIds,
        members: raw.members,
      })
      break
    case 'poolUpsert':
      set({ remotePool: upsertById(get().remotePool, raw.task) })
      break
    case 'mainlineUpsert':
      set({ remoteMainline: upsertById(get().remoteMainline, raw.task) })
      break
    case 'mainlineRemove':
      set({
        remoteMainline: get().remoteMainline.filter(
          (t) => !(t.id === raw.taskId && t.projectId === raw.projectId),
        ),
      })
      break
    case 'members':
      set({ remoteMembers: raw.members })
      break
    case 'error':
      showToast(raw.message, 'error')
      break
    default:
      break
  }
}

function attachClient(
  client: LanClient,
  set: (partial: Partial<WorkbenchStore>) => void,
  get: () => WorkbenchStore,
): void {
  clearLanSubscription()
  activeClient = client
  unsubscribeEvents = client.subscribe((ev) => handleServerEvent(set, get, ev))
  startHeartbeat(get)
}

const empty = createEmptyLocalState(resolveDefaultUser())

function offlineConnection(user: WorkbenchUser): ConnectionState {
  return { mode: 'offline', localUser: user }
}

export const useWorkbenchStore = create<WorkbenchStore>((set, get) => ({
  ...empty,
  hydrated: false,
  connection: offlineConnection(empty.user),
  remotePool: [],
  remoteMainline: [],
  remoteLeadIds: [],
  remoteMembers: [],
  disconnectBanner: null,

  hydrate: async () => {
    if (get().hydrated) return
    if (hydrateInFlight) return hydrateInFlight

    hydrateInFlight = (async () => {
      const defaultUser = resolveDefaultUser()
      let next = createEmptyLocalState(defaultUser)
      try {
        const raw = await electronApi()?.workbenchLocalGet?.()
        if (looksLikeLocalState(raw)) {
          next = reduceLocal(next, { type: 'hydrate', state: raw })
        }
      } catch {
        // Keep empty default state when load fails.
      }
      set({
        ...next,
        hydrated: true,
        connection: offlineConnection(next.user),
      })
      hydrateInFlight = null
    })()

    return hydrateInFlight
  },

  createProject: (name) => {
    const before = new Set(get().projects.map((p) => p.id))
    applyMutation(get, set, {
      type: 'project/create',
      name: name.trim() || '未命名项目',
      nowIso: new Date().toISOString(),
    })
    const created = get().projects.find((p) => !before.has(p.id))
    return created?.id ?? ''
  },

  renameProject: (projectId, name) => {
    applyMutation(get, set, {
      type: 'project/rename',
      projectId,
      name,
      nowIso: new Date().toISOString(),
    })
  },

  createPersonalTask: (projectId, title) => {
    applyMutation(get, set, {
      type: 'task/createPersonal',
      projectId,
      title,
      nowIso: new Date().toISOString(),
    })
  },

  updateTask: (taskId, patch) => {
    applyMutation(get, set, {
      type: 'task/update',
      taskId,
      patch,
      nowIso: new Date().toISOString(),
    })
  },

  promoteToLocalMainline: (taskId) => {
    const source = get().tasks.find((t) => t.id === taskId)
    if (!source) return
    if (get().isOnMainline(source.id, source.projectId)) {
      showToast('该任务已在主线中', 'error')
      return
    }
    applyMutation(get, set, {
      type: 'task/promoteToLocalMainline',
      taskId,
      actorId: get().user.id,
      nowIso: new Date().toISOString(),
    })
  },

  deleteMainlineTask: async (taskId) => {
    const mode = get().connection.mode
    const task =
      get().remoteMainline.find((t) => t.id === taskId) ||
      get().tasks.find((t) => t.id === taskId)
    if (!task) return { ok: false, error: '任务不存在' }

    const live = mode !== 'offline' && get().connection.projectId === task.projectId
    if (!live) {
      if (task.space !== 'mainline') return { ok: false, error: '只能删除主线任务' }
      applyMutation(get, set, { type: 'task/delete', taskId })
      return { ok: true }
    }
    if (!get().isLead()) {
      const msg = '仅负责人可删除主线任务'
      showToast(msg, 'error')
      return { ok: false, error: msg }
    }
    const client = activeClient
    if (!client) return { ok: false, error: '客户端未就绪' }
    const result = await client.command(
      { op: 'deleteMainlineTask', projectId: task.projectId, taskId },
      get().connection.localUser.id,
    )
    if (!result.ok) {
      showToast(result.error, 'error')
      return result
    }
    return { ok: true }
  },

  isOnMainline: (sourceTaskId, projectId) => {
    const { connection, tasks, remoteMainline } = get()
    const live = connection.mode !== 'offline' && connection.projectId === projectId
    const list = live
      ? remoteMainline.filter((t) => t.projectId === projectId)
      : tasks.filter((t) => t.projectId === projectId && t.space === 'mainline')
    return list.some((t) => t.sourceTaskId === sourceTaskId || t.id === sourceTaskId)
  },

  importLegacyIntoProject: async (projectId) => {
    const project = get().projects.find((p) => p.id === projectId)
    if (!project) return { ok: false, error: '项目不存在' }
    try {
      const { api } = await import('../../taskflow/utils/api.ts')
      const { importLegacyTasks } = await import('../importFromTaskflow.ts')
      const legacy = await api.tasks.list()
      const mapped = importLegacyTasks({
        projectId,
        authorId: get().user.id,
        nowIso: new Date().toISOString(),
        legacyTasks: legacy.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          dueDate: t.dueDate,
        })),
      })
      if (mapped.length === 0) return { ok: false, error: '经典任务流没有可导入的任务' }
      applyMutation(get, set, { type: 'task/importMany', tasks: mapped })
      showToast(`已导入 ${mapped.length} 条到个人`, 'success')
      return { ok: true, count: mapped.length }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '导入失败'
      showToast(msg, 'error')
      return { ok: false, error: msg }
    }
  },

  tasksForProject: (projectId) => get().tasks.filter((t) => t.projectId === projectId),

  startHosting: async ({ projectId, passphrase }) => {
    const api = electronApi()
    if (!api?.workbenchHostStart || !api.workbenchHostShareProject) {
      return { ok: false, error: '主机能力不可用（需桌面端）' }
    }
    const project = get().projects.find((p) => p.id === projectId)
    if (!project) return { ok: false, error: '项目不存在' }

    const user = get().user
    try {
      // Drop prior join/host session before opening a new room.
      await get().disconnect()

      const started = await api.workbenchHostStart({
        displayName: user.displayName,
        userId: user.id,
        passphrase,
      })
      const mainlineSeed = get().tasks.filter(
        (t) => t.projectId === projectId && t.space === 'mainline',
      )
      const shared = await api.workbenchHostShareProject({
        project,
        mainlineSeed,
      })
      if (!shared.ok) {
        await api.workbenchHostStop?.()
        return { ok: false, error: shared.error || '分享项目失败' }
      }

      // 本机客户端始终走环回，避免 CSP/防火墙拦截局域网 IP 自连
      const localBaseUrl = `http://127.0.0.1:${started.port}`
      const lanUrls = started.lanUrls.length
        ? started.lanUrls
        : [localBaseUrl]
      const client = createLanClient(localBaseUrl)
      attachClient(client, set, get)

      const snap = await client.getSnapshot(projectId)
      if (snap.ok) applyRemoteSnapshot(set, snap.data)

      set({
        connection: {
          mode: 'hosting',
          projectId,
          projectName: project.name,
          roomCode: started.roomCode,
          hostBaseUrl: localBaseUrl,
          lanUrls,
          localUser: user,
        },
        disconnectBanner: null,
      })
      return { ok: true }
    } catch (e) {
      await api.workbenchHostStop?.().catch(() => undefined)
      clearLanSubscription()
      return { ok: false, error: e instanceof Error ? e.message : '开房失败' }
    }
  },

  joinRoom: async ({ baseUrl, passphrase, displayName, projectId }) => {
    const root = baseUrl.trim().replace(/\/$/, '')
    if (!root) return { ok: false, error: '请输入主机地址' }

    await get().disconnect()

    let user = get().user
    if (displayName?.trim()) {
      user = { ...user, displayName: displayName.trim() }
      set({ user })
      schedulePersist(pickLocal(get()))
    }

    const client = createLanClient(root)
    const joined = await client.join(user, passphrase)
    if (!joined.ok) return { ok: false, error: joined.error }

    const listed = await client.listProjects()
    if (!listed.ok) {
      clearLanSubscription()
      return { ok: false, error: listed.error }
    }
    if (listed.data.length === 0) {
      clearLanSubscription()
      return { ok: false, error: '房间内没有项目（主机需在项目内开房）' }
    }
    if (listed.data.length > 1) {
      clearLanSubscription()
      return { ok: false, error: '房间异常：绑定了多个项目' }
    }

    const roomProject = listed.data[0]
    if (projectId && projectId !== roomProject.id) {
      clearLanSubscription()
      return {
        ok: false,
        error: `该房间只开放项目「${roomProject.name}」，与当前项目不一致`,
      }
    }

    attachClient(client, set, get)

    const nowIso = new Date().toISOString()
    applyMutation(get, set, {
      type: 'project/ensure',
      project: {
        id: roomProject.id,
        name: roomProject.name,
        leadIds: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    })

    const snap = await client.getSnapshot(roomProject.id)
    if (snap.ok) {
      applyRemoteSnapshot(set, snap.data)
      applyMutation(get, set, {
        type: 'project/ensure',
        project: {
          id: roomProject.id,
          name: roomProject.name,
          leadIds: snap.data.leadIds,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      })
    }

    set({
      connection: {
        mode: 'joined',
        projectId: roomProject.id,
        projectName: roomProject.name,
        hostBaseUrl: root,
        localUser: user,
      },
      remoteMembers: joined.data.members,
      disconnectBanner: null,
    })

    return { ok: true, projectId: roomProject.id }
  },

  disconnect: async (opts) => {
    const wasHosting = get().connection.mode === 'hosting'
    const wasConnected = get().connection.mode !== 'offline'
    clearLanSubscription()
    lastSnapshotAt = null
    if (wasHosting) {
      try {
        await electronApi()?.workbenchHostStop?.()
      } catch {
        // ignore stop errors
      }
    }
    const banner =
      opts?.reason === 'heartbeat' && wasConnected
        ? '已断开，显示本机主线；团队主线需重连'
        : null
    set({
      connection: offlineConnection(get().user),
      remotePool: [],
      remoteMainline: [],
      remoteLeadIds: [],
      remoteMembers: [],
      disconnectBanner: banner,
    })
  },

  isLiveForProject: (projectId) => {
    const { connection } = get()
    return connection.mode !== 'offline' && connection.projectId === projectId
  },

  submitToPool: async (taskId) => {
    const mode = get().connection.mode
    if (mode === 'offline') {
      return { ok: false, error: '未连接房间' }
    }
    const client = activeClient
    if (!client) return { ok: false, error: '客户端未就绪' }

    const task = get().tasks.find((t) => t.id === taskId && t.space === 'personal')
    if (!task) return { ok: false, error: '个人任务不存在' }

    const userId = get().connection.localUser.id
    const result = await client.command(
      { op: 'submitToPool', projectId: task.projectId, task },
      userId,
    )
    if (!result.ok) {
      applyMutation(get, set, {
        type: 'task/update',
        taskId,
        patch: { pendingPoolRetry: true },
        nowIso: new Date().toISOString(),
      })
      showToast(result.error, 'error')
      return result
    }
    if (task.pendingPoolRetry) {
      applyMutation(get, set, {
        type: 'task/update',
        taskId,
        patch: { pendingPoolRetry: false },
        nowIso: new Date().toISOString(),
      })
    }
    return { ok: true }
  },

  promoteRemote: async (sourceTask) => {
    const mode = get().connection.mode
    if (mode === 'offline') {
      return { ok: false, error: '未连接房间' }
    }
    if (get().isOnMainline(sourceTask.id, sourceTask.projectId)) {
      const msg = '该任务已在主线中'
      showToast(msg, 'error')
      return { ok: false, error: msg }
    }
    if (!get().isLead()) {
      const msg = '仅负责人可将任务拉入主线'
      showToast(msg, 'error')
      return { ok: false, error: msg }
    }
    const client = activeClient
    if (!client) return { ok: false, error: '客户端未就绪' }

    const userId = get().connection.localUser.id
    const result = await client.command(
      { op: 'promote', projectId: sourceTask.projectId, sourceTask },
      userId,
    )
    if (!result.ok) {
      showToast(result.error, 'error')
      return result
    }
    return { ok: true }
  },

  updateRemoteMainlineTask: async (taskId, patch) => {
    const mode = get().connection.mode
    if (mode === 'offline') {
      return { ok: false, error: '未连接房间' }
    }
    const client = activeClient
    if (!client) return { ok: false, error: '客户端未就绪' }

    const task =
      get().remoteMainline.find((t) => t.id === taskId) ||
      get().findTaskEverywhere(taskId)
    if (!task) return { ok: false, error: '任务不存在' }

    const userId = get().connection.localUser.id
    const result = await client.command(
      {
        op: 'updateMainlineTask',
        projectId: task.projectId,
        taskId,
        patch,
      },
      userId,
    )
    if (!result.ok) {
      showToast(result.error, 'error')
      return result
    }
    return { ok: true }
  },

  retryPendingPool: async () => {
    const pending = get().tasks.filter((t) => t.space === 'personal' && t.pendingPoolRetry)
    for (const task of pending) {
      await get().submitToPool(task.id)
    }
  },

  isLead: () => {
    const { connection, remoteLeadIds, user } = get()
    if (connection.mode === 'offline') return true
    return remoteLeadIds.includes(connection.localUser.id || user.id)
  },

  visibleMainline: (projectId) => {
    const { connection, tasks, remoteMainline } = get()
    const live = connection.mode !== 'offline' && connection.projectId === projectId
    if (!live) {
      return sortByOrder(tasks.filter((t) => t.projectId === projectId && t.space === 'mainline'))
    }
    return sortByOrder(remoteMainline.filter((t) => t.projectId === projectId))
  },

  visiblePool: (projectId) => {
    const { connection, remotePool } = get()
    const live = connection.mode !== 'offline' && (!projectId || connection.projectId === projectId)
    if (!live) return []
    if (!projectId) return sortByOrder(remotePool)
    return sortByOrder(remotePool.filter((t) => t.projectId === projectId))
  },

  findTaskEverywhere: (taskId) => {
    const { tasks, remotePool, remoteMainline } = get()
    return (
      tasks.find((t) => t.id === taskId) ||
      remotePool.find((t) => t.id === taskId) ||
      remoteMainline.find((t) => t.id === taskId) ||
      null
    )
  },

  unsyncedLocalMainline: (projectId) => {
    const { tasks } = get()
    const localMain = tasks.filter((t) => t.projectId === projectId && t.space === 'mainline')
    if (!lastSnapshotAt) return sortByOrder(localMain)
    return sortByOrder(localMain.filter((t) => t.updatedAt > lastSnapshotAt!))
  },

  submitLocalMainlineToPool: async (projectId) => {
    if (get().connection.mode === 'offline') {
      showToast('请先连接房间', 'error')
      return
    }
    const items = get().unsyncedLocalMainline(projectId)
    for (const task of items) {
      // Ensure a personal copy exists to submit, or submit the mainline task reshaped as pool payload.
      const client = activeClient
      if (!client) return
      const userId = get().connection.localUser.id
      const poolTask: WorkbenchTask = {
        ...task,
        id: task.id,
        space: 'pool',
        updatedAt: new Date().toISOString(),
      }
      const result = await client.command(
        { op: 'submitToPool', projectId, task: poolTask },
        userId,
      )
      if (!result.ok) {
        showToast(result.error, 'error')
        return
      }
    }
    if (items.length > 0) showToast(`已提交 ${items.length} 条本机主线到所有人`, 'success')
  },

  clearDisconnectBanner: () => set({ disconnectBanner: null }),
}))
