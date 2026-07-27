import type { Task } from '../modules/taskflow/types'
import type { Habit } from '../store'

export interface NotificationItem {
  id: string
  type: 'task-overdue' | 'task-due-today' | 'task-due-tomorrow' | 'habit-reminder'
  title: string
  body: string
  timestamp: number
  read: boolean
}

const STORAGE_KEY = 'abworkbench-notifications'
const CHECK_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function tomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function showBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.svg', silent: false })
  }
}

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return Promise.resolve('denied')
  if (Notification.permission === 'granted') return Promise.resolve('granted')
  return Notification.requestPermission()
}

export function checkNotifications(tasks: Task[], habits: Habit[]): NotificationItem[] {
  const today = todayStr()
  const tomorrow = tomorrowStr()
  const now = Date.now()
  const notifications: NotificationItem[] = []

  // Check overdue tasks
  for (const task of tasks) {
    if (task.status === 'done' || task.archived || !task.dueDate) continue
    const dueDate = task.dueDate.slice(0, 10)
    if (dueDate < today) {
      notifications.push({
        id: `overdue-${task.id}-${today}`,
        type: 'task-overdue',
        title: '任务逾期',
        body: `「${task.title}」已逾期，截止日期 ${dueDate}`,
        timestamp: now,
        read: false,
      })
    } else if (dueDate === today) {
      notifications.push({
        id: `due-today-${task.id}-${today}`,
        type: 'task-due-today',
        title: '今日到期',
        body: `「${task.title}」今天到期`,
        timestamp: now,
        read: false,
      })
    } else if (dueDate === tomorrow) {
      notifications.push({
        id: `due-tomorrow-${task.id}-${today}`,
        type: 'task-due-tomorrow',
        title: '明日到期',
        body: `「${task.title}」明天到期`,
        timestamp: now,
        read: false,
      })
    }
  }

  // Check incomplete habits for today
  for (const habit of habits) {
    if (!habit.completedDates.includes(today)) {
      notifications.push({
        id: `habit-${habit.id}-${today}`,
        type: 'habit-reminder',
        title: '习惯提醒',
        body: `今天还没有完成「${habit.name}」`,
        timestamp: now,
        read: false,
      })
    }
  }

  return notifications
}

export function loadReadNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

export function saveReadNotificationIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch { /* ignore */ }
}

export function getUnreadCount(notifications: NotificationItem[], readIds: Set<string>): number {
  return notifications.filter((n) => !readIds.has(n.id)).length
}

export function sendBrowserNotifications(notifications: NotificationItem[], readIds: Set<string>): void {
  for (const n of notifications) {
    if (!readIds.has(n.id)) {
      showBrowserNotification(n.title, n.body)
    }
  }
}

export { CHECK_INTERVAL_MS }
