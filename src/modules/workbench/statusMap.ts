import type { TaskStatus } from './types.ts'

export function mapLegacyStatus(status: string): TaskStatus {
  if (status === 'done') return 'done'
  if (status === 'in-progress' || status === 'review' || status === 'doing') return 'doing'
  return 'todo'
}
