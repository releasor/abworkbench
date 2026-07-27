import { useState, useEffect, useCallback, useRef } from 'react';
import { requestNotificationPermission } from '../utils/notifications';
import { safeGet, safeSet } from '../../../utils/safeLocalStorage';

export type PomodoroState = 'idle' | 'running' | 'paused' | 'break';

export interface PomodoroConfig {
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
}

const DEFAULT_CONFIG: PomodoroConfig = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

const STORAGE_KEY = 'taskflow-pomodoro-config';

function loadConfig(): PomodoroConfig {
  const parsed = safeGet<Partial<PomodoroConfig>>(STORAGE_KEY, {});
  return {
    workMinutes: typeof parsed.workMinutes === 'number' && parsed.workMinutes > 0 ? parsed.workMinutes : DEFAULT_CONFIG.workMinutes,
    breakMinutes: typeof parsed.breakMinutes === 'number' && parsed.breakMinutes > 0 ? parsed.breakMinutes : DEFAULT_CONFIG.breakMinutes,
    longBreakMinutes: typeof parsed.longBreakMinutes === 'number' && parsed.longBreakMinutes > 0 ? parsed.longBreakMinutes : DEFAULT_CONFIG.longBreakMinutes,
    sessionsBeforeLongBreak: typeof parsed.sessionsBeforeLongBreak === 'number' && parsed.sessionsBeforeLongBreak > 0 ? parsed.sessionsBeforeLongBreak : DEFAULT_CONFIG.sessionsBeforeLongBreak,
  };
}

export function savePomodoroConfig(config: PomodoroConfig): void {
  safeSet(STORAGE_KEY, config);
}

const NOOP = () => {};

export interface PomodoroCallbacks {
  onWorkComplete?: (durationSeconds: number) => void
}

export function usePomodoro(config: PomodoroConfig = loadConfig(), callbacks?: PomodoroCallbacks) {
  const [state, setState] = useState<PomodoroState>('idle');
  const [secondsLeft, setSecondsLeft] = useState(config.workMinutes * 60);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [isLongBreak, setIsLongBreak] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef<() => void>(NOOP);
  const configRef = useRef(config);
  const callbacksRef = useRef(callbacks);
  const workStartRef = useRef<number>(0);

  // Keep callbacks ref in sync
  useEffect(() => { callbacksRef.current = callbacks; }, [callbacks]);

  // Reset timer when config changes (e.g. after settings save)
  const configKey = `${config.workMinutes}:${config.breakMinutes}:${config.longBreakMinutes}:${config.sessionsBeforeLongBreak}`;
  const prevConfigKeyRef = useRef(configKey);

  useEffect(() => {
    if (configKey === prevConfigKeyRef.current) {
      configRef.current = config;
      return;
    }
    prevConfigKeyRef.current = configKey;
    configRef.current = config;
    if (state === 'idle') {
      queueMicrotask(() => {
        setSecondsLeft(config.workMinutes * 60);
      });
    }
  }, [config, configKey, state]);

  const totalSeconds = state === 'break'
    ? (isLongBreak ? config.longBreakMinutes : config.breakMinutes) * 60
    : config.workMinutes * 60;
  const progress = 1 - secondsLeft / totalSeconds;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (breakTimerRef.current) {
      clearTimeout(breakTimerRef.current);
      breakTimerRef.current = null;
    }
  }, []);

  const startCountdown = useCallback((onComplete: () => void) => {
    clearTimer();
    onCompleteRef.current = onComplete;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimer]);

  const start = useCallback(() => {
    workStartRef.current = Date.now();
    setState('running');
    startCountdown(NOOP);
  }, [startCountdown]);

  const pause = useCallback(() => {
    setState('paused');
    clearTimer();
  }, [clearTimer]);

  const resume = useCallback(() => {
    setState((prev) => prev === 'paused' ? 'running' : prev);
    startCountdown(onCompleteRef.current);
  }, [startCountdown]);

  const reset = useCallback(() => {
    clearTimer();
    onCompleteRef.current = NOOP;
    setState('idle');
    setSecondsLeft(config.workMinutes * 60);
  }, [clearTimer, config.workMinutes]);

  const startBreak = useCallback((completedSessions: number) => {
    const longBreak = completedSessions > 0 && completedSessions % config.sessionsBeforeLongBreak === 0;
    const breakDuration = longBreak ? config.longBreakMinutes : config.breakMinutes;
    setIsLongBreak(longBreak);
    setState('break');
    setSecondsLeft(breakDuration * 60);
    startCountdown(() => {
      // Break completed
      setState('idle');
      setSecondsLeft(config.workMinutes * 60);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('休息结束', {
          body: '准备好继续专注了吗?',
          icon: '/favicon.ico',
          tag: 'pomodoro-break-end',
        });
      }
    });
  }, [startCountdown, config.breakMinutes, config.longBreakMinutes, config.sessionsBeforeLongBreak, config.workMinutes]);

  // When timer reaches 0
  useEffect(() => {
    if (secondsLeft === 0 && state === 'running') {
      const durationSeconds = workStartRef.current > 0 ? Math.round((Date.now() - workStartRef.current) / 1000) : config.workMinutes * 60;
      callbacksRef.current?.onWorkComplete?.(durationSeconds);
      setSessionsCompleted((prev) => {
        const newCount = prev + 1;
        // Notify user that focus session is complete
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const isLong = newCount % config.sessionsBeforeLongBreak === 0;
          new Notification('专注完成!', {
            body: isLong ? `太棒了! 已完成 ${newCount} 个番茄，长休息一下吧。` : '太棒了! 休息一下吧。',
            icon: '/favicon.ico',
            tag: 'pomodoro-complete',
          });
        }
        // Auto-start break after a short delay
        breakTimerRef.current = setTimeout(() => startBreak(newCount), 1000);
        return newCount;
      });
    }
  }, [secondsLeft, state, config.sessionsBeforeLongBreak, config.workMinutes, startBreak]);

  // Request notification permission on first start
  const startWithPermission = useCallback(() => {
    requestNotificationPermission();
    start();
  }, [start]);

  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  return {
    state,
    minutes,
    seconds,
    secondsLeft,
    totalSeconds,
    progress,
    sessionsCompleted,
    isLongBreak,
    start: startWithPermission,
    pause,
    resume,
    reset,
  };
}
