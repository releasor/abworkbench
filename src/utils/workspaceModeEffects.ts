import type { LauncherCommandDef } from '../launcher/intents.ts'
import { writeLocalValue } from './localData.ts'
import type { WorkspaceMode } from './workspaceModes.ts'

export const FOCUS_DND_KEY = 'abworkbench-focus-dnd'
export const WORKSPACE_MODE_EVENT = 'abworkbench:workspace-mode'

/** Launcher commands locked while Deep Work is active. */
export const DEEP_WORK_LOCKED_COMMAND_IDS = new Set([
  'stealth-reader',
  'stealth-reader-library',
])

export interface WorkspaceModeChangeDetail {
  prev: WorkspaceMode
  next: WorkspaceMode
}

export interface WorkspaceModeEffectPlan {
  enableDnd: boolean
  disableDnd: boolean
  navigatePomodoro: boolean
  startPomodoro: boolean
}

export function planWorkspaceModeEffects(
  prev: WorkspaceMode,
  next: WorkspaceMode,
): WorkspaceModeEffectPlan {
  const enteringDeep = next === 'deep' && prev !== 'deep'
  const leavingDeep = prev === 'deep' && next !== 'deep'
  return {
    enableDnd: enteringDeep,
    disableDnd: leavingDeep,
    navigatePomodoro: enteringDeep,
    startPomodoro: enteringDeep,
  }
}

export function applyWorkspaceModeSideEffects(plan: WorkspaceModeEffectPlan): void {
  if (plan.enableDnd) writeLocalValue(FOCUS_DND_KEY, 'true')
  if (plan.disableDnd) writeLocalValue(FOCUS_DND_KEY, 'false')
}

export function isDeepWorkMode(mode: WorkspaceMode): boolean {
  return mode === 'deep'
}

export function filterCommandsForWorkspaceMode(
  commands: LauncherCommandDef[],
  mode: WorkspaceMode,
): LauncherCommandDef[] {
  if (!isDeepWorkMode(mode)) return commands
  return commands.filter((command) => !DEEP_WORK_LOCKED_COMMAND_IDS.has(command.id))
}

/** Read workspace mode from zustand persist blob (launcher / other windows). */
export function readPersistedWorkspaceMode(
  storage?: Pick<Storage, 'getItem'> | null,
): WorkspaceMode {
  const target = storage ?? (typeof localStorage === 'undefined' ? null : localStorage)
  if (!target) return 'focus'
  try {
    const raw = target.getItem('dashboard-storage')
    if (!raw) return 'focus'
    const parsed = JSON.parse(raw) as { state?: { workspaceMode?: string } }
    const mode = parsed?.state?.workspaceMode
    if (
      mode === 'focus' ||
      mode === 'night' ||
      mode === 'minimal' ||
      mode === 'dashboard' ||
      mode === 'deep'
    ) {
      return mode
    }
  } catch {
    // ignore
  }
  return 'focus'
}

export function emitWorkspaceModeChange(prev: WorkspaceMode, next: WorkspaceMode): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_MODE_EVENT, {
      detail: { prev, next } satisfies WorkspaceModeChangeDetail,
    }),
  )
}

/** Retry pomodoro start until the timer page has mounted (safe if already running). */
export function requestPomodoroStart(retries = 8, intervalMs = 180): void {
  if (typeof window === 'undefined') return
  let left = retries
  const fire = () => {
    window.dispatchEvent(new CustomEvent('abworkbench:pomodoro-start'))
    left -= 1
    if (left > 0) window.setTimeout(fire, intervalMs)
  }
  window.setTimeout(fire, 80)
}
