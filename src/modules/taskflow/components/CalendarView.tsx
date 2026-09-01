import { useState, useMemo, Fragment, useEffect, useCallback } from 'react';
import { useTaskStore } from '../hooks/useTaskStore';
import { highlightText } from '../utils/highlight';
import { playClickSound } from '../utils/sound';
import type { Task } from '../types'
import { Icon } from './Icon';
import { todayStr } from '../dateUtils';

function getCalendarDays(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  // Monday-start week
  const startDay = monthStart.getDay();
  const diff = startDay === 0 ? -6 : 1 - startDay;
  const calStart = new Date(year, month, 1 + diff);
  const endDay = monthEnd.getDay();
  const endDiff = endDay === 0 ? 0 : 7 - endDay;
  const calEnd = new Date(year, month + 1, endDiff);
  const days: Date[] = [];
  for (const d = new Date(calStart); d <= calEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

interface CalendarViewProps {
  onEditTask: (task: Task) => void;
  onCreateTaskForDate?: (date: string) => void;
}

export function CalendarView({ onEditTask, onCreateTaskForDate }: CalendarViewProps) {
  const filters = useTaskStore((state) => state.filters);
  const createTask = useTaskStore((state) => state.createTask);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const tasks = useTaskStore((state) => state.getFilteredTasks());
  const searchQuery = filters.search;

  const prevMonth = useCallback(() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)), []);
  const nextMonth = useCallback(() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)), []);
  const goToday = useCallback(() => setCurrentMonth(new Date()), []);

  // Keyboard navigation: Left/Right for month, T for today
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); prevMonth(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nextMonth(); }
      else if (e.key === 't' || e.key === 'T') { e.preventDefault(); goToday(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prevMonth, nextMonth, goToday]);

  const days = useMemo(() => getCalendarDays(currentMonth), [currentMonth]);

  // Pre-group tasks by date string for O(1) lookup
  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      // Use first 10 chars of ISO string (yyyy-MM-dd) directly - no Date parsing needed
      const dateKey = task.dueDate.slice(0, 10);
      let group = grouped.get(dateKey);
      if (!group) {
        group = [];
        grouped.set(dateKey, group);
      }
      group.push(task);
    }
    return grouped;
  }, [tasks]);

  // Precompute date keys for all calendar days using ISO string slicing
  const dayKeys = useMemo(() => days.map(d => d.toISOString().slice(0, 10)), [days]);
  const today = useMemo(() => todayStr(), []);
  const currentMonthStr = currentMonth.toISOString().slice(0, 7);

  const getTasksForDay = (dateKey: string) => {
    return tasksByDate.get(dateKey) || [];
  };

  // Precompute month statistics - single pass, using ISO string prefix comparison
  const monthStats = useMemo(() => {
    const todayDatePart = todayStr();
    let total = 0;
    let overdue = 0;
    let completed = 0;
    for (const t of tasks) {
      if (t.dueDate && t.dueDate.slice(0, 7) === currentMonthStr) {
        total++;
        if (t.dueDate.slice(0, 10) < todayDatePart && t.status !== 'done') overdue++;
      }
      if (t.status === 'done' && t.completedAt && t.completedAt.slice(0, 7) === currentMonthStr) {
        completed++;
      }
    }
    return { total, overdue, completed };
  }, [tasks, currentMonthStr]);

  return (
    <div className="card p-4 mt-4" role="region" aria-label="日历视图">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="btn btn-ghost p-2"
          aria-label="上个月（左箭头）"
        >
          <Icon name="chevron-left" className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold" aria-live="polite">
            {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
          </h3>
          <button
            onClick={goToday}
            className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            aria-label="回到今天（T键）"
          >
            今天
          </button>
        </div>
        <button
          onClick={nextMonth}
          className="btn btn-ghost p-2"
          aria-label="下个月（右箭头）"
        >
          <Icon name="chevron-right" className="w-5 h-5" />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr_1fr_1fr] gap-1 mb-1" role="row">
        <div className="text-center text-[10px] text-text-muted py-2" role="columnheader" aria-hidden="true">周</div>
        {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-text-muted py-2" role="columnheader">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr_1fr_1fr] gap-1" role="grid" aria-label="日历">
        {days.map((day, i) => {
          const dateKey = dayKeys[i];
          const dayTasks = getTasksForDay(dateKey);
          const isCurrentMonth = dateKey.slice(0, 7) === currentMonthStr;
          const isCurrentDay = dateKey === today;
          const isMonday = day.getDay() === 1;

          const dayNum = +dateKey.slice(8, 10);
          const monthLabel = +dateKey.slice(5, 7) + '月' + dayNum + '日';

          // Day completion rate
          let dayDoneCount = 0;
          if (dayTasks.length > 0) {
            for (const t of dayTasks) {
              if (t.status === 'done') dayDoneCount++;
            }
          }
          const dayCompletionRate = dayTasks.length > 0 ? dayDoneCount / dayTasks.length : 0;

          // ISO week number calculation
          const weekCell = isMonday ? (() => {
            const d = new Date(day);
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
            const week1 = new Date(d.getFullYear(), 0, 4);
            const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
            return (
              <div className="flex items-center justify-center text-[10px] text-text-muted" aria-label={`第${weekNum}周`}>
                {weekNum}
              </div>
            );
          })() : <div />;

          return (
            <Fragment key={dateKey}>
              {weekCell}
              <div
                className={`min-h-[100px] p-1.5 rounded-lg border transition-colors relative ${
                  isCurrentMonth
                    ? `bg-white  border-border  cursor-pointer hover:border-blue-300 dark:hover:border-blue-600${dayCompletionRate === 1 && dayTasks.length > 0 ? ' bg-green-50/50 dark:bg-green-900/10' : ''}`
                    : 'bg-surface-lighter  border-border '
                } ${isCurrentDay ? 'ring-2 ring-blue-500' : ''}`}
                role="gridcell"
                aria-label={`${monthLabel}${dayTasks.length > 0 ? `，${dayTasks.length}个任务，完成${dayDoneCount}个` : ''}`}
                onClick={() => isCurrentMonth && onCreateTaskForDate?.(dateKey)}
              >
                <div className={`text-xs font-medium mb-1 ${ isCurrentDay ? 'text-blue-600 dark:text-blue-400' : isCurrentMonth ? 'text-text ' : 'text-text-muted ' }`}>
                  {dayNum}
                </div>
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map((task) => {
                    // Use ISO string comparison for overdue check - no Date object needed
                    const isOverdue = task.dueDate && task.dueDate.slice(0, 10) < today && task.status !== 'done';
                    const isDone = task.status === 'done';
                    return (
                      <button
                        key={task.id}
                        onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                        className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate ${PRIORITY_COLORS[task.priority]} ${isOverdue ? 'ring-1 ring-red-400' : ''} ${isDone ? 'line-through opacity-60' : ''}`}
                        aria-label={`任务: ${task.title}${isOverdue ? '，已逾期' : ''}${isDone ? '，已完成' : ''}`}
                      >
                        {task.pinned && <span className="text-amber-500" aria-hidden="true">📌</span>}{isDone ? '✓ ' : ''}{searchQuery ? highlightText(task.title, searchQuery) : task.title}
                      </button>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <div className="text-[10px] text-text-muted text-center" aria-label={`还有${dayTasks.length - 3}个任务`}>
                      +{dayTasks.length - 3} 更多
                    </div>
                  )}
                </div>
                {/* Day completion indicator */}
                {dayTasks.length > 0 && dayCompletionRate > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-surface-lighter rounded-b-lg overflow-hidden" aria-hidden="true">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${Math.round(dayCompletionRate * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>

      {/* Month Summary */}
      {tasks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>本月共 {monthStats.total} 个任务</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
                逾期 {monthStats.overdue}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
                已完成 {monthStats.completed}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard hints */}
      <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-text-muted">
        <span><kbd className="px-1.5 py-0.5 bg-surface-lighter rounded">←</kbd> 上月</span>
        <span><kbd className="px-1.5 py-0.5 bg-surface-lighter rounded">→</kbd> 下月</span>
        <span><kbd className="px-1.5 py-0.5 bg-surface-lighter rounded">T</kbd> 今天</span>
      </div>

      {/* No tasks message */}
      {tasks.length === 0 && (
        <div className="mt-4 text-center py-8">
          <Icon name="calendar" className="w-12 h-12 mx-auto mb-3 text-text-muted" />
          {filters.search ? (
            <>
              <p className="text-sm text-text-muted">
                没有找到匹配「<span className="font-medium text-text-muted">{highlightText(filters.search, filters.search)}</span>」的任务
              </p>
              <button
                onClick={() => { createTask({ title: filters.search }); playClickSound(); }}
                className="mt-2 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                aria-label={`创建任务「${filters.search}」`}
              >
                + 创建「{filters.search}」
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-text-muted">暂无任务</p>
              <p className="text-xs text-text-muted mt-1">创建新任务开始管理您的日程</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
