import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Task, TimeEntry } from '../types'
import { STATUS_CONFIG, PRIORITY_CONFIG, STATUS_CYCLE } from '../types'
import { useTaskStore, getTimeSpentTotal } from '../hooks/useTaskStore';
import { usePomodoro } from '../hooks/usePomodoro';
import { api } from '../utils/api';
import { MarkdownView } from '../utils/markdown';
import { playTickSound, playClickSound, playCompletionSound } from '../utils/sound';
import { showToast } from '../utils/toastEvent';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { formatClock } from '../utils/formatTime';
import { countCompleted } from '../utils/subtaskUtils';
import { buildCompletionReviewText, buildExecutionModeModel } from '../utils/executionMode';
import { Icon } from './Icon';

interface FocusModeProps {
  taskId: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const POMODORO_LABELS: Record<string, string> = {
  idle: '🍅 准备开始',
  running: '🍅 专注中',
  paused: '🍅 已暂停',
  break: '☕ 休息中',
};

export function FocusMode({ taskId, onClose, onSuccess }: FocusModeProps) {
  const moveTask = useTaskStore((state) => state.moveTask);
  const refreshTask = useTaskStore((state) => state.refreshTask);
  const task = useTaskStore((state) => state.tasks.find((t) => t.id === taskId) || null);
  const trapRef = useFocusTrap<HTMLDivElement>();
  const { state: pomoState, minutes: pomoMin, seconds: pomoSec, progress: pomoProgress, sessionsCompleted, isLongBreak, start: pomoStart, pause: pomoPause, resume: pomoResume, reset: pomoReset } = usePomodoro();
  const [showPomodoro, setShowPomodoro] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [blockerNote, setBlockerNote] = useState('');

  // Use refs for callbacks to avoid re-registering keyboard handler
  const onCloseRef = useRef(onClose);
  const onSuccessRef = useRef(onSuccess);
  const taskRef = useRef(task);

  useEffect(() => {
    onCloseRef.current = onClose;
    onSuccessRef.current = onSuccess;
    taskRef.current = task;
  }, [onClose, onSuccess, task]);

  // Check if any time entry is active
  const isAnyTimerActive = useMemo(() => {
    if (!task?.timeEntries) return false;
    for (let i = 0; i < task.timeEntries.length; i++) {
      if (!task.timeEntries[i].endTime) return true;
    }
    return false;
  }, [task]);

  // Only tick the clock when a timer is running
  useEffect(() => {
    if (!isAnyTimerActive) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isAnyTimerActive]);

  // Close if task was deleted
  useEffect(() => {
    if (!task) onCloseRef.current();
  }, [task]);

  const handleCycleStatus = useCallback(async () => {
    const t = taskRef.current;
    if (!t) return;
    const nextStatus = STATUS_CYCLE[t.status];
    if (!nextStatus) return;
    try {
      await moveTask(t.id, nextStatus as Task['status']);
      onSuccessRef.current(`状态已更改为 ${STATUS_CONFIG[nextStatus as Task['status']].label}`);
      if (nextStatus === 'done') {
        playCompletionSound();
        onCloseRef.current();
      } else {
        playClickSound();
        // Auto-start pomodoro when moving to in-progress
        if (nextStatus === 'in-progress') {
          setShowPomodoro(true);
          if (pomoState === 'idle') pomoStart();
        }
      }
    } catch {
      showToast('更新状态失败', 'error');
    }
  }, [moveTask, pomoState, pomoStart]);

  const handleToggleTimer = useCallback(async () => {
    const t = taskRef.current;
    if (!t) return;
    let hasActiveTimer = false;
    if (t.timeEntries) {
      for (let i = 0; i < t.timeEntries.length; i++) {
        if (!t.timeEntries[i].endTime) { hasActiveTimer = true; break; }
      }
    }
    try {
      if (hasActiveTimer) {
        await api.tasks.stopTime(t.id);
      } else {
        await api.tasks.startTime(t.id);
      }
      await refreshTask(t.id);
      playClickSound();
    } catch {
      showToast('计时器操作失败', 'error');
    }
  }, [refreshTask]);

  const handleSaveFocusNote = useCallback(async (content: string, successText: string) => {
    const t = taskRef.current;
    const note = content.trim();
    if (!t || !note) return;
    try {
      await api.tasks.addNote(t.id, note);
      await refreshTask(t.id);
      setBlockerNote('');
      showToast(successText, 'success');
    } catch {
      showToast('记录失败', 'error');
    }
  }, [refreshTask]);

  // Keyboard handler — stable deps, reads from refs
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        onCloseRef.current();
      } else if (e.key === 't' || e.key === 'T') {
        handleToggleTimer();
      } else if (e.key === 'p' || e.key === 'P') {
        setShowPomodoro(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleCycleStatus, handleToggleTimer]);

