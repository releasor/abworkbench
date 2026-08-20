import { useState, useEffect, useCallback, useRef } from 'react';
import { requestNotificationPermission } from '../utils/notifications';
import { safeGet, safeSet } from '../../../utils/safeLocalStorage';
import {
  ACTIVE_POMODORO_EVENT,
  claimActivePomodoro,
  clearActivePomodoro,
  getActiveRemainingSec,
  type ActivePomodoroSource,
  type ActivePomodoroState,
} from '../../../utils/activePomodoro';

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
  source?: ActivePomodoroSource
  taskId?: string
}

export function usePomodoro(config: PomodoroConfig = loadConfig(), callbacks?: PomodoroCallbacks) {
  const [state, setState] = useState<PomodoroState>('idle');
  const [secondsLeft, setSecondsLeft] = useState(config.workMinutes * 60);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [isLongBreak, setIsLongBreak] = useState(false);
  const [foreignActive, setForeignActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef<() => void>(NOOP);
  const configRef = useRef(config);
  const callbacksRef = useRef(callbacks);
  const workStartRef = useRef<number>(0);
  const stateRef = useRef(state);
  const secondsLeftRef = useRef(secondsLeft);
  const isLongBreakRef = useRef(isLongBreak);
  const suppressPublishRef = useRef(false);

  useEffect(() => { callbacksRef.current = callbacks; }, [callbacks]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { secondsLeftRef.current = secondsLeft; }, [secondsLeft]);
  useEffect(() => { isLongBreakRef.current = isLongBreak; }, [isLongBreak]);

  const source = callbacks?.source;
  const taskId = callbacks?.taskId;

  const publish = useCallback((next: { state: PomodoroState; secondsLeft: number; isLongBreak: boolean; running: boolean }) => {
    if (!source || suppressPublishRef.current) return;
    const mode: ActivePomodoroState['mode'] =
      next.state === 'break' ? (next.isLongBreak ? 'longBreak' : 'shortBreak') : 'work';
    if (next.state === 'idle') {
      clearActivePomodoro(source);
      return;
    }
    claimActivePomodoro({
      source,
      mode,
      targetEnd: next.running ? Date.now() + next.secondsLeft * 1000 : null,
      remainingSec: next.secondsLeft,
      taskId,
    });
  }, [source, taskId]);

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
    setForeignActive(false);
    setState('running');
    startCountdown(NOOP);
    publish({ state: 'running', secondsLeft: secondsLeftRef.current, isLongBreak: false, running: true });
  }, [startCountdown, publish]);

  const pause = useCallback(() => {
    setState('paused');
    clearTimer();
    publish({ state: 'paused', secondsLeft: secondsLeftRef.current, isLongBreak: isLongBreakRef.current, running: false });
  }, [clearTimer, publish]);

  const resume = useCallback(() => {
    setForeignActive(false);
    setState((prev) => (prev === 'paused' ? 'running' : prev));
    startCountdown(onCompleteRef.current);
    publish({ state: 'running', secondsLeft: secondsLeftRef.current, isLongBreak: isLongBreakRef.current, running: true });
  }, [startCountdown, publish]);

  const reset = useCallback(() => {
    clearTimer();
    onCompleteRef.current = NOOP;
    setState('idle');
    setSecondsLeft(config.workMinutes * 60);
    if (source) clearActivePomodoro(source);
  }, [clearTimer, config.workMinutes, source]);

  useEffect(() => {
    if (!source) return;
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<ActivePomodoroState | null>).detail;
      if (detail === undefined) return;
      if (!detail) {
        setForeignActive(false);
        return;
      }
      if (detail.source !== source) {
        setForeignActive(true);
        if (stateRef.current === 'running' || stateRef.current === 'break') {
          suppressPublishRef.current = true;
          clearTimer();
          setState('paused');
          suppressPublishRef.current = false;
        }
        return;
      }
      setForeignActive(false);
      const remaining = getActiveRemainingSec(detail);
      if (detail.targetEnd == null) {
        if (stateRef.current === 'running' || stateRef.current === 'break') {
          suppressPublishRef.current = true;
          clearTimer();
          setSecondsLeft(remaining || secondsLeftRef.current);
          setState('paused');
          suppressPublishRef.current = false;
        }
      } else if (stateRef.current === 'paused') {
        suppressPublishRef.current = true;
        setSecondsLeft(remaining);
        setState('running');
        startCountdown(onCompleteRef.current);
        suppressPublishRef.current = false;
      }
    };
    window.addEventListener(ACTIVE_POMODORO_EVENT, onChange as EventListener);
    return () => window.removeEventListener(ACTIVE_POMODORO_EVENT, onChange as EventListener);
  }, [source, clearTimer, startCountdown]);

  const startBreak = useCallback((completedSessions: number) => {
    const longBreak = completedSessions > 0 && completedSessions % config.sessionsBeforeLongBreak === 0;
    const breakDuration = longBreak ? config.longBreakMinutes : config.breakMinutes;
    setIsLongBreak(longBreak);
    setState('break');
    setSecondsLeft(breakDuration * 60);
    publish({ state: 'break', secondsLeft: breakDuration * 60, isLongBreak: longBreak, running: true });
    startCountdown(() => {
      setState('idle');
      setSecondsLeft(config.workMinutes * 60);
      if (source) clearActivePomodoro(source);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('休息结束', {
          body: '准备好继续专注了吗?',
          icon: '/favicon.ico',
          tag: 'pomodoro-break-end',
        });
      }
    });
  }, [startCountdown, config.breakMinutes, config.longBreakMinutes, config.sessionsBeforeLongBreak, config.workMinutes, publish, source]);

  useEffect(() => {
    if (secondsLeft === 0 && state === 'running') {
      const durationSeconds = workStartRef.current > 0 ? Math.round((Date.now() - workStartRef.current) / 1000) : config.workMinutes * 60;
      callbacksRef.current?.onWorkComplete?.(durationSeconds);
      setSessionsCompleted((prev) => {
        const newCount = prev + 1;
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const isLong = newCount % config.sessionsBeforeLongBreak === 0;
          new Notification('专注完成!', {
            body: isLong ? `太棒了! 已完成 ${newCount} 个番茄，长休息一下吧。` : '太棒了! 休息一下吧。',
            icon: '/favicon.ico',
            tag: 'pomodoro-complete',
          });
        }
        breakTimerRef.current = setTimeout(() => startBreak(newCount), 1000);
        return newCount;
      });
    }
  }, [secondsLeft, state, config.sessionsBeforeLongBreak, config.workMinutes, startBreak]);

  const startWithPermission = useCallback(() => {
    requestNotificationPermission();
    start();
  }, [start]);

  useEffect(() => clearTimer, [clearTimer]);

  return {
    state,
    minutes,
    seconds,
    secondsLeft,
    totalSeconds,
    progress,
    sessionsCompleted,
    isLongBreak,
    foreignActive,
    start: startWithPermission,
    pause,
    resume,
    reset,
  };
}
