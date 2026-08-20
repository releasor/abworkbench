import type { Task } from '../modules/taskflow/types'
import type { PomodoroSession, Habit, Note } from '../store'
import { dayKeyFromMs } from '../modules/taskflow/dateUtils'

function dayKey(ts: number): string {
  return dayKeyFromMs(ts)
}

export function generateWeeklyReport(params: {
  tasks: Task[]
  pomodoroSessions: PomodoroSession[]
  habits: Habit[]
  notes: Note[]
  now?: Date
}): string {
  const now = params.now || new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoMs = weekAgo.getTime()
  const nowMs = now.getTime()

  // Tasks
  const completedTasks = params.tasks.filter((t) => t.completedAt && Date.parse(t.completedAt) >= weekAgoMs)
  const createdTasks = params.tasks.filter((t) => Date.parse(t.createdAt) >= weekAgoMs)
  const overdueTasks = params.tasks.filter((t) => t.status !== 'done' && !t.archived && t.dueDate && t.dueDate.slice(0, 10) < dayKey(nowMs))

  // Pomodoro
  const weekPomodoros = params.pomodoroSessions.filter((s) => s.type === 'work' && s.completed && s.startedAt >= weekAgoMs)
  const totalFocusMinutes = weekPomodoros.reduce((sum, s) => sum + Math.round((s.endedAt - s.startedAt) / 60000), 0)

  // Habits
  let totalHabitCheckins = 0
  let totalHabitPossible = 0
  for (const habit of params.habits) {
    for (let i = 0; i < 7; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = dayKey(d.getTime())
      totalHabitPossible++
      if (habit.completedDates.includes(key)) totalHabitCheckins++
    }
  }

  // Notes
  const weekNotes = params.notes.filter((n) => n.updatedAt >= weekAgoMs)
  const newNotes = params.notes.filter((n) => n.createdAt >= weekAgoMs)

  // Daily breakdown
  const dailyLines: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = dayKey(d.getTime())
    const dayDone = completedTasks.filter((t) => dayKey(Date.parse(t.completedAt!)) === key).length
    const dayPomodoros = weekPomodoros.filter((s) => dayKey(s.startedAt) === key).length
    const dayHabits = params.habits.filter((h) => h.completedDates.includes(key)).length
    dailyLines.push(`| ${key} | ${dayDone} | ${dayPomodoros} | ${dayHabits}/${params.habits.length} |`)
  }

  const habitRate = totalHabitPossible > 0 ? Math.round((totalHabitCheckins / totalHabitPossible) * 100) : 0

  return `# 周报 ${dayKey(weekAgoMs)} ~ ${dayKey(nowMs)}

## 📊 概览

| 指标 | 数值 |
|------|------|
| 完成任务 | ${completedTasks.length} |
| 新建任务 | ${createdTasks.length} |
| 逾期任务 | ${overdueTasks.length} |
| 番茄钟 | ${weekPomodoros.length} |
| 专注时间 | ${Math.round(totalFocusMinutes / 60)} 小时 ${totalFocusMinutes % 60} 分钟 |
| 习惯完成率 | ${habitRate}% (${totalHabitCheckins}/${totalHabitPossible}) |
| 笔记更新 | ${weekNotes.length} |
| 新建笔记 | ${newNotes.length} |

## 📅 每日明细

| 日期 | 完成任务 | 番茄钟 | 习惯 |
|------|----------|--------|------|
${dailyLines.join('\n')}

${completedTasks.length > 0 ? `## ✅ 已完成任务\n\n${completedTasks.map((t) => `- ${t.title}`).join('\n')}\n` : ''}
${overdueTasks.length > 0 ? `## ⚠️ 逾期任务\n\n${overdueTasks.map((t) => `- ${t.title} (截止 ${t.dueDate!.slice(0, 10)})`).join('\n')}\n` : ''}

---
*生成时间: ${now.toLocaleString('zh-CN')}*
`
}

export function generateMonthlyReport(params: {
  tasks: Task[]
  pomodoroSessions: PomodoroSession[]
  habits: Habit[]
  notes: Note[]
  now?: Date
}): string {
  const now = params.now || new Date()
  const monthAgo = new Date(now)
  monthAgo.setDate(monthAgo.getDate() - 30)
  const monthAgoMs = monthAgo.getTime()
  const nowMs = now.getTime()

  // Tasks
  const completedTasks = params.tasks.filter((t) => t.completedAt && Date.parse(t.completedAt) >= monthAgoMs)
  const createdTasks = params.tasks.filter((t) => Date.parse(t.createdAt) >= monthAgoMs)

  // Pomodoro
  const monthPomodoros = params.pomodoroSessions.filter((s) => s.type === 'work' && s.completed && s.startedAt >= monthAgoMs)
  const totalFocusMinutes = monthPomodoros.reduce((sum, s) => sum + Math.round((s.endedAt - s.startedAt) / 60000), 0)
  const focusDays = new Set(monthPomodoros.map((s) => dayKey(s.startedAt))).size
  const avgDaily = focusDays > 0 ? Math.round(totalFocusMinutes / focusDays) : 0

  // Habits
  let totalCheckins = 0
  let totalPossible = 0
  const habitStats: Array<{ name: string; checkins: number; rate: number }> = []
  for (const habit of params.habits) {
    let checkins = 0
    for (let i = 0; i < 30; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = dayKey(d.getTime())
      totalPossible++
      if (habit.completedDates.includes(key)) { checkins++; totalCheckins++ }
    }
    habitStats.push({ name: habit.name, checkins, rate: Math.round((checkins / 30) * 100) })
  }

  // Notes
  const newNotes = params.notes.filter((n) => n.createdAt >= monthAgoMs)

  return `# 月报 ${dayKey(monthAgoMs)} ~ ${dayKey(nowMs)}

## 📊 概览

| 指标 | 数值 |
|------|------|
| 完成任务 | ${completedTasks.length} |
| 新建任务 | ${createdTasks.length} |
| 番茄钟 | ${monthPomodoros.length} |
| 专注时间 | ${Math.round(totalFocusMinutes / 60)} 小时 |
| 专注天数 | ${focusDays} 天 |
| 日均专注 | ${avgDaily} 分钟 |
| 习惯完成率 | ${totalPossible > 0 ? Math.round((totalCheckins / totalPossible) * 100) : 0}% |
| 新建笔记 | ${newNotes.length} |

## 🎯 习惯详情

| 习惯 | 打卡次数 | 完成率 |
|------|----------|--------|
${habitStats.map((h) => `| ${h.name} | ${h.checkins} | ${h.rate}% |`).join('\n')}

---
*生成时间: ${now.toLocaleString('zh-CN')}*
`
}

export function downloadReport(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
