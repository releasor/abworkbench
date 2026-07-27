import type { Page } from '../layout/Sidebar'
import type { CommandMacroId } from './commandMacros'
import { writeLocalValue } from '../../utils/localData.ts'

export interface MacroLocalState {
  target: Page
  inboxFilter?: 'open' | 'high'
  projectScan?: boolean
  createdAt?: string
}

export interface MacroRunResult {
  targetPage: Page
  createEveningReview?: boolean
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function buildMacroLocalState(id: CommandMacroId): MacroLocalState {
  if (id === 'macro-clear-inbox') return { target: 'dashboard', inboxFilter: 'high' }
  if (id === 'macro-project-scan') return { target: 'taskflow', projectScan: true }
  if (id === 'macro-start-work') return { target: 'taskflow' }
  if (id === 'macro-daily-review') return { target: 'taskflow' }
  if (id === 'macro-weekly-report') return { target: 'taskflow' }
  if (id === 'macro-focus-mode') return { target: 'taskflow' }
  if (id === 'macro-bulk-import') return { target: 'taskflow' }
  return { target: 'notes' }
}

export function runLocalMacro(id: CommandMacroId, storage?: StorageLike): MacroRunResult {
  const state = { ...buildMacroLocalState(id), createdAt: new Date().toISOString() }
  writeLocalValue('abworkbench-macro-state', JSON.stringify(state), storage)
  if (id === 'macro-start-work') writeLocalValue('abworkbench-focus-dnd', 'true', storage)
  if (id === 'macro-evening-review') return { targetPage: 'notes', createEveningReview: true }
  return { targetPage: state.target }
}