  // Hooks must be called before any conditional returns (Rules of Hooks)
  const { totalTimeSpent, activeEntry, activeStartMs } = useMemo(() => {
    if (!task) return { totalTimeSpent: 0, activeEntry: undefined as TimeEntry | undefined, activeStartMs: 0 };
    const total = getTimeSpentTotal(task);
    let active: TimeEntry | undefined;
    if (task.timeEntries) {
      for (let i = 0; i < task.timeEntries.length; i++) {
        if (!task.timeEntries[i].endTime) { active = task.timeEntries[i]; break; }
      }
    }
    return { totalTimeSpent: total, activeEntry: active, activeStartMs: active ? Date.parse(active.startTime) : 0 };
  }, [task]);

  const executionModel = useMemo(() => {
    if (!task) return null;
    return buildExecutionModeModel({ task, totalTimeSpentSeconds: totalTimeSpent });
  }, [task, totalTimeSpent]);

  if (!task) return null;

  const isRunning = !!activeEntry;
  const elapsed = isRunning ? Math.floor((currentTime.getTime() - activeStartMs) / 1000) : 0;

  const progressPercent = task.estimatedMinutes && totalTimeSpent > 0
    ? Math.min(100, Math.round((totalTimeSpent / 60 / task.estimatedMinutes) * 100))
    : 0;

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="专注模式"
    >
      <div className="w-full max-w-2xl mx-4 text-center">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-gray-400 hover:text-white transition-colors"
          aria-label="退出专注模式"
        >
          <Icon name="close" className="w-6 h-6" />
        </button>

        {/* Status badge */}
        <div className="mb-6">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            task.status === 'done' ? 'bg-green-500/20 text-green-400' :
            task.status === 'in-progress' ? 'bg-blue-500/20 text-blue-400' :
            task.status === 'review' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {STATUS_CONFIG[task.status].label}
          </span>
          <span className={`ml-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            task.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
            task.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
            task.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-green-500/20 text-green-400'
          }`}>
            {PRIORITY_CONFIG[task.priority].label}
          </span>
        </div>

        {/* Title */}
        <h1 className={`text-3xl font-bold mb-4 ${
          task.status === 'done' ? 'line-through text-gray-500' : 'text-white'
        }`}>
          {task.title}
        </h1>

