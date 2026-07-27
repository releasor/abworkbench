/**
 * One-time migration: move simple todos from dashboard-storage into taskflow offline storage.
 * Run once on app load; no-ops if already migrated.
 */
import type { Task } from '../types'
import { generateId } from '../../../utils/id'

const DASHBOARD_STORAGE_KEY = 'dashboard-storage'
const TASKFLOW_TASKS_KEY = 'taskflow-offline-tasks'
const MIGRATION_FLAG = 'taskflow-todos-migrated'

interface DashboardTodo {
  id: string
  text: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  createdAt: number
  completedAt?: number
  dueDate?: string
}

interface DashboardStorage {
  state?: { todos?: DashboardTodo[] }
}

export function migrateTodosIfNeeded(): void {
  try {
    if (localStorage.getItem(MIGRATION_FLAG)) return

    const raw = localStorage.getItem(DASHBOARD_STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(MIGRATION_FLAG, '1')
      return
    }

    const parsed: DashboardStorage = JSON.parse(raw)
    const todos = parsed?.state?.todos
    if (!todos || todos.length === 0) {
      localStorage.setItem(MIGRATION_FLAG, '1')
      return
    }

    // Load existing taskflow tasks
    const existingRaw = localStorage.getItem(TASKFLOW_TASKS_KEY)
    const existingTasks: Task[] = existingRaw ? JSON.parse(existingRaw) : []

    // Create a set of existing titles to avoid duplicates
    const existingTitles = new Set(existingTasks.map(t => t.title.toLowerCase()))

    const now = new Date().toISOString()
    const migrated: Task[] = []

    for (const todo of todos) {
      // Skip if a task with the same title already exists
      if (existingTitles.has(todo.text.toLowerCase())) continue

      const task: Task = {
        id: todo.id.length > 8 ? todo.id : generateId(),
        title: todo.text,
        description: '',
        status: todo.completed ? 'done' : 'todo',
        priority: todo.priority,
        category: '',
        tags: [],
        dueDate: todo.dueDate || null,
        createdAt: new Date(todo.createdAt).toISOString(),
        updatedAt: now,
        completedAt: todo.completedAt ? new Date(todo.completedAt).toISOString() : null,
        order: existingTasks.length + migrated.length,
        pinned: false,
        archived: false,
        timeEntries: [],
        estimatedMinutes: null,
        nextAction: '',
        energyLevel: 'medium',
        blockerReason: '',
        activityLog: [],
        notes: [],
        subtasks: [],
        dependencies: [],
        recurring: null,
        linkedNoteIds: [],
      }
      migrated.push(task)
    }

    if (migrated.length > 0) {
      const merged = [...existingTasks, ...migrated]
      localStorage.setItem(TASKFLOW_TASKS_KEY, JSON.stringify(merged))
    }

    // Clear todos from dashboard storage
    const dashboardData: DashboardStorage = JSON.parse(raw)
    if (dashboardData?.state?.todos) {
      dashboardData.state.todos = []
      localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(dashboardData))
    }

    localStorage.setItem(MIGRATION_FLAG, '1')
  } catch {
    // Migration failed silently; will retry next load
  }
}
