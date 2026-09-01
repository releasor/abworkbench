import type { HabitSchedule } from '../../store'

export const HABIT_ICONS = ['💧', '🏃', '📖', '🧘', '💪', '🎯', '✍️', '🍎', '🌙', '🎵', '🧹', '🌿']

export const HABIT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

export const HABIT_TEMPLATES: Array<{
  name: string
  icon: string
  color: string
  schedule?: HabitSchedule
}> = [
  { name: '喝 8 杯水', icon: '💧', color: '#3b82f6', schedule: { mode: 'multiple', targetCount: 8 } },
  { name: '运动 30 分钟', icon: '🏃', color: '#10b981' },
  { name: '阅读 30 分钟', icon: '📖', color: '#f59e0b' },
  { name: '早睡早起', icon: '🌙', color: '#8b5cf6', schedule: { mode: 'window', targetCount: 1, windowStartHour: 22, windowEndHour: 23 } },
]

export const STREAK_MILESTONES = [100, 60, 30, 14, 7]

export const MILESTONE_LABELS: Record<number, string> = {
  7: '一周',
  14: '两周',
  30: '一月',
  60: '两月',
  100: '百日',
}

export const WEEKDAY_SHORT_LABELS = ['一', '二', '三', '四', '五', '六', '日']