        {executionModel && (
          <div className="mb-6 grid gap-3 text-left md:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-blue-300">当前行动</span>
                <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-200">{executionModel.progressLabel}</span>
              </div>
              <div className="mt-2 text-lg font-semibold text-white">{executionModel.currentStep}</div>
              <div className="mt-1 text-sm text-blue-100/70">{executionModel.focusHint}</div>
              <div className="mt-3 rounded-xl bg-gray-950/30 px-3 py-2 text-sm text-gray-300">
                下一步：{executionModel.nextStep}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-4">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-gray-200">{executionModel.energyLabel}</span>
                <span className="text-gray-400">已专注 {executionModel.spentMinutes} 分钟</span>
              </div>
              <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${executionModel.blockerCount > 0 ? 'bg-amber-500/10 text-amber-200' : 'bg-emerald-500/10 text-emerald-200'}`}>
                {executionModel.blockerPrompt}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={blockerNote}
                  onChange={(e) => setBlockerNote(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-blue-500"
                  placeholder="记录阻塞或结果..."
                  aria-label="记录阻塞或执行结果"
                />
                <button
                  type="button"
                  onClick={() => handleSaveFocusNote(blockerNote, '已记录执行备注')}
                  className="rounded-lg bg-gray-700 px-3 py-1.5 text-sm font-semibold text-gray-200 transition hover:bg-gray-600"
                >
                  记录
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleSaveFocusNote(buildCompletionReviewText(executionModel), '已保存完成复盘')}
                className="mt-2 w-full rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                保存完成复盘
              </button>
            </div>
          </div>
        )}

        {/* Description */}
        {task.description && (
          <p className="text-gray-400 text-lg mb-8 max-w-md mx-auto">
            {task.description}
          </p>
        )}

        {/* Timer display */}
        {isRunning && (
          <div className="mb-8">
            <div className="text-6xl font-mono text-blue-400 animate-pulse">
              {formatClock(elapsed)}
            </div>
            <p className="text-gray-500 mt-2">计时中</p>
          </div>
        )}

        {/* Time stats */}
        <div className="flex items-center justify-center gap-8 mb-8 text-gray-400">
          {task.estimatedMinutes && (
            <div>
              <p className="text-2xl font-semibold text-white">{task.estimatedMinutes}分</p>
              <p className="text-sm">预计时长</p>
            </div>
          )}
          {totalTimeSpent > 0 && (
            <div>
              <p className="text-2xl font-semibold text-purple-400">
                {Math.floor(totalTimeSpent / 60)}分
              </p>
              <p className="text-sm">已用时长</p>
            </div>
          )}
          {task.dueDate && (
            <div>
              <p className="text-2xl font-semibold text-amber-400">
                {task.dueDate.slice(5, 10).replace('-', '/')}
              </p>
              <p className="text-sm">截止日期</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {task.estimatedMinutes && totalTimeSpent > 0 && (
          <div className="mb-8 max-w-xs mx-auto">
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: progressPercent > 100 ? '#ef4444' : '#3b82f6',
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{progressPercent}%</p>
          </div>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
            {task.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Subtask section (always show for quick-add) */}
        {(() => {
          const subs = task.subtasks || [];
          const completedCount = countCompleted(subs);
          return (
            <div className="mb-6 max-w-sm mx-auto text-left">
              {subs.length > 0 && (
                <>
                  <p className="text-gray-400 mb-3 text-center text-sm">
                    子任务: {completedCount}/{subs.length}
                  </p>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round((completedCount / subs.length) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                    {subs.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={async () => {
                          await api.tasks.toggleSubtask(task.id, sub.id);
                          if (!sub.completed) playTickSound();
                          await refreshTask(task.id);
                        }}
                        className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-colors text-left group"
                        aria-label={`${sub.completed ? '取消完成' : '完成'}: ${sub.title}`}
                      >
                        <span className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          sub.completed
                            ? 'bg-green-500 border-green-500'
                            : 'border-gray-500 group-hover:border-green-400'
                        }`}>
                          {sub.completed && (
                            <Icon name="check" className="w-3 h-3 text-white" />
                          )}
                        </span>
                        <span className={`text-sm ${sub.completed ? 'line-through text-gray-500' : 'text-gray-300'}`}>
                          {sub.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {/* Quick add subtask */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem('subtaskTitle') as HTMLInputElement;
                  const title = input.value.trim();
                  if (!title) return;
                  await api.tasks.addSubtask(task.id, title);
                  input.value = '';
                  await refreshTask(task.id);
                }}
                className="flex gap-2"
              >
                <input
                  name="subtaskTitle"
                  type="text"
                  className="flex-1 px-3 py-1.5 text-sm bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-gray-200 placeholder-gray-500"
                  placeholder="添加子任务..."
                  aria-label="添加子任务"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                  aria-label="确认添加子任务"
                >
                  +
                </button>
              </form>
            </div>
          );
        })()}

        {/* Notes preview */}
        {task.notes && task.notes.length > 0 && (
          <div className="mb-6 max-w-sm mx-auto text-left">
            <p className="text-gray-400 mb-2 text-center text-sm">
              备注 ({task.notes.length})
            </p>
            <div className="max-h-32 overflow-y-auto px-3 py-2 bg-gray-800/50 rounded-lg text-sm text-gray-300">
              <MarkdownView content={task.notes[0].content} />
              {task.notes.length > 1 && (
                <p className="text-xs text-gray-500 mt-2">还有 {task.notes.length - 1} 条备注...</p>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={handleCycleStatus}
            className={`px-8 py-3 rounded-xl text-lg font-semibold transition-all ${
              task.status === 'done'
                ? 'bg-gray-600 hover:bg-gray-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {task.status === 'done' ? '重新开始' :
             task.status === 'review' ? '标记完成' :
             task.status === 'in-progress' ? '提交审核' : '开始任务'}
          </button>

          <button
            type="button"
            onClick={handleToggleTimer}
            className={`px-6 py-3 rounded-xl text-lg font-semibold transition-all ${
              isRunning
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {isRunning ? '停止计时' : '开始计时'}
          </button>
        </div>

        {/* Pomodoro Toggle */}
        <div className="mt-8">
          <button
            onClick={() => setShowPomodoro(!showPomodoro)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            aria-expanded={showPomodoro}
            aria-label="切换番茄钟"
          >
            {showPomodoro ? '收起番茄钟' : '展开番茄钟'} {POMODORO_LABELS[pomoState]}
          </button>
        </div>

        {/* Pomodoro Panel */}
        {showPomodoro && (
          <div className="mt-4 p-4 bg-gray-800/50 rounded-xl max-w-xs mx-auto" role="group" aria-label="番茄钟计时器">
            <div className="text-center mb-3" aria-live="polite" aria-atomic="true">
              <div className="text-3xl font-mono font-bold text-white" aria-label={`剩余时间 ${pomoMin}分${pomoSec}秒`}>
                {String(pomoMin).padStart(2, '0')}:{String(pomoSec).padStart(2, '0')}
              </div>
              <div className={`text-xs mt-1 ${
                pomoState === 'running' ? 'text-green-400' :
                pomoState === 'paused' ? 'text-yellow-400' :
                pomoState === 'break' ? 'text-blue-400' : 'text-gray-500'
              }`}>
                {pomoState === 'break' && isLongBreak ? '长休息' :
                 pomoState === 'break' ? '短休息' :
                 pomoState === 'running' ? '专注中' :
                 pomoState === 'paused' ? '已暂停' : '准备开始'}
              </div>
            </div>

            {/* Progress ring */}
            <div className="flex justify-center mb-3">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-700" />
                <circle
                  cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${pomoProgress * 283} 283`}
                  className={pomoState === 'break' ? (isLongBreak ? 'text-purple-400' : 'text-blue-400') : 'text-green-400'}
                />
              </svg>
            </div>

            <div className="flex items-center justify-center gap-2">
              {pomoState === 'idle' && (
                <button onClick={pomoStart} className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors" aria-label="开始番茄钟">
                  开始
                </button>
              )}
              {pomoState === 'running' && (
                <button onClick={pomoPause} className="px-4 py-1.5 text-sm bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors" aria-label="暂停番茄钟">
                  暂停
                </button>
              )}
              {pomoState === 'paused' && (
                <>
                  <button onClick={pomoResume} className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors" aria-label="继续番茄钟">
                    继续
                  </button>
                  <button onClick={pomoReset} className="px-4 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors" aria-label="重置番茄钟">
                    重置
                  </button>
                </>
              )}
              {pomoState === 'break' && (
                <button onClick={pomoReset} className="px-4 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors" aria-label={isLongBreak ? '跳过长休息' : '跳过休息'}>
                  跳过休息
                </button>
              )}
            </div>
            <p className="text-center text-xs text-gray-500 mt-2">已完成 {sessionsCompleted} 个番茄</p>
          </div>
        )}

        {/* Keyboard hints */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-600">
          <span><kbd className="px-2 py-1 bg-gray-800 rounded">T</kbd> 计时</span>
          <span><kbd className="px-2 py-1 bg-gray-800 rounded">P</kbd> 番茄钟</span>
          <span><kbd className="px-2 py-1 bg-gray-800 rounded">Esc</kbd> 退出</span>
        </div>
      </div>
    </div>
  );
}
