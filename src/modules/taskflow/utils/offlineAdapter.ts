/**
 * Desktop/localStorage adapter for TaskFlow.
 * Provides the same interface as the former REST API without starting a localhost service.
 */
import type { Task, Category, TaskStats, Status, Priority } from '../types'
import { createCompletionReviewNote, shouldAddCompletionReview, calculateNextDueDate, shouldCreateNextRecurrence } from './taskWorkflow'
import { safeGet, safeSet } from '../../../utils/safeLocalStorage'
import { generateId } from '../../../utils/id'
import { migrateLegacyTaskCategories } from './legacyCategoryMigrate'
import { buildProductivityTrends } from '../../../utils/productivityTrends'

const TASKS_KEY = 'taskflow-offline-tasks'
const CATEGORIES_KEY = 'taskflow-offline-categories'
const BACKUPS_KEY = 'taskflow-offline-backups'
const MAX_BACKUPS = 8

interface TaskFlowBackup {
  index: number
  modified: string
  tasks: Task[]
  categories: Category[]
}

function loadTasks(): Task[] {
  const tasks = safeGet<Task[]>(TASKS_KEY, [])
  const migrated = migrateLegacyTaskCategories(tasks)
  if (migrated !== tasks) {
    // Persist once so orphan category badges disappear after upgrade.
    safeSet(TASKS_KEY, migrated)
  }
  return migrated
}

function saveTasks(tasks: Task[]): void {
  try { createBackup() } catch { /* backup is best-effort */ }
  safeSet(TASKS_KEY, tasks)
}

function loadCategories(): Category[] {
  return safeGet<Category[]>(CATEGORIES_KEY, getDefaultCategories())
}

function saveCategories(categories: Category[]): void {
  try { createBackup() } catch { /* backup is best-effort */ }
  safeSet(CATEGORIES_KEY, categories)
}

function getDefaultCategories(): Category[] {
  const defaults = getDefaultCategoriesWithoutPersist()
  saveCategories(defaults)
  return defaults
}

function getDefaultCategoriesWithoutPersist(): Category[] {
  return [
    { id: 'cat-work', name: '工作', color: '#3b82f6', icon: 'briefcase' },
    { id: 'cat-personal', name: '个人', color: '#8b5cf6', icon: 'user' },
    { id: 'cat-study', name: '学习', color: '#10b981', icon: 'book' },
    { id: 'cat-health', name: '健康', color: '#f97316', icon: 'heart' },
  ]
}

function loadBackups(): TaskFlowBackup[] {
  return safeGet<TaskFlowBackup[]>(BACKUPS_KEY, [])
}

function saveBackups(backups: TaskFlowBackup[]): void {
  safeSet(BACKUPS_KEY, backups.slice(0, MAX_BACKUPS))
}

function createBackup(): void {
  try {
    const tasks = safeGet<Task[]>(TASKS_KEY, [])
    const categories = safeGet<Category[]>(CATEGORIES_KEY, getDefaultCategoriesWithoutPersist())
    const backups = loadBackups()
    const last = backups[0]
    const snapshot = JSON.stringify({ tasks, categories })
    const lastSnapshot = last ? JSON.stringify({ tasks: last.tasks, categories: last.categories }) : ''
    if (snapshot === lastSnapshot) return

    saveBackups([
      { index: 0, modified: new Date().toISOString(), tasks, categories },
      ...backups.map((backup, index) => ({ ...backup, index: index + 1 })),
    ])
  } catch {
    // Backup is best-effort and must never block writes.
  }
}

/** Generic batch update helper - eliminates duplicated load/save/iterate patterns */
function batchUpdateTasks(
  ids: string[],
  mutate: (task: Task, now: string) => void | Task[],
): { updated: Task[]; extras: Task[] } {
  const tasks = loadTasks()
  const idSet = new Set(ids)
  const updated: Task[] = []
  const now = new Date().toISOString()
  const extras: Task[] = []
  for (const t of tasks) {
    if (idSet.has(t.id)) {
      const result = mutate(t, now)
      t.updatedAt = now
      updated.push(t)
      if (Array.isArray(result)) extras.push(...result)
    }
  }
  saveTasks(tasks)
  return { updated, extras }
}

