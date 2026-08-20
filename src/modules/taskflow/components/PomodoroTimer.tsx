import { useState, useEffect, useRef, useCallback } from 'react';
import type { PomodoroConfig } from '../hooks/usePomodoro';
import { usePomodoro, savePomodoroConfig } from '../hooks/usePomodoro';
import { playClickSound } from '../utils/sound';
import { Icon } from './Icon';
import { api } from '../utils/api';
import { showToast } from '../utils/toastEvent';
import { useTaskStore } from '../hooks/useTaskStore';
import { useStore } from '../../../store';

const STATE_LABELS: Record<string, string> = {
  idle: '准备开始',
  running: '专注中',
  paused: '已暂停',
  break: '休息中',
};

const STATE_COLORS: Record<string, string> = {
  idle: 'text-text-muted',
  running: 'text-success',
  paused: 'text-warning',
  break: 'text-primary',
};

interface PomodoroTimerProps {
  externalToggle?: boolean;
  onToggle?: () => void;
  taskId?: string;
}

export function PomodoroTimer({ externalToggle, onToggle, taskId }: PomodoroTimerProps) {
  const addPomodoroSession = useStore((s) => s.addPomodoroSession)
  const [config, setConfig] = useState<PomodoroConfig>(() => {
    try {
      const raw = localStorage.getItem('taskflow-pomodoro-config');
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore invalid local config and fall back to defaults.
    }
    const store = useStore.getState()
    return {
      workMinutes: store.pomodoroWorkDuration || 25,
      breakMinutes: store.pomodoroShortBreakDuration || 5,
      longBreakMinutes: store.pomodoroLongBreakDuration || 15,
      sessionsBeforeLongBreak: 4,
    };
  });

  const handleWorkComplete = useCallback((durationSeconds: number) => {
    const endedAt = Date.now()
    try {
      addPomodoroSession({
        startedAt: endedAt - Math.max(1, durationSeconds) * 1000,
        endedAt,
        type: 'work',
        completed: true,
        taskId: taskId || undefined,
      })
    } catch (err) {
      console.error('Failed to save pomodoro session:', err)
    }
    if (taskId) {
      api.tasks.stopTime(taskId).catch((err) => {
        console.error('Failed to stop time entry:', err);
        showToast('停止计时失败', 'error');
      });
    }
    showToast(`番茄钟完成，已记录 ${Math.round(durationSeconds / 60)} 分钟`, 'success');
  }, [addPomodoroSession, taskId]);

  const { state, minutes, seconds, progress, sessionsCompleted, isLongBreak, foreignActive, start, pause, resume, reset } = usePomodoro(config, {
    onWorkComplete: handleWorkComplete,
    source: 'taskflow',
    taskId,
  });
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const prevStateRef = useRef(state);

  // Sync pomodoro start/stop with task time tracking
  useEffect(() => {
    if (!taskId) return;
    const prev = prevStateRef.current;
    prevStateRef.current = state;
    // Started running → start a time entry on the task
    if (state === 'running' && prev !== 'running') {
      api.tasks.startTime(taskId, '番茄钟专注').catch((err) => {
        console.error('Failed to start time entry:', err);
        showToast('启动计时失败', 'error');
      });
    }
    // Stopped running (paused/reset/completed) → stop the time entry
    if (state !== 'running' && prev === 'running') {
      api.tasks.stopTime(taskId).catch((err) => {
        console.error('Failed to stop time entry:', err);
        showToast('停止计时失败', 'error');
      });
    }
  }, [state, taskId]);

  // Sync with external toggle trigger — only toggle on actual value change, not initial mount
  const prevToggleRef = useRef(externalToggle);
  useEffect(() => {
    if (externalToggle !== undefined && prevToggleRef.current !== externalToggle) {
      setExpanded((prev) => !prev);
      onToggle?.();
    }
    prevToggleRef.current = externalToggle;
  }, [externalToggle, onToggle]);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="btn btn-ghost p-2 relative"
        title="番茄钟"
        aria-label={`番茄钟 - ${STATE_LABELS[state]}`}
        aria-expanded="false"
      >
        <Icon name="clock" className="w-5 h-5" />
        {state === 'running' && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        )}
      </button>
    );
  }

  const linkedTask = taskId ? useTaskStore.getState().tasks.find((t) => t.id === taskId) : null;

  return (
    <div className="fixed bottom-16 right-4 z-50 card p-4 w-64 shadow-xl animate-slide-in" role="dialog" aria-modal="true" aria-label="番茄钟计时器">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" id="pomodoro-title">番茄钟</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSettings(!showSettings)} className="text-text-muted hover:text-text" aria-label="番茄钟设置" aria-expanded={showSettings}>
            <Icon name="settings" className="w-4 h-4" />
          </button>
          <button onClick={() => { setExpanded(false); setShowSettings(false); }} className="text-text-muted hover:text-text" aria-label="关闭番茄钟">
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>
      </div>

      {linkedTask && (
        <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 px-2 py-1.5">
          <Icon name="check-square" className="w-3 h-3 text-green-600 dark:text-green-400" />
          <span className="text-xs font-medium text-green-700 dark:text-green-300 truncate">{linkedTask.title}</span>
        </div>
      )}

      {/* Timer Display */}
      <div className="text-center mb-4" aria-live="polite" aria-atomic="true">
        <div className="text-4xl font-mono font-bold mb-1" aria-label={`剩余时间 ${minutes}分${seconds}秒`}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
        <div className={`text-xs font-medium ${STATE_COLORS[state]}`}>
          {state === 'break' && isLongBreak ? '长休息' : STATE_LABELS[state]}
          {foreignActive && state === 'paused' ? ' · 其它入口进行中' : ''}
        </div>
      </div>

      {/* Progress Ring */}
      <div className="flex justify-center mb-4">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="计时进度">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-text"
            aria-hidden="true"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${progress * 283} 283`}
            className={state === 'break' ? (isLongBreak ? 'text-purple-500' : 'text-blue-500') : 'text-green-500'}
            aria-hidden="true"
          />
        </svg>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2" role="group" aria-label="计时器控制">
        {state === 'idle' && (
          <button onClick={() => { start(); playClickSound(); }} className="btn btn-primary text-sm px-4" aria-label="开始专注计时">
            开始专注
          </button>
        )}
        {state === 'running' && (
          <button onClick={() => { pause(); playClickSound(); }} className="btn btn-secondary text-sm px-4" aria-label="暂停计时">
            暂停
          </button>
        )}
        {state === 'paused' && (
          <>
            <button onClick={() => { resume(); playClickSound(); }} className="btn btn-primary text-sm px-4" aria-label="继续计时">
              继续
            </button>
            <button onClick={() => { reset(); playClickSound(); }} className="btn btn-secondary text-sm px-4" aria-label="重置计时器">
              重置
            </button>
          </>
        )}
        {state === 'break' && (
          <button onClick={() => { reset(); playClickSound(); }} className="btn btn-secondary text-sm px-4" aria-label={isLongBreak ? '跳过长休息' : '跳过休息'}>
            {isLongBreak ? '跳过长休息' : '跳过休息'}
          </button>
        )}
      </div>

      {/* Sessions */}
      <div className="mt-3 text-center text-xs text-text-muted">
        已完成 {sessionsCompleted} 个番茄
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <PomodoroSettings
          config={config}
          onSave={(newConfig) => {
            setConfig(newConfig);
            savePomodoroConfig(newConfig);
            useStore.getState().setPomodoroDurations(
              newConfig.workMinutes,
              newConfig.breakMinutes,
              newConfig.longBreakMinutes,
            )
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function PomodoroSettings({ config, onSave, onClose }: { config: PomodoroConfig; onSave: (config: PomodoroConfig) => void; onClose: () => void }) {
  const [localConfig, setLocalConfig] = useState<PomodoroConfig>(config);

  const handleSave = () => {
    const cfg: PomodoroConfig = {
      workMinutes: Math.max(1, Math.round(localConfig.workMinutes)),
      breakMinutes: Math.max(1, Math.round(localConfig.breakMinutes)),
      longBreakMinutes: Math.max(1, Math.round(localConfig.longBreakMinutes)),
      sessionsBeforeLongBreak: Math.max(1, Math.round(localConfig.sessionsBeforeLongBreak)),
    };
    onSave(cfg);
  };

  return (
    <div className="mt-3 pt-3 border-t border-border" role="group" aria-label="番茄钟设置">
      <p className="text-xs font-medium text-text-muted mb-2">自定义时长</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="flex items-center gap-1.5">
          <span className="text-text-muted">专注</span>
          <input
            type="number"
            min={1}
            max={120}
            value={localConfig.workMinutes}
            onChange={(e) => setLocalConfig({ ...localConfig, workMinutes: +e.target.value })}
            className="w-14 px-1.5 py-1 rounded border border-border bg-white text-center"
          />
          <span className="text-text-muted">分</span>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-text-muted">短休</span>
          <input
            type="number"
            min={1}
            max={30}
            value={localConfig.breakMinutes}
            onChange={(e) => setLocalConfig({ ...localConfig, breakMinutes: +e.target.value })}
            className="w-14 px-1.5 py-1 rounded border border-border bg-white text-center"
          />
          <span className="text-text-muted">分</span>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-text-muted">长休</span>
          <input
            type="number"
            min={1}
            max={60}
            value={localConfig.longBreakMinutes}
            onChange={(e) => setLocalConfig({ ...localConfig, longBreakMinutes: +e.target.value })}
            className="w-14 px-1.5 py-1 rounded border border-border bg-white text-center"
          />
          <span className="text-text-muted">分</span>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-text-muted">轮次</span>
          <input
            type="number"
            min={1}
            max={10}
            value={localConfig.sessionsBeforeLongBreak}
            onChange={(e) => setLocalConfig({ ...localConfig, sessionsBeforeLongBreak: +e.target.value })}
            className="w-14 px-1.5 py-1 rounded border border-border bg-white text-center"
          />
          <span className="text-text-muted">次</span>
        </label>
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={handleSave} className="flex-1 btn btn-primary text-xs py-1">保存</button>
        <button onClick={onClose} className="flex-1 btn btn-ghost text-xs py-1">取消</button>
      </div>
    </div>
  );
}
