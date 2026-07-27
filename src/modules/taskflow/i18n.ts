import type { TranslationKey } from '../../i18n'
import type { Priority, Status } from './types'
import type { SortBy } from './hooks/useTaskStore'

export const STATUS_LABEL_KEYS: Record<Status, TranslationKey> = {
  todo: 'taskflow.status.todo',
  'in-progress': 'taskflow.status.inProgress',
  review: 'taskflow.status.review',
  done: 'taskflow.status.done',
}

export const PRIORITY_LABEL_KEYS: Record<Priority, TranslationKey> = {
  low: 'taskflow.priority.low',
  medium: 'taskflow.priority.medium',
  high: 'taskflow.priority.high',
  urgent: 'taskflow.priority.urgent',
}

export const SORT_LABEL_KEYS: Record<SortBy, TranslationKey> = {
  order: 'taskflow.sort.order',
  urgency: 'taskflow.sort.urgency',
  priority: 'taskflow.sort.priority',
  dueDate: 'taskflow.sort.dueDate',
  createdAt: 'taskflow.sort.createdAt',
  title: 'taskflow.sort.title',
  estimated: 'taskflow.sort.estimated',
  timeSpent: 'taskflow.sort.timeSpent',
}
