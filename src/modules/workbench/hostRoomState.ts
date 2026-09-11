import { createId } from './id.ts'
import { canPromoteToMainline, canSubmitToPool, canSubmitToTeamMainline } from './permissions.ts'
import { createActivityEntry } from './teamMainlineActivity.ts'
import type {
  TrashedMainlineTask,
  WorkbenchActivityEntry,
  WorkbenchProject,
  WorkbenchTask,
  WorkbenchUser,
} from './types.ts'

const MAX_ACTIVITY_LOG = 200

export interface HostProjectBundle {
  project: WorkbenchProject
  pool: WorkbenchTask[]
  mainline: WorkbenchTask[]
  mainlineTrash: TrashedMainlineTask[]
  activityLog: WorkbenchActivityEntry[]
}

export interface HostRoomState {
  roomCode: string
  passphrase: string
  hostUserId: string
  members: WorkbenchUser[]
  projects: Record<string, HostProjectBundle>
}

export type HostEvent =
  | {
      type: 'snapshot'
      projectId: string
      pool: WorkbenchTask[]
      mainline: WorkbenchTask[]
      mainlineTrash: TrashedMainlineTask[]
      activityLog: WorkbenchActivityEntry[]
      leadIds: string[]
      members: WorkbenchUser[]
    }
  | { type: 'poolUpsert'; projectId: string; task: WorkbenchTask }
  | { type: 'mainlineUpsert'; projectId: string; task: WorkbenchTask }
  | { type: 'mainlineRemove'; projectId: string; taskId: string }
  | { type: 'mainlineTrashUpsert'; projectId: string; item: TrashedMainlineTask }
  | { type: 'mainlineTrashRemove'; projectId: string; taskId: string }
  | { type: 'activityLogAppend'; projectId: string; entry: WorkbenchActivityEntry }
  | { type: 'error'; message: string }
  | { type: 'members'; members: WorkbenchUser[] }

export type HostCommand =
  | { type: 'join'; user: WorkbenchUser; passphrase: string; nowIso: string }
  | {
      type: 'shareProject'
      project: WorkbenchProject
      mainlineSeed: WorkbenchTask[]
      nowIso: string
    }
  | {
      type: 'submitToPool'
      actorId: string
      projectId: string
      task: WorkbenchTask
      nowIso: string
    }
  | {
      type: 'promote'
      actorId: string
      projectId: string
      sourceTask: WorkbenchTask
      nowIso: string
    }
  | {
      type: 'submitToTeamMainline'
      actorId: string
      projectId: string
      sourceTask: WorkbenchTask
      status?: WorkbenchTask['status']
      nowIso: string
    }
  | {
      type: 'updateMainlineTask'
      actorId: string
      projectId: string
      taskId: string
      patch: Partial<
        Pick<WorkbenchTask, 'title' | 'status' | 'dueDate' | 'description' | 'assigneeId' | 'order'>
      >
      nowIso: string
    }
  | {
      type: 'deleteMainlineTask'
      actorId: string
      projectId: string
      taskId: string
      nowIso: string
    }
  | {
      type: 'restoreMainlineTask'
      actorId: string
      projectId: string
      taskId: string
      nowIso: string
    }
  | {
      type: 'purgeMainlineTask'
      actorId: string
      projectId: string
      taskId: string
      nowIso: string
    }
  | {
      type: 'restoreMainlineTask'
      actorId: string
      projectId: string
      taskId: string
      nowIso: string
    }
  | {
      type: 'purgeMainlineTask'
      actorId: string
      projectId: string
      taskId: string
      nowIso: string
    }
  | {
      type: 'setLeads'
      actorId: string
      projectId: string
      leadIds: string[]
      nowIso: string
    }

export type HostCommandResult =
  | { ok: true; room: HostRoomState; events: HostEvent[] }
  | { ok: false; error: string; room: HostRoomState }

function fail(room: HostRoomState, error: string): HostCommandResult {
  return { ok: false, error, room }
}

function ok(room: HostRoomState, events: HostEvent[]): HostCommandResult {
  return { ok: true, room, events }
}

function isMember(room: HostRoomState, userId: string): boolean {
  return room.members.some((m) => m.id === userId)
}

function normalizeBundle(bundle: HostProjectBundle): HostProjectBundle {
  return {
    ...bundle,
    mainlineTrash: bundle.mainlineTrash ?? [],
    activityLog: bundle.activityLog ?? [],
  }
}

