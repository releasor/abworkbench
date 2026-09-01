import { createId } from './id.ts'
import { mapLegacyStatus } from './statusMap.ts'
import type { WorkbenchTask } from './types.ts'

export interface LegacyTaskLike {
  id?: string
  title: string
  description?: string
  status?: string
  dueDate?: string | null
}

export function importLegacyTasks(input: {
  projectId: string
  authorId: string
  nowIso: string
  legacyTasks: LegacyTaskLike[]
}): WorkbenchTask[] {
  return input.legacyTasks.map((t, index) => ({
    id: createId('task'),
    projectId: input.projectId,
    space: 'personal',
    title: t.title,
    status: mapLegacyStatus(t.status ?? 'todo'),
    dueDate: t.dueDate ?? null,
    description: t.description || undefined,
    authorId: input.authorId,
    assigneeId: input.authorId,
    sourceTaskId: t.id ?? null,
    order: index,
    updatedAt: input.nowIso,
  }))
}
