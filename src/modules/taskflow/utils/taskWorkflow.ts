import type { Note, RecurringPattern, TaskDependency, TimeEntry } from '../types'
import { generateId } from '../../../utils/id.ts'

interface WorkflowTask {
  id: string
  title: string
  status?: string
  blockerReason?: string
  dependencies?: TaskDependency[]
  dependencyTitles?: string[]
  estimatedMinutes?: number | null
  nextAction?: string
  timeEntries?: TimeEntry[]
  notes?: Note[]
}

export interface BlockerSummary {
  isBlocked: boolean
  reason: string
  dependencyTitles: string[]
  label: string
}

function totalSpentMinutes(entries: TimeEntry[] = []): number {
  return Math.round(entries.reduce((sum, entry) => sum + Math.max(0, entry.duration || 0), 0) / 60)
}

function cleanText(value?: string): string {
  return (value || '').trim()
}

export function buildBlockerSummary(input: { task: WorkflowTask; dependencyTitles?: string[] }): BlockerSummary {
  const blockedDependencies = (input.task.dependencies || []).filter((dependency) => dependency.type === 'blocked-by')
  const dependencyTitles = input.dependencyTitles || input.task.dependencyTitles || []
  const reason = cleanText(input.task.blockerReason)
  const isBlocked = Boolean(reason) || blockedDependencies.length > 0
  const fallback = dependencyTitles.length > 0 ? dependencyTitles.join('、') : '等待前置任务完成'
  const label = isBlocked
    ? `被 ${Math.max(blockedDependencies.length, dependencyTitles.length, 1)} 个任务阻塞：${reason || fallback}`
    : '没有阻塞，适合直接推进。'

  return { isBlocked, reason, dependencyTitles, label }
}

export function buildCompletionReviewSentence(input: { task: WorkflowTask }): string {
  const spentMinutes = totalSpentMinutes(input.task.timeEntries)
  const timeText = spentMinutes > 0
    ? `实际用时 ${spentMinutes} 分钟`
    : input.task.estimatedMinutes
      ? `预计用时 ${input.task.estimatedMinutes} 分钟`
      : '未记录用时'
  const nextAction = cleanText(input.task.nextAction) || '整理下一步'
  return `已完成「${input.task.title}」，${timeText}；下一步：${nextAction}。`
}

export function shouldAddCompletionReview(task: WorkflowTask): boolean {
  return !(task.notes || []).some((note) => note.content.startsWith('自动复盘：'))
}

export function createCompletionReviewNote(input: { task: WorkflowTask; nowIso?: string }): Note {
  const now = input.nowIso || new Date().toISOString()
  return {
    id: `review-${generateId()}`,
    content: `自动复盘：${buildCompletionReviewSentence({ task: input.task })}`,
    createdAt: now,
    updatedAt: now,
  }
}

export function calculateNextDueDate(currentDueDate: string, pattern: RecurringPattern): string | null {
  const base = new Date(currentDueDate)
  if (isNaN(base.getTime())) return null

  const next = new Date(base)
  const { frequency, interval } = pattern

  if (frequency === 'daily') {
    next.setDate(next.getDate() + interval)
  } else if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7 * interval)
  } else if (frequency === 'monthly') {
    const targetDay = pattern.dayOfMonth || base.getDate()
    next.setMonth(next.getMonth() + interval)
    next.setDate(Math.min(targetDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))
  } else if (frequency === 'yearly') {
    next.setFullYear(next.getFullYear() + interval)
  }

  // Check end date
  if (pattern.endDate) {
    const end = new Date(pattern.endDate)
    if (!isNaN(end.getTime()) && next > end) return null
  }

  return next.toISOString().slice(0, 10)
}

export function shouldCreateNextRecurrence(task: { recurring: RecurringPattern | null; dueDate: string | null }): boolean {
  if (!task.recurring) return false
  if (!task.dueDate) return false
  if (task.recurring.maxOccurrences !== null && task.recurring.maxOccurrences !== undefined && task.recurring.maxOccurrences <= 1) return false
  return true
}