function snapshotEvent(room: HostRoomState, projectId: string, bundle: HostProjectBundle): HostEvent {
  const normalized = normalizeBundle(bundle)
  return {
    type: 'snapshot',
    projectId,
    pool: normalized.pool,
    mainline: normalized.mainline,
    mainlineTrash: normalized.mainlineTrash,
    activityLog: normalized.activityLog,
    leadIds: normalized.project.leadIds,
    members: room.members,
  }
}

function appendActivity(
  bundle: HostProjectBundle,
  input: Omit<WorkbenchActivityEntry, 'id'>,
): { bundle: HostProjectBundle; entry: WorkbenchActivityEntry; event: HostEvent } {
  const entry = createActivityEntry(input)
  const normalized = normalizeBundle(bundle)
  const activityLog = [...normalized.activityLog, entry].slice(-MAX_ACTIVITY_LOG)
  const next = { ...normalized, activityLog }
  return {
    bundle: next,
    entry,
    event: { type: 'activityLogAppend', projectId: input.projectId, entry },
  }
}

function isLead(bundle: HostProjectBundle, actorId: string): boolean {
  return bundle.project.leadIds.includes(actorId)
}

export function createHostRoom(input: {
  hostUser: WorkbenchUser
  roomCode: string
  passphrase: string
  nowIso: string
}): HostRoomState {
  void input.nowIso
  return {
    roomCode: input.roomCode,
    passphrase: input.passphrase,
    hostUserId: input.hostUser.id,
    members: [input.hostUser],
    projects: {},
  }
}

