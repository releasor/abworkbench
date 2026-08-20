import { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import { formatDurationCompact } from '../utils/formatTime';

interface TrendDay {
  date: string;
  completed: number;
  created: number;
  timeSpent: number;
  score: number;
}

interface ProductivityTrendsProps {
  className?: string;
}

type TimeRange = 7 | 14 | 30;

const RANGE_LABELS: Record<TimeRange, string> = { 7: '7天', 14: '14天', 30: '30天' };

function formatDate(dateStr: string): string {
  const month = +dateStr.slice(5, 7);
  const day = +dateStr.slice(8, 10);
  return `${month}/${day}`;
}

export function ProductivityTrends({ className }: ProductivityTrendsProps) {
  const [range, setRange] = useState<TimeRange>(30);
  const [trends, setTrends] = useState<TrendDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      setLoading(true);
      api.productivityTrends.get(range).then((data) => {
        if (!cancelled) {
          setTrends(data.trends);
          setLoading(false);
        }
      }).catch(() => {
        if (!cancelled) setLoading(false);
      });
    });
    return () => { cancelled = true; };
  }, [range]);

  const stats = useMemo(() => {
    if (trends.length === 0) return null;
    // Single pass: accumulate sum, min, max, totalCompleted, totalTime, activeDays
    let sum = 0, min = 101, max = -1, totalCompleted = 0, totalTime = 0, activeDays = 0;
    // Also track last 14 scores for trend computation
    const len = trends.length;
    const recent7Start = Math.max(0, len - 7);
    const prev7Start = Math.max(0, len - 14);
    let recentSum = 0, prevSum = 0, recentCount = 0, prevCount = 0;

    for (let i = 0; i < len; i++) {
      const t = trends[i];
      const s = t.score;
      sum += s;
      if (s < min) min = s;
      if (s > max) max = s;
      totalCompleted += t.completed;
      totalTime += t.timeSpent;
      if (t.completed > 0) activeDays++;
      if (i >= recent7Start) { recentSum += s; recentCount++; }
      else if (i >= prev7Start) { prevSum += s; prevCount++; }
    }

    const avg = Math.round(sum / len);
    const recentAvg = recentSum / (recentCount || 1);
    const prevAvg = prevCount > 0 ? prevSum / prevCount : recentAvg;
    const trend = recentAvg > prevAvg + 3 ? 'up' : recentAvg < prevAvg - 3 ? 'down' : 'flat';
    return { avg, max, min, totalCompleted, totalTime, activeDays, trend, recentAvg: Math.round(recentAvg) };
  }, [trends]);

  // Chart dimensions
  const chartW = 600;
  const chartH = 160;
  const padX = 40;
  const padY = 20;
  const innerW = chartW - padX * 2;
  const innerH = chartH - padY * 2;

  const maxScore = 100;

  const { points, linePath, areaPath } = useMemo(() => {
    const pts = trends.map((t, i) => {
      const x = padX + (i / Math.max(trends.length - 1, 1)) * innerW;
      const y = padY + innerH - (t.score / maxScore) * innerH;
      return { x, y, ...t };
    });
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const area = `${line} L${pts[pts.length - 1]?.x || padX},${padY + innerH} L${padX},${padY + innerH} Z`;
    return { points: pts, linePath: line, areaPath: area };
  }, [trends, padX, padY, innerW, innerH, maxScore]);

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100];

  // X-axis labels (show every Nth depending on range)
  const xStep = range <= 7 ? 1 : range <= 14 ? 2 : 5;
  const xLabels = points.filter((_, i) => i % xStep === 0 || i === points.length - 1);

  const trendArrow = stats?.trend === 'up' ? '↑' : stats?.trend === 'down' ? '↓' : '→';
  const trendColor = stats?.trend === 'up' ? 'text-green-500' : stats?.trend === 'down' ? 'text-red-500' : 'text-text-muted';

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text dark:text-white">
          生产力趋势
        </h3>
        <div className="flex gap-1">
          {([7, 14, 30] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${ range === r ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-medium' : 'text-text-muted hover:bg-surface-lighter ' }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse bg-surface-lighter rounded-lg" />
      ) : !stats || trends.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-text-muted text-sm">
          暂无数据
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-text dark:text-white">{stats.avg}</p>
              <p className="text-xs text-text-muted">平均分</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.totalCompleted}</p>
              <p className="text-xs text-text-muted">完成任务</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.activeDays}/{trends.length}</p>
              <p className="text-xs text-text-muted">活跃天数</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatDurationCompact(stats.totalTime)}</p>
              <p className="text-xs text-text-muted">专注时间</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${trendColor}`}>{trendArrow} {stats.recentAvg}</p>
              <p className="text-xs text-text-muted">近期趋势</p>
            </div>
          </div>

          {/* SVG Chart */}
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full min-w-[400px]" role="img" aria-label="生产力趋势图表">
              {/* Grid lines */}
              {yLabels.map((v) => {
                const y = padY + innerH - (v / maxScore) * innerH;
                return (
                  <g key={v}>
                    <line x1={padX} y1={y} x2={padX + innerW} y2={y} stroke="currentColor" strokeOpacity={0.1} />
                    <text x={padX - 8} y={y + 4} textAnchor="end" className="fill-text-muted text-[9px]">{v}</text>
                  </g>
                );
              })}

              {/* Area fill */}
              <path d={areaPath} fill="url(#trendGrad)" opacity={0.3} />

              {/* Line */}
              <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

              {/* Data points */}
              {points.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={3} fill="#3b82f6" stroke="white" strokeWidth={1.5} />
                  <title>{`${formatDate(p.date)}: ${p.score}分, 完成${p.completed}个, ${formatDurationCompact(p.timeSpent)}`}</title>
                </g>
              ))}

              {/* X-axis labels */}
              {xLabels.map((p, i) => (
                <text key={i} x={p.x} y={chartH - 2} textAnchor="middle" className="fill-text-muted text-[9px]">
                  {formatDate(p.date)}
                </text>
              ))}

              {/* Gradient definition */}
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </>
      )}
    </div>
  );
}
