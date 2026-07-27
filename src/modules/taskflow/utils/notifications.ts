import type { Task } from '../types'
import { todayStr, nextDateStr } from '../dateUtils';

const NOTIFICATION_THROTTLE_KEY = 'taskflow-last-notification';
const THROTTLE_MS = 30 * 60 * 1000; // 30 minutes

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

function shouldThrottle(): boolean {
  try {
    const last = localStorage.getItem(NOTIFICATION_THROTTLE_KEY);
    if (last && Date.now() - Number(last) < THROTTLE_MS) return true;
  } catch {
    // Ignore storage failures and allow notification checks.
  }
  return false;
}

function markNotified(): void {
  try {
    localStorage.setItem(NOTIFICATION_THROTTLE_KEY, String(Date.now()));
  } catch {
    // Ignore storage failures; throttling is best-effort.
  }
}

export function checkDueTasks(tasks: Task[]): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (shouldThrottle()) return;

  // Compare date portions only — task.dueDate is always midnight UTC,
  // so using full timestamps would falsely mark today's tasks as overdue.
  const today = todayStr();
  const tomorrow = nextDateStr(today);
  let dueSoonCount = 0;
  let overdueCount = 0;

  for (const task of tasks) {
    if (!task.dueDate || task.status === 'done') continue;
    const dueDatePart = task.dueDate.slice(0, 10);
    if (dueDatePart < today) {
      overdueCount++;
    } else if (dueDatePart <= tomorrow) {
      dueSoonCount++;
    }
  }

  let notified = false;

  if (dueSoonCount > 0) {
    new Notification('任务即将到期', {
      body: `您有 ${dueSoonCount} 个任务将在24小时内到期`,
      icon: '/favicon.ico',
      tag: 'due-soon',
    });
    notified = true;
  }

  if (overdueCount > 0) {
    new Notification('任务已逾期', {
      body: `您有 ${overdueCount} 个任务已逾期`,
      icon: '/favicon.ico',
      tag: 'overdue',
    });
    notified = true;
  }

  if (notified) markNotified();
}
