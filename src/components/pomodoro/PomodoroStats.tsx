import { useMemo } from 'react'
import { BarChart3, Flame, Clock, Target, TrendingUp } from 'lucide-react'
import type { PomodoroSession } from '../../store'

interface PomodoroStatsProps {
  sessions: PomodoroSession[]
  dailyGoal: number
}

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

export default function PomodoroStats({ sessions, dailyGoal }: PomodoroStatsProps) {
  const stats = useMemo(() => {
    const now = new Date()
    const todayKey = dayKey(now.getTime())
    const workSessions = sessions.filter((s) => s.type === 'work' && s.completed)

    // Today
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayMs = todayStart.getTime()
    const todaySessions = workSessions.filter((s) => s.startedAt >= todayMs)
    const todayMinutes = todaySessions.reduce((sum, s) => sum + Math.round((s.endedAt - s.startedAt) / 60000), 0)

    // This week (last 7 days)
    const weekData: Array<{ key: string; label: string; count: number; minutes: number }> = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = dayKey(d.getTime())
      const dayStart = new Date(d)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(d)
      dayEnd.setHours(23, 59, 59, 999)
      const daySessions = workSessions.filter((s) => s.startedAt >= dayStart.getTime() && s.startedAt <= dayEnd.getTime())
      const dayMinutes = daySessions.reduce((sum, s) => sum + Math.round((s.endedAt - s.startedAt) / 60000), 0)
      const label = `${d.getMonth() + 1}/${d.getDate()}`
      weekData.push({ key, label, count: daySessions.length, minutes: dayMinutes })
    }

    // This month (last 30 days)
    const monthData: Array<{ key: string; count: number }> = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = dayKey(d.getTime())
      const dayStart = new Date(d)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(d)
      dayEnd.setHours(23, 59, 59, 999)
      const count = workSessions.filter((s) => s.startedAt >= dayStart.getTime() && s.startedAt <= dayEnd.getTime()).length
      monthData.push({ key, count })
    }

    // Streak
    let streak = 0
    const d = new Date(now)
    while (true) {
      const key = dayKey(d.getTime())
      const dayStart = new Date(d)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(d)
      dayEnd.setHours(23, 59, 59, 999)
      const hasSession = workSessions.some((s) => s.startedAt >= dayStart.getTime() && s.startedAt <= dayEnd.getTime())
      if (!hasSession && key !== todayKey) break
      if (hasSession) streak++
      d.setDate(d.getDate() - 1)
      if (streak > 365) break
    }

    // Total
    const totalMinutes = workSessions.reduce((sum, s) => sum + Math.round((s.endedAt - s.startedAt) / 60000), 0)
    const totalDays = new Set(workSessions.map((s) => dayKey(s.startedAt))).size
    const avgPerDay = totalDays > 0 ? Math.round(totalMinutes / totalDays) : 0

    // Max in week
    const maxWeekCount = Math.max(...weekData.map((d) => d.count), 1)

    return { todaySessions: todaySessions.length, todayMinutes, weekData, monthData, streak, totalMinutes, avgPerDay, maxWeekCount }
  }, [sessions])

  const maxHeatmap = Math.max(...stats.monthData.map((d) => d.count), 1)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Target className="text-primary" size={18} />} label="今日专注" value={`${stats.todaySessions} 个`} sub={`${stats.todayMinutes} 分钟`} />
        <StatCard icon={<Flame className="text-orange-400" size={18} />} label="连续天数" value={`${stats.streak} 天`} sub={stats.streak >= 7 ? '🔥 一周以上！' : ''} />
        <StatCard icon={<Clock className="text-blue-400" size={18} />} label="总专注" value={`${Math.round(stats.totalMinutes / 60)} 小时`} sub={`${stats.totalMinutes} 分钟`} />
        <StatCard icon={<TrendingUp className="text-emerald-400" size={18} />} label="日均" value={`${stats.avgPerDay} 分钟`} sub="每天平均" />
      </div>

      {/* Weekly bar chart */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">近 7 天专注</h3>
        </div>
        <div className="flex items-end gap-2 h-32">
          {stats.weekData.map((day) => (
            <div key={day.key} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center">
                <span className="text-[10px] text-gray-400 mb-1">{day.count > 0 ? day.count : ''}</span>
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-primary to-primary-light transition-all duration-300"
                  style={{ height: `${Math.max((day.count / stats.maxWeekCount) * 80, day.count > 0 ? 8 : 0)}px` }}
                />
              </div>
              <span className="text-[10px] text-gray-400">{day.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-gray-400">
          <span>目标: {dailyGoal}/天</span>
          <span>本周: {stats.weekData.reduce((s, d) => s + d.count, 0)} 个</span>
        </div>
      </div>

      {/* Monthly heatmap */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Flame size={16} className="text-orange-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">近 30 天热力图</h3>
        </div>
        <div className="flex flex-wrap gap-1">
          {stats.monthData.map((day) => {
            const intensity = day.count / maxHeatmap
            return (
              <div
                key={day.key}
                title={`${day.key}: ${day.count} 个`}
                className="h-5 w-5 rounded-sm transition-colors"
                style={{
                  backgroundColor: day.count === 0
                    ? 'var(--color-surface-lighter)'
                    : `color-mix(in srgb, var(--color-primary) ${Math.round(intensity * 80 + 20)}%, transparent)`,
                }}
              />
            )
          })}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-400">
          <span>少</span>
          <div className="flex gap-0.5">
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <div
                key={v}
                className="h-3 w-3 rounded-sm"
                style={{
                  backgroundColor: v === 0
                    ? 'var(--color-surface-lighter)'
                    : `color-mix(in srgb, var(--color-primary) ${Math.round(v * 80 + 20)}%, transparent)`,
                }}
              />
            ))}
          </div>
          <span>多</span>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}
