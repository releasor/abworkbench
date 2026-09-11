import type { TaskStatus } from './types'

export type WorkbenchDragSource = 'personalMainline' | 'teamMainline'

export interface WorkbenchDragPayload {
  taskId: string
  source: WorkbenchDragSource
}

export const WORKBENCH_TASK_DRAG_MIME = 'application/x-wb-task-drag'

export function encodeWorkbenchDragPayload(payload: WorkbenchDragPayload): string {
  return JSON.stringify(payload)
}

export function readWorkbenchDragPayload(dataTransfer: DataTransfer): WorkbenchDragPayload | null {
  const raw = dataTransfer.getData(WORKBENCH_TASK_DRAG_MIME)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as WorkbenchDragPayload
    if (!parsed?.taskId || !parsed?.source) return null
    return parsed
  } catch {
    return null
  }
}

export function shouldUpdateMainlineStatus(
  currentStatus: TaskStatus | undefined,
  targetStatus: TaskStatus,
): boolean {
  return currentStatus != null && currentStatus !== targetStatus
}