function computeStats(tasks: Task[]): TaskStats {
  let completed = 0
  let overdue = 0
  const byStatus: Record<Status, number> = { 'todo': 0, 'in-progress': 0, 'review': 0, 'done': 0 }
  const byPriority: Record<Priority, number> = { low: 0, medium: 0, high: 0, urgent: 0 }
  let totalTimeSpent = 0
  let tasksWithTime = 0
  let trackingActive = 0
  let completedToday = 0
  let completedThisWeek = 0
  let totalCompletionTime = 0
  let completedWithTime = 0

  // Cache today string and compute week start once (no Date objects in loop)
  const nowMs = Date.now()
  const todayStr = new Date(nowMs).toISOString().slice(0, 10)
  // Compute week start: Sunday-based week
  const nowDate = new Date(nowMs)
  const dayOfWeek = nowDate.getDay()
  const weekStartDate = new Date(nowMs - dayOfWeek * 86400000)
  const weekStartStr = weekStartDate.toISOString().slice(0, 10)
  // Threshold for completedLast7Days: 7 days ago as ISO string prefix
  const sevenDaysAgoMs = nowMs - 7 * 86400000
  const sevenDaysAgoStr = new Date(sevenDaysAgoMs).toISOString().slice(0, 10)
  // Today start ms for timeSpentToday
  const todayStartMs = new Date(todayStr).getTime()

  let total = 0
  let completedLast7Days = 0
  let timeSpentToday = 0

  for (const t of tasks) {
    if (t.archived) continue
    total++
    byStatus[t.status]++
    byPriority[t.priority]++

    if (t.status === 'done') {
      completed++
      if (t.completedAt) {
        // Use string prefix comparison instead of Date objects
        const completedDate = t.completedAt.slice(0, 10)
        if (completedDate === todayStr) completedToday++
        if (completedDate >= weekStartStr) completedThisWeek++
        if (completedDate >= sevenDaysAgoStr) completedLast7Days++
        // Parse timestamps once for completion time calculation
        const createdMs = Date.parse(t.createdAt)
        const completedMs = Date.parse(t.completedAt)
        totalCompletionTime += (completedMs - createdMs) / 3600000
        completedWithTime++
      }
    }

    if (t.dueDate && t.dueDate < todayStr && t.status !== 'done') overdue++

    if (t.timeEntries && t.timeEntries.length > 0) {
      tasksWithTime++
      for (const e of t.timeEntries) {
        totalTimeSpent += e.duration
        if (!e.endTime) trackingActive++
        // Check if time entry started today using Date.parse (cached todayStartMs)
        const startMs = Date.parse(e.startTime)
        if (startMs >= todayStartMs) timeSpentToday += e.duration
      }
    }
  }

  return {
    total,
    completed,
    overdue,
    byStatus,
    byPriority,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    totalTimeSpent,
    tasksWithTime,
    trackingActive,
    completedToday,
    completedThisWeek,
    avgCompletionTimeHours: completedWithTime > 0 ? totalCompletionTime / completedWithTime : null,
    completedLast7Days,
    timeSpentToday,
  }
}