export function applyHostCommand(room: HostRoomState, command: HostCommand): HostCommandResult {
  switch (command.type) {
    case 'join': {
      if (command.passphrase !== room.passphrase) {
        return fail(room, 'wrong passphrase')
      }
      const existing = room.members.find((m) => m.id === command.user.id)
      const members = existing
        ? room.members.map((m) => (m.id === command.user.id ? command.user : m))
        : [...room.members, command.user]
      const next = { ...room, members }
      return ok(next, [{ type: 'members', members }])
    }

    case 'shareProject': {
      const existingIds = Object.keys(room.projects)
      if (existingIds.length > 0 && !room.projects[command.project.id]) {
        return fail(room, '房间只绑定一个项目，请先关闭当前房间再开房')
      }
      const mainline = command.mainlineSeed.map((t, index) => ({
        ...t,
        projectId: command.project.id,
        space: 'mainline' as const,
        order: t.order ?? index,
        updatedAt: command.nowIso,
      }))
      const bundle: HostProjectBundle = {
        project: { ...command.project, updatedAt: command.nowIso },
        pool: [],
        mainline,
        mainlineTrash: [],
        activityLog: [],
      }
      const next: HostRoomState = {
        ...room,
        projects: { [command.project.id]: bundle },
      }
      return ok(next, [snapshotEvent(next, command.project.id, bundle)])
    }

    case 'submitToPool': {
      if (!isMember(room, command.actorId)) {
        return fail(room, 'not a member')
      }
      if (!canSubmitToPool({ connected: true })) {
        return fail(room, 'cannot submit to pool')
      }
      const bundle = normalizeBundle(room.projects[command.projectId]!)
      if (!bundle) {
        return fail(room, 'project not found')
      }
      const task: WorkbenchTask = {
        ...command.task,
        projectId: command.projectId,
        space: 'pool',
        updatedAt: command.nowIso,
      }
      const idx = bundle.pool.findIndex((t) => t.id === task.id)
      const pool =
        idx >= 0
          ? bundle.pool.map((t, i) => (i === idx ? task : t))
          : [...bundle.pool, task]
      const nextBundle = { ...bundle, pool }
      const next: HostRoomState = {
        ...room,
        projects: { ...room.projects, [command.projectId]: nextBundle },
      }
      return ok(next, [{ type: 'poolUpsert', projectId: command.projectId, task }])
    }

    case 'submitToTeamMainline': {
      if (!isMember(room, command.actorId)) {
        return fail(room, 'not a member')
      }
      let bundle = normalizeBundle(room.projects[command.projectId]!)
      if (!bundle) {
        return fail(room, 'project not found')
      }
      const source = command.sourceTask
      const linkId = source.sourceTaskId ?? source.id
      if (bundle.mainline.some((t) => t.sourceTaskId === linkId || t.id === linkId)) {
        return fail(room, '该任务已在团队主线中')
      }
      if (
        !canSubmitToTeamMainline({
          connected: true,
          actorId: command.actorId,
          sourceAuthorId: source.authorId,
        })
      ) {
        return fail(room, 'cannot submit to team mainline')
      }
      const promoted: WorkbenchTask = {
        ...source,
        id: createId('task'),
        projectId: command.projectId,
        space: 'mainline',
        sourceTaskId: linkId,
        authorId: source.authorId,
        status: command.status ?? source.status,
        order: bundle.mainline.length,
        updatedAt: command.nowIso,
      }
      const activity = appendActivity(bundle, {
        projectId: command.projectId,
        actorId: command.actorId,
        action: 'submitted',
        taskId: promoted.id,
        taskTitle: promoted.title,
        details: promoted.status,
        timestamp: command.nowIso,
      })
      bundle = activity.bundle
      const nextBundle = {
        ...bundle,
        mainline: [...bundle.mainline, promoted],
      }
      const next: HostRoomState = {
        ...room,
        projects: { ...room.projects, [command.projectId]: nextBundle },
      }
      return ok(next, [
        { type: 'mainlineUpsert', projectId: command.projectId, task: promoted },
        activity.event,
      ])
    }

    case 'promote': {
      let bundle = normalizeBundle(room.projects[command.projectId]!)
      if (!bundle) {
        return fail(room, 'project not found')
      }
      const source = command.sourceTask
      const linkId = source.sourceTaskId ?? source.id
      if (bundle.mainline.some((t) => t.sourceTaskId === linkId || t.id === linkId)) {
        return fail(room, '该任务已在主线中')
      }
      const allowed = canPromoteToMainline({
        connected: true,
        actorId: command.actorId,
        localUserId: command.actorId,
        leadIds: bundle.project.leadIds,
        sourceSpace: source.space,
        sourceAuthorId: source.authorId,
      })
      if (!allowed) {
        return fail(room, 'cannot promote')
      }
      const promoted: WorkbenchTask = {
        ...source,
        id: createId('task'),
        projectId: command.projectId,
        space: 'mainline',
        sourceTaskId: source.id,
        authorId: source.authorId,
        order: bundle.mainline.length,
        updatedAt: command.nowIso,
      }
      const activity = appendActivity(bundle, {
        projectId: command.projectId,
        actorId: command.actorId,
        action: 'submitted',
        taskId: promoted.id,
        taskTitle: promoted.title,
        timestamp: command.nowIso,
      })
      bundle = activity.bundle
      const nextBundle = {
        ...bundle,
        mainline: [...bundle.mainline, promoted],
      }
      const next: HostRoomState = {
        ...room,
        projects: { ...room.projects, [command.projectId]: nextBundle },
      }
      return ok(next, [
        { type: 'mainlineUpsert', projectId: command.projectId, task: promoted },
        activity.event,
      ])
    }

    case 'updateMainlineTask': {
      if (!isMember(room, command.actorId)) {
        return fail(room, 'not a member')
      }
      let bundle = normalizeBundle(room.projects[command.projectId]!)
      if (!bundle) {
        return fail(room, 'project not found')
      }
      const idx = bundle.mainline.findIndex((t) => t.id === command.taskId)
      if (idx < 0) {
        return fail(room, 'task not found')
      }
      const before = bundle.mainline[idx]
      const task: WorkbenchTask = {
        ...before,
        ...command.patch,
        id: command.taskId,
        projectId: command.projectId,
        space: 'mainline',
        updatedAt: command.nowIso,
      }
      const details = command.patch.status && command.patch.status !== before.status
        ? command.patch.status
        : command.patch.title && command.patch.title !== before.title
          ? command.patch.title
          : undefined
      const activity = appendActivity(bundle, {
        projectId: command.projectId,
        actorId: command.actorId,
        action: 'updated',
        taskId: task.id,
        taskTitle: task.title,
        details,
        timestamp: command.nowIso,
      })
      bundle = activity.bundle
      const mainline = bundle.mainline.map((t, i) => (i === idx ? task : t))
      const nextBundle = { ...bundle, mainline }
      const next: HostRoomState = {
        ...room,
        projects: { ...room.projects, [command.projectId]: nextBundle },
      }
      return ok(next, [
        { type: 'mainlineUpsert', projectId: command.projectId, task },
        activity.event,
      ])
    }

    case 'deleteMainlineTask': {
      let bundle = normalizeBundle(room.projects[command.projectId]!)
      if (!bundle) {
        return fail(room, 'project not found')
      }
      if (!isLead(bundle, command.actorId)) {
        return fail(room, '仅负责人可删除主线任务')
      }
      const task = bundle.mainline.find((t) => t.id === command.taskId)
      if (!task) {
        return fail(room, 'task not found')
      }
      const trashed: TrashedMainlineTask = {
        task: { ...task, updatedAt: command.nowIso },
        deletedAt: command.nowIso,
        deletedBy: command.actorId,
      }
      const activity = appendActivity(bundle, {
        projectId: command.projectId,
        actorId: command.actorId,
        action: 'deleted',
        taskId: task.id,
        taskTitle: task.title,
        timestamp: command.nowIso,
      })
      bundle = activity.bundle
      const nextBundle = {
        ...bundle,
        mainline: bundle.mainline.filter((t) => t.id !== command.taskId),
        mainlineTrash: [...bundle.mainlineTrash.filter((t) => t.task.id !== task.id), trashed],
      }
      const next: HostRoomState = {
        ...room,
        projects: { ...room.projects, [command.projectId]: nextBundle },
      }
      return ok(next, [
        { type: 'mainlineRemove', projectId: command.projectId, taskId: command.taskId },
        { type: 'mainlineTrashUpsert', projectId: command.projectId, item: trashed },
        activity.event,
      ])
    }

    case 'restoreMainlineTask': {
      let bundle = normalizeBundle(room.projects[command.projectId]!)
      if (!bundle) {
        return fail(room, 'project not found')
      }
      if (!isLead(bundle, command.actorId)) {
        return fail(room, '仅负责人可恢复主线任务')
      }
      const trashed = bundle.mainlineTrash.find((t) => t.task.id === command.taskId)
      if (!trashed) {
        return fail(room, 'task not found in trash')
      }
      const restored: WorkbenchTask = {
        ...trashed.task,
        updatedAt: command.nowIso,
        order: bundle.mainline.length,
      }
      const activity = appendActivity(bundle, {
        projectId: command.projectId,
        actorId: command.actorId,
        action: 'restored',
        taskId: restored.id,
        taskTitle: restored.title,
        timestamp: command.nowIso,
      })
      bundle = activity.bundle
      const nextBundle = {
        ...bundle,
        mainline: [...bundle.mainline, restored],
        mainlineTrash: bundle.mainlineTrash.filter((t) => t.task.id !== command.taskId),
      }
      const next: HostRoomState = {
        ...room,
        projects: { ...room.projects, [command.projectId]: nextBundle },
      }
      return ok(next, [
        { type: 'mainlineUpsert', projectId: command.projectId, task: restored },
        { type: 'mainlineTrashRemove', projectId: command.projectId, taskId: command.taskId },
        activity.event,
      ])
    }

    case 'purgeMainlineTask': {
      let bundle = normalizeBundle(room.projects[command.projectId]!)
      if (!bundle) {
        return fail(room, 'project not found')
      }
      if (!isLead(bundle, command.actorId)) {
        return fail(room, '仅负责人可永久删除任务')
      }
      const trashed = bundle.mainlineTrash.find((t) => t.task.id === command.taskId)
      if (!trashed) {
        return fail(room, 'task not found in trash')
      }
      const activity = appendActivity(bundle, {
        projectId: command.projectId,
        actorId: command.actorId,
        action: 'purged',
        taskId: trashed.task.id,
        taskTitle: trashed.task.title,
        timestamp: command.nowIso,
      })
      bundle = activity.bundle
      const nextBundle = {
        ...bundle,
        mainlineTrash: bundle.mainlineTrash.filter((t) => t.task.id !== command.taskId),
      }
      const next: HostRoomState = {
        ...room,
        projects: { ...room.projects, [command.projectId]: nextBundle },
      }
      return ok(next, [
        { type: 'mainlineTrashRemove', projectId: command.projectId, taskId: command.taskId },
        activity.event,
      ])
    }

    case 'setLeads': {
      if (command.actorId !== room.hostUserId) {
        return fail(room, 'only host can set leads')
      }
      const bundle = normalizeBundle(room.projects[command.projectId]!)
      if (!bundle) {
        return fail(room, 'project not found')
      }
      const project = {
        ...bundle.project,
        leadIds: [...command.leadIds],
        updatedAt: command.nowIso,
      }
      const nextBundle = { ...bundle, project }
      const next: HostRoomState = {
        ...room,
        projects: { ...room.projects, [command.projectId]: nextBundle },
      }
      return ok(next, [snapshotEvent(next, command.projectId, nextBundle)])
    }

    default:
      return fail(room, 'unknown command')
  }
}
