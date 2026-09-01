import { createId } from './id.ts'
import { canPromoteToMainline, canSubmitToPool } from './permissions.ts'
import type { WorkbenchProject, WorkbenchTask, WorkbenchUser } from './types.ts'

export interface HostProjectBundle {
  project: WorkbenchProject
  pool: WorkbenchTask[]
  mainline: WorkbenchTask[]
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
      leadIds: string[]
      members: WorkbenchUser[]
    }
  | { type: 'poolUpsert'; projectId: string; task: WorkbenchTask }
  | { type: 'mainlineUpsert'; projectId: string; task: WorkbenchTask }
  | { type: 'mainlineRemove'; projectId: string; taskId: string }
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
      }
      const next: HostRoomState = {
        ...room,
        projects: { [command.project.id]: bundle },
      }
      return ok(next, [
        {
          type: 'snapshot',
          projectId: command.project.id,
          pool: bundle.pool,
          mainline: bundle.mainline,
          leadIds: bundle.project.leadIds,
          members: next.members,
        },
      ])
    }

    case 'submitToPool': {
      if (!isMember(room, command.actorId)) {
        return fail(room, 'not a member')
      }
      if (!canSubmitToPool({ connected: true })) {
        return fail(room, 'cannot submit to pool')
      }
      const bundle = room.projects[command.projectId]
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

    case 'promote': {
      const bundle = room.projects[command.projectId]
      if (!bundle) {
        return fail(room, 'project not found')
      }
      const source = command.sourceTask
      if (bundle.mainline.some((t) => t.sourceTaskId === source.id || t.id === source.id)) {
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
      ])
    }

    case 'updateMainlineTask': {
      if (!isMember(room, command.actorId)) {
        return fail(room, 'not a member')
      }
      const bundle = room.projects[command.projectId]
      if (!bundle) {
        return fail(room, 'project not found')
      }
      const idx = bundle.mainline.findIndex((t) => t.id === command.taskId)
      if (idx < 0) {
        return fail(room, 'task not found')
      }
      const task: WorkbenchTask = {
        ...bundle.mainline[idx],
        ...command.patch,
        id: command.taskId,
        projectId: command.projectId,
        space: 'mainline',
        updatedAt: command.nowIso,
      }
      const mainline = bundle.mainline.map((t, i) => (i === idx ? task : t))
      const nextBundle = { ...bundle, mainline }
      const next: HostRoomState = {
        ...room,
        projects: { ...room.projects, [command.projectId]: nextBundle },
      }
      return ok(next, [
        { type: 'mainlineUpsert', projectId: command.projectId, task },
      ])
    }

    case 'deleteMainlineTask': {
      const bundle = room.projects[command.projectId]
      if (!bundle) {
        return fail(room, 'project not found')
      }
      if (!bundle.project.leadIds.includes(command.actorId)) {
        return fail(room, '仅负责人可删除主线任务')
      }
      if (!bundle.mainline.some((t) => t.id === command.taskId)) {
        return fail(room, 'task not found')
      }
      const mainline = bundle.mainline.filter((t) => t.id !== command.taskId)
      const nextBundle = { ...bundle, mainline }
      const next: HostRoomState = {
        ...room,
        projects: { ...room.projects, [command.projectId]: nextBundle },
      }
      return ok(next, [
        { type: 'mainlineRemove', projectId: command.projectId, taskId: command.taskId },
      ])
    }

    case 'setLeads': {
      if (command.actorId !== room.hostUserId) {
        return fail(room, 'only host can set leads')
      }
      const bundle = room.projects[command.projectId]
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
      return ok(next, [
        {
          type: 'snapshot',
          projectId: command.projectId,
          pool: nextBundle.pool,
          mainline: nextBundle.mainline,
          leadIds: project.leadIds,
          members: next.members,
        },
      ])
    }

    default:
      return fail(room, 'unknown command')
  }
}
