import { useState, useEffect, useMemo } from 'react';
import type { TimeEntry } from '../types'
import { api } from '../utils/api';
import { showToast } from '../utils/toastEvent';
import { playClickSound } from '../utils/sound';
import { formatClock } from '../utils/formatTime';

interface TimeTrackerProps {
  taskId: string;
  timeEntries: TimeEntry[];
  estimatedMinutes: number | null;
  onUpdate: () => void;
}

export function TimeTracker({ taskId, timeEntries, estimatedMinutes, onUpdate }: TimeTrackerProps) {
  const [elapsed, setElapsed] = useState(0);

  const { totalSeconds, recentEntries, activeEntryId, activeStartTime } = useMemo(() => {
    let total = 0;
    let activeId: string | undefined;
    let activeStart: string | undefined;
    for (const e of timeEntries) {
      total += e.duration;
      if (!e.endTime) { activeId = e.id; activeStart = e.startTime; }
    }
    const recent = timeEntries.length > 5 ? timeEntries.slice(-5).reverse() : [...timeEntries].reverse();
    return { totalSeconds: total, recentEntries: recent, activeEntryId: activeId, activeStartTime: activeStart };
  }, [timeEntries]);
  const isRunning = Boolean(activeEntryId && activeStartTime);

  useEffect(() => {
    if (activeEntryId && activeStartTime) {
      const startTime = Date.parse(activeStartTime);
      const updateElapsed = () => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      };
      updateElapsed();
      const interval = setInterval(updateElapsed, 1000);
      return () => clearInterval(interval);
    }
  }, [activeEntryId, activeStartTime]);

  const handleStart = async () => {
    try {
      await api.tasks.startTime(taskId);
      onUpdate();
      playClickSound();
    } catch {
      showToast('启动计时器失败', 'error');
    }
  };

  const handleStop = async () => {
    try {
      await api.tasks.stopTime(taskId);
      onUpdate();
      playClickSound();
    } catch {
      showToast('停止计时器失败', 'error');
    }
  };

  return (
    <div role="group" aria-label="时间跟踪">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">时间跟踪</span>
        {estimatedMinutes && (
          <span className="text-xs text-text-muted" aria-label={`预计${estimatedMinutes}分钟`}>
            预计 {estimatedMinutes} 分钟
          </span>
        )}
      </div>

      {/* Timer Display */}
      <div className="flex items-center gap-4 p-4 bg-surface-lighter rounded-lg mb-3" aria-live="polite" aria-atomic="true">
        <div className="flex-1">
          <div className="text-2xl font-mono font-bold text-text" aria-label={isRunning ? `计时中 ${formatClock(elapsed)}` : `总用时 ${formatClock(totalSeconds)}`}>
            {isRunning ? formatClock(elapsed) : formatClock(totalSeconds)}
          </div>
          <div className="text-xs text-text-muted mt-1">
            {isRunning ? '计时中...' : totalSeconds > 0 ? '总用时' : '未开始'}
          </div>
        </div>
        <button
          type="button"
          onClick={isRunning ? handleStop : handleStart}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ isRunning ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white' }`}
          aria-label={isRunning ? '停止计时' : '开始计时'}
        >
          {isRunning ? '停止' : '开始'}
        </button>
      </div>

      {/* Time Entries */}
      {timeEntries.length > 0 && (
        <div className="space-y-1" role="list" aria-label="时间记录">
          {recentEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between text-xs text-text-muted py-1"
              role="listitem"
            >
              <span>{entry.description || '无描述'}</span>
              <span aria-label={`用时 ${formatClock(entry.duration)}`}>{formatClock(entry.duration)}</span>
            </div>
          ))}
          {timeEntries.length > 5 && (
            <div className="text-xs text-text-muted text-center">
              还有 {timeEntries.length - 5} 条记录
            </div>
          )}
        </div>
      )}
    </div>
  );
}
