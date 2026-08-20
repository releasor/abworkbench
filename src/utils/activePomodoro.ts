/** Shared active pomodoro session across main / TaskFlow / Focus / Mini. */

export const ACTIVE_POMODORO_KEY = 'abworkbench-active-pomodoro'
export const ACTIVE_POMODORO_EVENT = 'abworkbench-active-pomodoro-change'

export type ActivePomodoroSource = 'main' | 'taskflow' | 'focus'

export interface ActivePomodoroState {
  source: ActivePomodoroSource
  mode: 'work' | 'shortBreak' | 'longBreak' | 'break'
  /** Absolute end time while running; null when paused */
  targetEnd: number | null
  /** Remaining seconds when paused */
  remainingSec: number
  taskId?: string
  updatedAt: number
}

function emit(state: ActivePomodoroState | null) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ACTIVE_POMODORO_EVENT, { detail: state }))
}

export function readActivePomodoro(): ActivePomodoroState | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_POMODORO_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActivePomodoroState
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function writeActivePomodoro(state: ActivePomodoroState | null) {
  try {
    if (!state) sessionStorage.removeItem(ACTIVE_POMODORO_KEY)
    else sessionStorage.setItem(ACTIVE_POMODORO_KEY, JSON.stringify(state))
  } catch {
    // ignore quota
  }
  emit(state)
}

/** Claim the global timer. Other sources should pause/stop on hearing a different source. */
export function claimActivePomodoro(state: Omit<ActivePomodoroState, 'updatedAt'> & { updatedAt?: number }) {
  writeActivePomodoro({ ...state, updatedAt: state.updatedAt ?? Date.now() })
}

export function clearActivePomodoro(source?: ActivePomodoroSource) {
  const current = readActivePomodoro()
  if (source && current && current.source !== source) return
  writeActivePomodoro(null)
}

export function getActiveRemainingSec(state: ActivePomodoroState | null, now = Date.now()): number {
  if (!state) return 0
  if (state.targetEnd != null) return Math.max(0, Math.ceil((state.targetEnd - now) / 1000))
  return Math.max(0, state.remainingSec || 0)
}

export function isActivePomodoroRunning(state: ActivePomodoroState | null = readActivePomodoro()): boolean {
  return !!(state && state.targetEnd != null && state.targetEnd > Date.now())
}

/** True when another source owns an active (running or paused) session. */
export function isForeignActivePomodoro(
  source: ActivePomodoroSource,
  state: ActivePomodoroState | null = readActivePomodoro(),
): boolean {
  return !!(state && state.source !== source)
}

export function pauseActivePomodoro(source?: ActivePomodoroSource) {
  const current = readActivePomodoro()
  if (!current) return
  if (source && current.source !== source) return
  if (current.targetEnd == null) return
  writeActivePomodoro({
    ...current,
    targetEnd: null,
    remainingSec: getActiveRemainingSec(current),
    updatedAt: Date.now(),
  })
}

export function resumeActivePomodoro(source?: ActivePomodoroSource) {
  const current = readActivePomodoro()
  if (!current) return
  if (source && current.source !== source) return
  if (current.targetEnd != null) return
  const remaining = Math.max(1, current.remainingSec || 0)
  writeActivePomodoro({
    ...current,
    targetEnd: Date.now() + remaining * 1000,
    remainingSec: remaining,
    updatedAt: Date.now(),
  })
}
