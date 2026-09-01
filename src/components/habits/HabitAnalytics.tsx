import { useMemo } from 'react'
import { BarChart3, Flame, Target, TrendingUp, Calendar } from 'lucide-react'
import type { Habit } from '../../store'
import { dayKeyFromMs } from '../../modules/taskflow/dateUtils'

interface HabitAnalyticsProps {
  habits: Habit[]
}

function dayKey(ts: number): string {
  return dayKeyFromMs(ts)
}

export default function HabitAnalytics({ habits }: HabitAnalyticsProps) {
  const stats = useMemo(() => {
    const now = new Date()
    const todayKey = dayKey(now.getTime())

    // Pre-convert completedDates to Sets for O(1) lookups
    const habitDateSets = habits.map((h) => new Set(h.completedDates))

    // 30-day heatmap per habit
    const heatmaps: Array<{ habit: Habit; days: Array<{ key: string; done: boolean }> }> = []
    for (let hi = 0; hi < habits.length; hi++) {
      const habit = habits[hi]
      const dateSet = habitDateSets[hi]
      const days: Array<{ key: string; done: boolean }> = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        const key = dayKey(d.getTime())
        days.push({ key, done: dateSet.has(key) })
      }
      heatmaps.push({ habit, days })
    }

    // Overall stats
    let totalCheckins = 0
    let bestStreak = 0
    let currentStreak = 0
    const completionRates: number[] = []

    for (let hi = 0; hi < habits.length; hi++) {
      const dateSet = habitDateSets[hi]
      // Count check-ins in last 30 days
      const d = new Date(now)
      let checkins30 = 0
      for (let i = 0; i < 30; i++) {
        const key = dayKey(d.getTime())
        if (dateSet.has(key)) checkins30++
        d.setDate(d.getDate() - 1)
      }
      totalCheckins += checkins30
      completionRates.push(Math.round((checkins30 / 30) * 100))

      // Streak calculation
      let streak = 0
      const sd = new Date(now)
      while (true) {
        const key = dayKey(sd.getTime())
        if (!dateSet.has(key) && key !== todayKey) break
        if (dateSet.has(key)) streak++
        sd.setDate(sd.getDate() - 1)
        if (streak > 365) break
      }
      if (streak > bestStreak) bestStreak = streak
    }

    // Current streak (consecutive days with at least one habit completed)
    const d = new Date(now)
    while (true) {
      const key = dayKey(d.getTime())
      const hasAny = habitDateSets.some((ds) => ds.has(key))
      if (!hasAny && key !== todayKey) break
      if (hasAny) currentStreak++
      d.setDate(d.getDate() - 1)
      if (currentStreak > 365) break
    }

    const avgRate = completionRates.length > 0 ? Math.round(completionRates.reduce((a, b) => a + b, 0) / completionRates.length) : 0

    // Weekly trend (last 4 weeks)
    const weeklyTrend: Array<{ label: string; rate: number }> = []
    for (let w = 3; w >= 0; w--) {
      let total = 0
      let done = 0
      for (let hi = 0; hi < habits.length; hi++) {
        const dateSet = habitDateSets[hi]
        for (let dd = 0; dd < 7; dd++) {
          const date = new Date(now)
          date.setDate(date.getDate() - (w * 7 + dd))
          const key = dayKey(date.getTime())
          total++
          if (dateSet.has(key)) done++
        }
      }
      const rate = total > 0 ? Math.round((done / total) * 100) : 0
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - (w * 7 + 6))
      weeklyTrend.push({ label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`, rate })
    }

    return { heatmaps, totalCheckins, bestStreak, currentStreak, avgRate, weeklyTrend }
  }, [habits])

  if (habits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <Target size={40} className="mb-3 opacity-30" />
        <p className="text-sm">暂无习惯，添加习惯后可查看分析数据</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card icon={<Target className="text-primary" size={18} />} label="习惯总数" value={`${habits.length}`} />
        <Card icon={<Flame className="text-orange-400" size={18} />} label="连续天数" value={`${stats.currentStreak} 天`} />
        <Card icon={<TrendingUp className="text-emerald-400" size={18} />} label="30天完成率" value={`${stats.avgRate}%`} />
        <Card icon={<Calendar className="text-blue-400" size={18} />} label="总打卡" value={`${stats.totalCheckins} 次`} />
      </div>

      {/* Weekly trend */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">近 4 周完成率趋势</h3>
        </div>
        <div className="flex items-end gap-3 h-24">
          {stats.weeklyTrend.map((week) => (
            <div key={week.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-400">{week.rate}%</span>
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-primary to-primary-light transition-all duration-300"
                style={{ height: `${Math.max(week.rate * 0.8, week.rate > 0 ? 4 : 0)}px` }}
              />
              <span className="text-[10px] text-gray-400">{week.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-habit heatmaps */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">习惯打卡热力图（近 30 天）</h3>
        {stats.heatmaps.map(({ habit, days }) => {
          const doneCount = days.filter((d) => d.done).length
          const rate = Math.round((doneCount / 30) * 100)
          return (
            <div key={habit.id} className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="h-6 w-6 rounded-lg flex items-center justify-center text-sm"
                  style={{ backgroundColor: habit.color + '20', color: habit.color }}
                >
                  {habit.icon}
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{habit.name}</span>
                <span className="ml-auto text-xs text-gray-400">{doneCount}/30 · {rate}%</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {days.map((day) => (
                  <div
                    key={day.key}
                    title={`${day.key}: ${day.done ? '✓' : '✗'}`}
                    className="h-5 w-5 rounded-sm transition-colors"
                    style={{
                      backgroundColor: day.done ? habit.color : 'var(--color-surface-lighter)',
                      opacity: day.done ? 1 : 0.5,
                    }}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass-card p-3">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{value}</div>
    </div>
  )
}