// The offline API implementation matching the REST API shape
export const offlineApi = {
  tasks: {
    list: async (): Promise<Task[]> => loadTasks(),
    get: async (id: string): Promise<Task> => {
      const task = loadTasks().find(t => t.id === id)
      if (!task) throw new Error('Task not found')
      return task
    },
    create: async (data: Partial<Task>): Promise<Task> => {
      const tasks = loadTasks()
      const now = new Date().toISOString()
      const task: Task = {
        id: generateId(),
        title: data.title || 'Untitled',
        description: data.description || '',
        status: data.status || 'todo',
        priority: data.priority || 'medium',
        category: data.category || 'cat-work',
        tags: data.tags || [],
        dueDate: data.dueDate || null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        order: tasks.length,
        pinned: data.pinned || false,
        archived: false,
        timeEntries: [],
        estimatedMinutes: data.estimatedMinutes || null,
        nextAction: data.nextAction || '',
        energyLevel: data.energyLevel || 'medium',
        blockerReason: data.blockerReason || '',
        activityLog: [],
        notes: [],
        subtasks: data.subtasks || [],
        dependencies: [],
        recurring: data.recurring || null,
        linkedNoteIds: data.linkedNoteIds || [],
      }
      tasks.push(task)
      saveTasks(tasks)
      return task
    },
    update: async (id: string, data: Partial<Task>): Promise<Task> => {
      const tasks = loadTasks()
      const idx = tasks.findIndex(t => t.id === id)
      if (idx === -1) throw new Error('Task not found')
      tasks[idx] = { ...tasks[idx], ...data, updatedAt: new Date().toISOString() }
      if (data.status === 'done' && !tasks[idx].completedAt) {
        tasks[idx].completedAt = new Date().toISOString()
      }
      if (data.status === 'done' && shouldAddCompletionReview(tasks[idx])) {
        tasks[idx].notes = [...(tasks[idx].notes || []), createCompletionReviewNote({ task: tasks[idx] })]
      }
      // Auto-create next recurring task
      if (data.status === 'done' && shouldCreateNextRecurrence(tasks[idx])) {
        const task = tasks[idx]
        const nextDueDate = calculateNextDueDate(task.dueDate!, task.recurring!)
        if (nextDueDate) {
          const now = new Date().toISOString()
          const nextTask: Task = {
            ...task,
            id: generateId(),
            status: 'todo',
            completedAt: null,
            dueDate: nextDueDate,
            createdAt: now,
            updatedAt: now,
            timeEntries: [],
            activityLog: [],
            notes: [],
            subtasks: task.subtasks.map((st) => ({ ...st, id: generateId(), completed: false })),
            linkedNoteIds: [],
          }
          // Decrement maxOccurrences if set
          if (task.recurring!.maxOccurrences !== null && task.recurring!.maxOccurrences !== undefined) {
            nextTask.recurring = { ...task.recurring!, maxOccurrences: task.recurring!.maxOccurrences - 1 }
          }
          tasks.push(nextTask)
        }
      }
      saveTasks(tasks)
      return tasks[idx]
    },
    delete: async (id: string): Promise<void> => {
      const tasks = loadTasks().filter(t => t.id !== id)
      saveTasks(tasks)
    },
    batchDelete: async (ids: string[]): Promise<{ deleted: number }> => {
      const idSet = new Set(ids)
      const tasks = loadTasks().filter(t => !idSet.has(t.id))
      saveTasks(tasks)
      return { deleted: ids.length }
    },
    batchUpdateStatus: async (ids: string[], status: string): Promise<Task[]> => {
      const tasks = loadTasks()
      const idSet = new Set(ids)
      const updated: Task[] = []
      const now = new Date().toISOString()
      for (const t of tasks) {
        if (idSet.has(t.id)) {
          t.status = status as Status
          t.updatedAt = now
          if (status === 'done') {
            t.completedAt = now
            if (shouldAddCompletionReview(t)) t.notes = [...(t.notes || []), createCompletionReviewNote({ task: t })]
            // Auto-create next recurring task
            if (shouldCreateNextRecurrence(t)) {
              const nextDueDate = calculateNextDueDate(t.dueDate!, t.recurring!)
              if (nextDueDate) {
                const nextTask: Task = {
                  ...t,
                  id: generateId(),
                  status: 'todo',
                  completedAt: null,
                  dueDate: nextDueDate,
                  createdAt: now,
                  updatedAt: now,
                  timeEntries: [],
                  activityLog: [],
                  notes: [],
                  subtasks: t.subtasks.map((st) => ({ ...st, id: generateId(), completed: false })),
                  linkedNoteIds: [],
                }
                if (t.recurring!.maxOccurrences !== null && t.recurring!.maxOccurrences !== undefined) {
                  nextTask.recurring = { ...t.recurring!, maxOccurrences: t.recurring!.maxOccurrences - 1 }
                }
                tasks.push(nextTask)
              }
            }
          }
          updated.push(t)
        }
      }
      saveTasks(tasks)
      return updated
    },
    batchUpdatePriority: async (ids: string[], priority: string): Promise<Task[]> => {
      return batchUpdateTasks(ids, (t) => { t.priority = priority as Priority }).updated
    },
    batchUpdateCategory: async (ids: string[], category: string): Promise<Task[]> => {
      return batchUpdateTasks(ids, (t) => { t.category = category }).updated
    },
    batchAddTags: async (ids: string[], tags: string[]): Promise<Task[]> => {
      return batchUpdateTasks(ids, (t) => {
        for (const tag of tags) { if (!t.tags.includes(tag)) t.tags.push(tag) }
      }).updated
    },
    batchRemoveTags: async (ids: string[], tags: string[]): Promise<Task[]> => {
      const tagSet = new Set(tags)
      return batchUpdateTasks(ids, (t) => {
        t.tags = t.tags.filter(tag => !tagSet.has(tag))
      }).updated
    },
    batchSnooze: async (ids: string[], days: number): Promise<Task[]> => {
      return batchUpdateTasks(ids, (t) => {
        if (t.dueDate) {
          const d = new Date(t.dueDate)
          d.setDate(d.getDate() + days)
          t.dueDate = d.toISOString().slice(0, 10)
        }
      }).updated
    },
    duplicate: async (id: string): Promise<Task> => {
      const tasks = loadTasks()
      const original = tasks.find(t => t.id === id)
      if (!original) throw new Error('Task not found')
      const now = new Date().toISOString()
      const copy: Task = {
        ...original,
        id: generateId(),
        title: `${original.title} (copy)`,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        status: 'todo',
        order: tasks.length,
        timeEntries: [],
        activityLog: [],
      }
      tasks.push(copy)
      saveTasks(tasks)
      return copy
    },
    batchDuplicate: async (ids: string[]): Promise<Task[]> => {
      const tasks = loadTasks()
      const idSet = new Set(ids)
      const copies: Task[] = []
      const now = new Date().toISOString()
      for (const t of tasks) {
        if (idSet.has(t.id)) {
          const copy: Task = {
            ...t,
            id: generateId(),
            title: `${t.title} (copy)`,
            createdAt: now,
            updatedAt: now,
            completedAt: null,
            status: 'todo',
            order: tasks.length + copies.length,
            timeEntries: [],
            activityLog: [],
          }
          copies.push(copy)
        }
      }
      tasks.push(...copies)
      saveTasks(tasks)
      return copies
    },
    batchCreate: async (taskList: Partial<Task>[]): Promise<Task[]> => {
      const tasks = loadTasks()
      const created: Task[] = []
      const now = new Date().toISOString()
      for (const data of taskList) {
        const task: Task = {
          id: generateId(),
          title: data.title || 'Untitled',
          description: data.description || '',
          status: data.status || 'todo',
          priority: data.priority || 'medium',
          category: data.category || 'cat-work',
          tags: data.tags || [],
          dueDate: data.dueDate || null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
          order: tasks.length + created.length,
          pinned: false,
          archived: false,
          timeEntries: [],
          estimatedMinutes: data.estimatedMinutes || null,
          nextAction: data.nextAction || '',
          energyLevel: data.energyLevel || 'medium',
          blockerReason: data.blockerReason || '',
          activityLog: [],
          notes: [],
          subtasks: data.subtasks || [],
          dependencies: [],
          recurring: null,
          linkedNoteIds: [],
        }
        created.push(task)
      }
      tasks.push(...created)
      saveTasks(tasks)
      return created
    },
    reorder: async (orderedIds: string[]): Promise<Task[]> => {
      const tasks = loadTasks()
      const orderMap = new Map(orderedIds.map((id, i) => [id, i]))
      for (const t of tasks) {
        const newOrder = orderMap.get(t.id)
        if (newOrder !== undefined) t.order = newOrder
      }
      saveTasks(tasks)
      return tasks
    },
    import: async (taskList: Partial<Task>[]): Promise<Task[]> => {
      const tasks = loadTasks()
      const imported: Task[] = []
      for (const data of taskList) {
        const task: Task = {
          id: data.id || generateId(),
          title: data.title || 'Untitled',
          description: data.description || '',
          status: data.status || 'todo',
          priority: data.priority || 'medium',
          category: data.category || 'cat-work',
          tags: data.tags || [],
          dueDate: data.dueDate || null,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: data.completedAt || null,
          order: data.order ?? tasks.length + imported.length,
          pinned: data.pinned || false,
          archived: data.archived || false,
          timeEntries: data.timeEntries || [],
          estimatedMinutes: data.estimatedMinutes || null,
          nextAction: data.nextAction || '',
          energyLevel: data.energyLevel || 'medium',
          blockerReason: data.blockerReason || '',
          activityLog: data.activityLog || [],
          notes: data.notes || [],
          subtasks: data.subtasks || [],
          dependencies: data.dependencies || [],
          recurring: data.recurring || null,
          linkedNoteIds: data.linkedNoteIds || [],
        }
        const existingIdx = tasks.findIndex((t) => t.id === task.id)
        if (existingIdx >= 0) tasks[existingIdx] = task
        else tasks.push(task)
        imported.push(task)
      }
      saveTasks(tasks)
      return imported
    },
    startTime: async (id: string, description?: string): Promise<Task> => {
      const tasks = loadTasks()
      const task = tasks.find(t => t.id === id)
      if (!task) throw new Error('Task not found')
      task.timeEntries.push({
        id: generateId(),
        startTime: new Date().toISOString(),
        endTime: null,
        duration: 0,
        description: description || '',
      })
      task.updatedAt = new Date().toISOString()
      saveTasks(tasks)
      return task
    },
    stopTime: async (id: string): Promise<Task> => {
      const tasks = loadTasks()
      const task = tasks.find(t => t.id === id)
      if (!task) throw new Error('Task not found')
      for (const entry of task.timeEntries) {
        if (!entry.endTime) {
          entry.endTime = new Date().toISOString()
          entry.duration = Math.floor((new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 1000)
        }
      }
      task.updatedAt = new Date().toISOString()
      saveTasks(tasks)
      return task
    },
    addNote: async (id: string, content: string) => {
      const tasks = loadTasks()
      const task = tasks.find(t => t.id === id)
      if (!task) throw new Error('Task not found')
      const note = { id: generateId(), content, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      task.notes.push(note)
      task.updatedAt = new Date().toISOString()
      saveTasks(tasks)
      return note
    },
    updateNote: async (taskId: string, noteId: string, content: string) => {
      const tasks = loadTasks()
      const task = tasks.find(t => t.id === taskId)
      if (!task) throw new Error('Task not found')
      const note = task.notes.find(n => n.id === noteId)
      if (!note) throw new Error('Note not found')
      note.content = content
      note.updatedAt = new Date().toISOString()
      task.updatedAt = new Date().toISOString()
      saveTasks(tasks)
      return note
    },
    deleteNote: async (taskId: string, noteId: string): Promise<void> => {
      const tasks = loadTasks()
      const task = tasks.find(t => t.id === taskId)
      if (!task) throw new Error('Task not found')
      task.notes = task.notes.filter(n => n.id !== noteId)
      task.updatedAt = new Date().toISOString()
      saveTasks(tasks)
    },
    addSubtask: async (id: string, title: string) => {
      const tasks = loadTasks()
      const task = tasks.find(t => t.id === id)
      if (!task) throw new Error('Task not found')
      const subtask = { id: generateId(), title, completed: false, createdAt: new Date().toISOString() }
      task.subtasks.push(subtask)
      task.updatedAt = new Date().toISOString()
      saveTasks(tasks)
      return subtask
    },
    toggleSubtask: async (taskId: string, subtaskId: string) => {
      const tasks = loadTasks()
      const task = tasks.find(t => t.id === taskId)
      if (!task) throw new Error('Task not found')
      const subtask = task.subtasks.find(s => s.id === subtaskId)
      if (!subtask) throw new Error('Subtask not found')
      subtask.completed = !subtask.completed
      task.updatedAt = new Date().toISOString()
      saveTasks(tasks)
      return subtask
    },
    deleteSubtask: async (taskId: string, subtaskId: string): Promise<void> => {
      const tasks = loadTasks()
      const task = tasks.find(t => t.id === taskId)
      if (!task) throw new Error('Task not found')
      task.subtasks = task.subtasks.filter(s => s.id !== subtaskId)
      task.updatedAt = new Date().toISOString()
      saveTasks(tasks)
    },
    addDependency: async (taskId: string, dependsOnId: string, type: 'blocks' | 'blocked-by') => {
      const tasks = loadTasks()
      const task = tasks.find(t => t.id === taskId)
      if (!task) throw new Error('Task not found')
      const dep = { id: generateId(), taskId, dependsOnId, type }
      task.dependencies.push(dep)
      task.updatedAt = new Date().toISOString()
      saveTasks(tasks)
      return dep
    },
    removeDependency: async (taskId: string, dependencyId: string): Promise<void> => {
      const tasks = loadTasks()
      const task = tasks.find(t => t.id === taskId)
      if (!task) throw new Error('Task not found')
      task.dependencies = task.dependencies.filter(d => d.id !== dependencyId)
      task.updatedAt = new Date().toISOString()
      saveTasks(tasks)
    },
    getDependencies: async (taskId: string) => {
      const tasks = loadTasks()
      const task = tasks.find(t => t.id === taskId)
      if (!task) throw new Error('Task not found')
      const blocking: Task[] = []
      const blockedBy: Task[] = []
      for (const dep of task.dependencies) {
        const depTask = tasks.find(t => t.id === dep.dependsOnId)
        if (depTask) {
          if (dep.type === 'blocks') blocking.push(depTask)
          else blockedBy.push(depTask)
        }
      }
      return { blocking, blockedBy }
    },
    createNextRecurring: async (taskId: string): Promise<Task> => {
      const tasks = loadTasks()
      const original = tasks.find(t => t.id === taskId)
      if (!original) throw new Error('Task not found')
      const now = new Date().toISOString()
      const next: Task = {
        ...original,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        status: 'todo',
        order: tasks.length,
        timeEntries: [],
        activityLog: [],
      }
      tasks.push(next)
      saveTasks(tasks)
      return next
    },
    togglePin: async (taskId: string, pinned: boolean): Promise<Task> => {
      const tasks = loadTasks()
      const task = tasks.find(t => t.id === taskId)
      if (!task) throw new Error('Task not found')
      task.pinned = pinned
      task.updatedAt = new Date().toISOString()
      saveTasks(tasks)
      return task
    },
    archive: async (id: string): Promise<Task> => {
      const tasks = loadTasks()
      const task = tasks.find(t => t.id === id)
      if (!task) throw new Error('Task not found')
      task.archived = true
      task.updatedAt = new Date().toISOString()
      saveTasks(tasks)
      return task
    },
    unarchive: async (id: string): Promise<Task> => {
      const tasks = loadTasks()
      const task = tasks.find(t => t.id === id)
      if (!task) throw new Error('Task not found')
      task.archived = false
      task.updatedAt = new Date().toISOString()
      saveTasks(tasks)
      return task
    },
    batchArchive: async (ids: string[]): Promise<Task[]> => {
      const tasks = loadTasks()
      const idSet = new Set(ids)
      const updated: Task[] = []
      const now = new Date().toISOString()
      for (const t of tasks) {
        if (idSet.has(t.id)) {
          t.archived = true
          t.updatedAt = now
          updated.push(t)
        }
      }
      saveTasks(tasks)
      return updated
    },
    batchUnarchive: async (ids: string[]): Promise<Task[]> => {
      const tasks = loadTasks()
      const idSet = new Set(ids)
      const updated: Task[] = []
      const now = new Date().toISOString()
      for (const t of tasks) {
        if (idSet.has(t.id)) {
          t.archived = false
          t.updatedAt = now
          updated.push(t)
        }
      }
      saveTasks(tasks)
      return updated
    },
    batchPin: async (ids: string[]): Promise<Task[]> => {
      return batchUpdateTasks(ids, (t) => { t.pinned = true }).updated
    },
    batchUnpin: async (ids: string[]): Promise<Task[]> => {
      return batchUpdateTasks(ids, (t) => { t.pinned = false }).updated
    },
  },
  categories: {
    list: async (): Promise<Category[]> => loadCategories(),
    create: async (data: Omit<Category, 'id'>): Promise<Category> => {
      const categories = loadCategories()
      const cat: Category = { id: generateId(), ...data }
      categories.push(cat)
      saveCategories(categories)
      return cat
    },
    update: async (id: string, data: Partial<Omit<Category, 'id'>>): Promise<Category> => {
      const categories = loadCategories()
      const cat = categories.find(c => c.id === id)
      if (!cat) throw new Error('Category not found')
      Object.assign(cat, data)
      saveCategories(categories)
      return cat
    },
    delete: async (id: string): Promise<void> => {
      let categories = loadCategories().filter(c => c.id !== id)
      if (categories.length === 0) {
        categories = getDefaultCategoriesWithoutPersist()
      }
      const fallback = categories[0]?.id || 'cat-work'
      saveCategories(categories)
      const tasks = loadTasks()
      let changed = false
      for (const task of tasks) {
        if (task.category === id) {
          task.category = fallback
          task.updatedAt = new Date().toISOString()
          changed = true
        }
      }
      if (changed) saveTasks(tasks)
    },
  },
  stats: {
    get: async (): Promise<TaskStats> => computeStats(loadTasks()),
  },
  health: async () => ({ status: 'desktop', timestamp: new Date().toISOString(), tasks: loadTasks().length, pending: 0, activeTimers: 0, overdue: 0, version: 1 }),
  export: async () => ({ tasks: loadTasks(), categories: loadCategories(), exportedAt: new Date().toISOString() }),
  dailyReview: {
    get: async () => {
      const tasks = loadTasks()
      const today = new Date().toISOString().slice(0, 10)
      const completed = tasks.filter(t => t.completedAt?.slice(0, 10) === today)
      const created = tasks.filter(t => t.createdAt.slice(0, 10) === today)
      return {
        today: { date: today, completed: completed.length, created: created.length, timeSpent: 0, topTasks: completed.slice(0, 5).map(t => ({ id: t.id, title: t.title, priority: t.priority, completedAt: t.completedAt! })), categories: {} },
        tomorrow: { date: '', dueTasks: [], inProgress: [] },
        insights: { completionRate: 0, avgTaskTime: 0, mostProductiveHour: 0, streakDays: 0, productivityScore: 0 },
      }
    },
  },
  productivityTrends: {
    get: async (days = 7) => buildProductivityTrends(loadTasks(), days),
  },
  weeklyReport: {
    get: async () => ({
      weekStart: '', weekEnd: '',
      summary: { completed: 0, created: 0, timeSpent: 0, avgDailyScore: 0, activeDays: 0, totalDays: 7 },
      dailyBreakdown: [], topCategories: [], topTags: [], streakDays: 0,
      comparison: { prevWeekCompleted: 0, change: 0, trend: 'flat' as const },
    }),
  },
  restore: async (backupIndex?: number) => {
    const backups = loadBackups()
    const backup = backups.find(item => item.index === (backupIndex ?? 0))
    if (!backup) return { status: 'error', message: '没有可恢复的备份' }
    localStorage.setItem(TASKS_KEY, JSON.stringify(backup.tasks))
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(backup.categories))
    return { status: 'ok', message: `已恢复 ${new Date(backup.modified).toLocaleString('zh-CN')} 的备份` }
  },
  backups: async () => loadBackups().map(({ index, modified }) => ({ index, file: `desktop-backup-${index}`, modified })),
}
