export interface AchievementTask {
  id: string
  completed: boolean
}

export interface AchievementHabit {
  id: string
  name: string
  completedDates: string[]
}

export interface AchievementNote {
  id: string
  title: string
  content: string
  createdAt: number
}

export interface AchievementPomodoroSession {
  id: string
  startedAt: number
  endedAt: number
  type: 'work' | 'break'
  completed: boolean
}

export interface AchievementInput {
  todayStr: string
  todayMidnightMs: number
  tasks: AchievementTask[]
  habits: AchievementHabit[]
  notes: AchievementNote[]
  pomodoroSessions: AchievementPomodoroSession[]
}

export interface AchievementBadge {
  id: 'focus-streak' | 'habit-streak' | 'inbox-zero' | 'weekly-review'
  title: string
  description: string
  value: string
  unlocked: boolean
}

const DAY = 86400000

// Use pure arithmetic instead of Date objects for better performance
function dayNumToDateStr(dayNum: number): string {
  const { y, m, d } = dayNumToYMD(dayNum)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

function dayNumToYMD(dayNum: number): { y: number; m: number; d: number } {
  let y = Math.floor(dayNum / 365) + 1970
  let yStart = Math.floor(Date.UTC(y, 0, 0) / 86400000)
  if (yStart > dayNum) { y--; yStart = Math.floor(Date.UTC(y, 0, 0) / 86400000) }
  else {
    const yStartNext = Math.floor(Date.UTC(y + 1, 0, 0) / 86400000)
    if (yStartNext <= dayNum) { y++; yStart = yStartNext }
  }
  const dayOfYear = dayNum - yStart
  const isLeap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
  let m = 12
  for (let i = 12; i >= 1; i--) {
    const ms = MONTH_STARTS[i - 1] + (isLeap && i > 2 ? 1 : 0)
    if (dayOfYear > ms) { m = i; break }
  }
  const monthStart = MONTH_STARTS[m - 1] + (isLeap && m > 2 ? 1 : 0)
  return { y, m, d: dayOfYear - monthStart }
}

function getFocusStreak(input: AchievementInput): number {
  const focusDays = new Set(
    input.pomodoroSessions
      .filter((session) => session.type === 'work' && session.completed)
      .map((session) => dayNumToDateStr(Math.floor(session.startedAt / DAY)))
  )
  const todayDay = Math.floor(input.todayMidnightMs / DAY)
  let streak = 0
  for (let offset = 0; offset < 365; offset++) {
    if (!focusDays.has(dayNumToDateStr(todayDay - offset))) break
    streak++
  }
  return streak
}

function getBestHabitStreak(input: AchievementInput): number {
  const todayDay = Math.floor(input.todayMidnightMs / DAY)
  let best = 0
  for (const habit of input.habits) {
    const dates = new Set(habit.completedDates)
    let streak = 0
    for (let offset = 0; offset < 365; offset++) {
      if (!dates.has(dayNumToDateStr(todayDay - offset))) break
      streak++
    }
    best = Math.max(best, streak)
  }
  return best
}

function hasWeeklyReview(input: AchievementInput): boolean {
  const weekStartMs = input.todayMidnightMs - 6 * DAY
  return input.notes.some((note) => (
    note.createdAt >= weekStartMs &&
    /复盘|review|周总结|weekly/i.test(`${note.title}\n${note.content}`)
  ))
}

export function buildAchievements(input: AchievementInput): { badges: AchievementBadge[] } {
  const focusStreak = getFocusStreak(input)
  const habitStreak = getBestHabitStreak(input)
  const activeTasks = input.tasks.filter((task) => !task.completed).length
  const weeklyReview = hasWeeklyReview(input)

  return {
    badges: [
      {
        id: 'focus-streak',
        title: '连续专注',
        description: '连续有完成番茄钟的天数',
        value: `${focusStreak} 天`,
        unlocked: focusStreak >= 3,
      },
      {
        id: 'habit-streak',
        title: '连续打卡',
        description: '单个习惯的最长连续记录',
        value: `${habitStreak} 天`,
        unlocked: habitStreak >= 3,
      },
      {
        id: 'inbox-zero',
        title: '清空收件箱',
        description: '当前没有未完成任务',
        value: activeTasks === 0 ? '已清空' : `${activeTasks} 项`,
        unlocked: activeTasks === 0,
      },
      {
        id: 'weekly-review',
        title: '每周复盘',
        description: '最近 7 天写过复盘笔记',
        value: weeklyReview ? '已完成' : '未记录',
        unlocked: weeklyReview,
      },
    ],
  }
}
