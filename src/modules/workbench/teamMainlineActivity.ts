import { createId } from './id.ts'
import type { TaskStatus, WorkbenchActivityAction, WorkbenchActivityEntry } from './types.ts'

export const ACTIVITY_ACTION_LABEL: Record<WorkbenchActivityAction, string> = {
  submitted: '提交到团队主线',
  updated: '更新任务',
  deleted: '移入回收站',
  restored: '从回收站恢复',
  purged: '永久删除',
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '待办',
  doing: '进行中',
  done: '已完成',
}

export function statusLabel(status: TaskStatus): string {
  return STATUS_LABEL[status]
}

export function createActivityEntry(input: {
  projectId: string
  actorId: string
  action: WorkbenchActivityAction
  taskId: string
  taskTitle: string
  details?: string
  timestamp: string
}): WorkbenchActivityEntry {
  return { id: createId('log'), ...input }
}

export function memberLabel(members: { id: string; displayName: string }[], actorId: string): string {
  return members.find((m) => m.id === actorId)?.displayName ?? actorId
}
