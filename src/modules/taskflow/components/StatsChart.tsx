import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from 'recharts';
import { useTaskStore, getTimeSpentTotal } from '../hooks/useTaskStore';
import { useStore } from '../../../store';
import type { Status, Priority } from '../types'
import { STATUS_CONFIG, PRIORITY_CONFIG, PRIORITY_HEX_COLORS, STATUS_HEX_COLORS } from '../types'
import { dayOfWeek, prevDateStrN, todayStr } from '../dateUtils';

const HEATMAP_LIGHT = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
const HEATMAP_DARK = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];

function getHeatColor(count: number, dark: boolean): string {
  const palette = dark ? HEATMAP_DARK : HEATMAP_LIGHT;
  if (count === 0) return palette[0];
  if (count <= 2) return palette[1];
  if (count <= 5) return palette[2];
  if (count <= 9) return palette[3];
  return palette[4];
}

export function StatsChart() {
  const stats = useTaskStore((state) => state.stats);
  const tasks = useTaskStore((state) => state.tasks);
  const categories = useTaskStore((state) => state.categories);
  const themeMode = useStore((s) => s.themeMode);
  const isDark = themeMode === 'dark';
  const today = todayStr();

  // Precompute completion dates, creation dates, category counts, day-of-week stats, and time tracking — single pass
  const { completionDateMap, creationDateMap, categoryCountMap, dayOfWeekData, hasDayOfWeekData, timeData } = useMemo(() => {
    const completions = new Map<string, number>();
    const creations = new Map<string, number>();
    const catCounts = new Map<string, number>();
    const dowCounts = new Array(7).fill(0);
    const taskTimeResult: { name: string; minutes: number }[] = [];
    let hasDow = false;

    for (const task of tasks) {
      if (task.completedAt) {
        const dateKey = task.completedAt.slice(0, 10);
        completions.set(dateKey, (completions.get(dateKey) || 0) + 1);
        const y = +task.completedAt.slice(0, 4);
        const m = +task.completedAt.slice(5, 7);
        const d = +task.completedAt.slice(8, 10);
        dowCounts[dayOfWeek(y, m, d)]++;
      }
      const createdKey = task.createdAt.slice(0, 10);
      creations.set(createdKey, (creations.get(createdKey) || 0) + 1);
      catCounts.set(task.category, (catCounts.get(task.category) || 0) + 1);

      // Time tracking
      const totalDuration = getTimeSpentTotal(task);
      if (totalDuration > 0) {
        taskTimeResult.push({
          name: task.title.length > 10 ? task.title.slice(0, 10) + '...' : task.title,
          minutes: Math.round(totalDuration / 60),
        });
      }
    }

    for (let i = 0; i < 7; i++) {
      if (dowCounts[i] > 0) { hasDow = true; break; }
    }
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

    taskTimeResult.sort((a, b) => b.minutes - a.minutes);

    return {
      completionDateMap: completions,
      creationDateMap: creations,
      categoryCountMap: catCounts,
      dayOfWeekData: dayNames.map((name, i) => ({ name, completed: dowCounts[i] })),
      hasDayOfWeekData: hasDow,
      timeData: taskTimeResult.slice(0, 10),
    };
  }, [tasks]);

  const statusData = useMemo(() =>
    stats ? Object.entries(stats.byStatus).map(([status, count]) => ({
      name: STATUS_CONFIG[status as Status].label,
      value: count,
      color: STATUS_HEX_COLORS[status as Status],
    })) : [],
    [stats]
  );

  const priorityData = useMemo(() =>
    stats ? Object.entries(stats.byPriority).map(([priority, count]) => ({
      name: PRIORITY_CONFIG[priority as Priority].label,
      value: count,
      color: PRIORITY_HEX_COLORS[priority as Priority],
    })) : [],
    [stats]
  );

  // Completion trend (last 7 days) - O(7) with Map lookup, no Date objects
  const last7Days = useMemo(() => {
    if (!stats) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const dateStr = prevDateStrN(today, 6 - i);
      return {
        date: dateStr.slice(5), // MM/dd
        completed: completionDateMap.get(dateStr) || 0,
      };
    });
  }, [stats, completionDateMap, today]);

  // Weekly completion trend (last 8 weeks) + precomputed hasAny flag
  const { weeklyTrend, hasWeeklyTrend } = useMemo(() => {
    if (!stats) return { weeklyTrend: [], hasWeeklyTrend: false };
    const weeks: { week: string; completed: number }[] = [];
    let hasAny = false;
    for (let w = 7; w >= 0; w--) {
      let count = 0;
      for (let d = 0; d < 7; d++) {
        const dayOffset = w * 7 + (6 - d);
        const dateStr = prevDateStrN(today, dayOffset);
        count += completionDateMap.get(dateStr) || 0;
      }
      if (count > 0) hasAny = true;
      const weekStart = prevDateStrN(today, w * 7 + 6);
      weeks.push({ week: weekStart.slice(5), completed: count });
    }
    return { weeklyTrend: weeks, hasWeeklyTrend: hasAny };
  }, [stats, completionDateMap, today]);

  // Productivity heatmap (last 16 weeks, GitHub-style)
  const heatmapData = useMemo(() => {
    if (!stats) return [];
    const WEEKS = 16;
    const totalDays = WEEKS * 7;
    const grid: { date: string; count: number; dow: number }[] = [];
    for (let i = totalDays - 1; i >= 0; i--) {
      const dateStr = prevDateStrN(today, i);
      const y = +dateStr.slice(0, 4);
      const m = +dateStr.slice(5, 7);
      const d = +dateStr.slice(8, 10);
      grid.push({
        date: dateStr,
        count: completionDateMap.get(dateStr) || 0,
        dow: dayOfWeek(y, m, d),
      });
    }
    // Group into weeks (columns)
    const weeks: { date: string; count: number; dow: number }[][] = [];
    for (let w = 0; w < WEEKS; w++) {
      weeks.push(grid.slice(w * 7, (w + 1) * 7));
    }
    return weeks;
  }, [stats, completionDateMap, today]);

  // Burndown chart: remaining tasks over last 30 days (O(N) via cumulative sums)
  const { burndownData, hasBurndownData } = useMemo(() => {
    if (!stats) return { burndownData: [], hasBurndownData: false };
    const DAYS = 30;
    // Build sorted date keys for the range
    const dateKeys: string[] = [];
    for (let i = DAYS - 1; i >= 0; i--) dateKeys.push(prevDateStrN(today, i));
    // Precompute cumulative created and completed using running totals
    const data: { date: string; remaining: number }[] = [];
    let cumulativeCreated = 0;
    let cumulativeCompleted = 0;
    let hasAny = false;
    for (const dateStr of dateKeys) {
      cumulativeCreated += creationDateMap.get(dateStr) || 0;
      cumulativeCompleted += completionDateMap.get(dateStr) || 0;
      const remaining = cumulativeCreated - cumulativeCompleted;
      if (remaining > 0) hasAny = true;
      data.push({ date: dateStr.slice(5), remaining });
    }
    return { burndownData: data, hasBurndownData: hasAny };
  }, [stats, creationDateMap, completionDateMap, today]);

  // Category distribution - O(categories) with Map lookup
  const categoryData = useMemo(() => {
    if (!stats) return [];
    return categories
      .map((cat) => ({
        name: cat.name,
        value: categoryCountMap.get(cat.id) || 0,
        color: cat.color,
      }))
      .filter((d) => d.value > 0);
  }, [stats, categories, categoryCountMap]);

  // Daily time tracking (last 7 days) - single loop over all time entries + precomputed hasAny flag
  const { dailyTimeData, hasDailyTimeData } = useMemo(() => {
    if (!stats) return { dailyTimeData: [], hasDailyTimeData: false };
    const dayMap = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      dayMap.set(prevDateStrN(today, 6 - i), 0);
    }
    for (const task of tasks) {
      if (!task.timeEntries) continue;
      for (const entry of task.timeEntries) {
        const dayKey = entry.startTime.slice(0, 10);
        if (dayMap.has(dayKey)) {
          dayMap.set(dayKey, dayMap.get(dayKey)! + entry.duration);
        }
      }
    }
    let hasAny = false;
    const data = Array.from(dayMap.entries()).map(([date, seconds]) => {
      const minutes = Math.round(seconds / 60);
      if (minutes > 0) hasAny = true;
      return { date: date.slice(5), minutes };
    });
    return { dailyTimeData: data, hasDailyTimeData: hasAny };
  }, [stats, tasks, today]);

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="h-4 bg-surface-lighter rounded w-24 mb-4" />
            <div className="h-[200px] bg-surface-lighter rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4" role="region" aria-label="任务统计图表">
      {/* Status Pie Chart */}
      <div className="card p-4" role="img" aria-label={`状态分布: ${statusData.map(d => `${d.name} ${d.value}个`).join(', ')}`}>
        <h4 className="text-sm font-medium text-text-muted mb-4">状态分布</h4>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {statusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Priority Bar Chart */}
      <div className="card p-4" role="img" aria-label={`优先级分布: ${priorityData.map(d => `${d.name} ${d.value}个`).join(', ')}`}>
        <h4 className="text-sm font-medium text-text-muted mb-4">优先级分布</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={priorityData}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {priorityData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Completion Trend */}
      <div className="card p-4" role="img" aria-label={`近7天完成趋势: ${last7Days.map(d => `${d.date} ${d.completed}个`).join(', ')}`}>
        <h4 className="text-sm font-medium text-text-muted mb-4">近7天完成趋势</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={last7Days}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Category Distribution */}
      {categoryData.length > 0 && (
        <div className="card p-4" role="img" aria-label={`分类分布: ${categoryData.map(d => `${d.name} ${d.value}个`).join(', ')}`}>
          <h4 className="text-sm font-medium text-text-muted mb-4">分类分布</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Day of Week Completions */}
      {hasDayOfWeekData && (
        <div className="card p-4" role="img" aria-label={`按星期统计: ${dayOfWeekData.map(d => `周${d.name} ${d.completed}个`).join(', ')}`}>
          <h4 className="text-sm font-medium text-text-muted mb-4">按星期完成统计</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dayOfWeekData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="completed" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Time Tracking */}
      {timeData.length > 0 && (
        <div className="card p-4 md:col-span-2" role="img" aria-label={`时间统计: ${timeData.map(d => `${d.name} ${d.minutes}分钟`).join(', ')}`}>
          <h4 className="text-sm font-medium text-text-muted mb-4">时间统计 (分钟)</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={timeData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="minutes" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily Time Tracking */}
      {hasDailyTimeData && (
        <div className="card p-4 md:col-span-2" role="img" aria-label={`每日专注时间: ${dailyTimeData.map(d => `${d.date} ${d.minutes}分钟`).join(', ')}`}>
          <h4 className="text-sm font-medium text-text-muted mb-4">每日专注时间 (分钟)</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyTimeData}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="minutes" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weekly Completion Trend */}
      {hasWeeklyTrend && (
        <div className="card p-4 md:col-span-2" role="img" aria-label={`周完成趋势: ${weeklyTrend.map(w => `${w.week}周 ${w.completed}个`).join(', ')}`}>
          <h4 className="text-sm font-medium text-text-muted mb-4">近8周完成趋势</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyTrend}>
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="completed"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Productivity Heatmap */}
      <div className="card p-4 md:col-span-2" role="region" aria-label="完成热力图 (近16周)">
        <h4 className="text-sm font-medium text-text-muted mb-4">完成热力图 (近16周)</h4>
        <div className="flex gap-0.5 overflow-x-auto">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-1 flex-shrink-0">
            {['日', '一', '二', '三', '四', '五', '六'].map((d, i) => (
              <div key={d} className="flex items-center" style={{ height: 14 }}>
                {i % 2 === 1 && <span className="text-[10px] text-text-muted w-3 text-right">{d}</span>}
              </div>
            ))}
          </div>
          {/* Heatmap grid */}
          {heatmapData.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5 flex-shrink-0">
              {week.map((day) => (
                <div
                  key={day.date}
                  className="rounded-[2px]"
                  style={{
                    width: 14,
                    height: 14,
                    backgroundColor: getHeatColor(day.count, isDark),
                  } as React.CSSProperties}
                  title={`${day.date}: ${day.count}个完成`}
                />
              ))}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1 mt-2 justify-end">
          <span className="text-[10px] text-text-muted mr-1">少</span>
          {(isDark ? HEATMAP_DARK : HEATMAP_LIGHT).map((color, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-[2px]"
              style={{ backgroundColor: color }}
            />
          ))}
          <span className="text-[10px] text-text-muted ml-1">多</span>
        </div>
      </div>

      {/* Burndown Chart */}
      {hasBurndownData && (
        <div className="card p-4 md:col-span-2" role="img" aria-label={`任务燃尽图: ${burndownData.map(d => `${d.date} 剩余${d.remaining}个`).join(', ')}`}>
          <h4 className="text-sm font-medium text-text-muted mb-4">任务燃尽图 (近30天)</h4>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={burndownData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="remaining"
                stroke="#f97316"
                fill="#f97316"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
