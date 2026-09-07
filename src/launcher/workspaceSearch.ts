import type { GlobalSearchResult } from '../utils/globalSearch'

export const LAUNCHER_INTENT_KEY = 'abworkbench-launcher-intent'

export function stashLauncherWorkspaceIntent(result: GlobalSearchResult): void {
  try {
    localStorage.setItem(LAUNCHER_INTENT_KEY, JSON.stringify({ result, ts: Date.now() }))
  } catch {
    // ignore storage failures
  }
}

export function consumeLauncherWorkspaceIntent(): GlobalSearchResult | null {
  try {
    const raw = localStorage.getItem(LAUNCHER_INTENT_KEY)
    if (!raw) return null
    localStorage.removeItem(LAUNCHER_INTENT_KEY)
    const parsed = JSON.parse(raw) as { result?: GlobalSearchResult; ts?: number }
    if (!parsed?.result || !parsed.ts || Date.now() - parsed.ts > 15000) return null
    return parsed.result
  } catch {
    return null
  }
}

export function pageForWorkspaceResult(result: GlobalSearchResult): string {
  if (result.type === 'note') return 'notes'
  if (result.type === 'habit') return 'habits'
  return 'taskflow'
}

export function workspaceResultLabel(result: GlobalSearchResult): string {
  if (result.type === 'task') return '任务'
  if (result.type === 'note') return '笔记'
  if (result.type === 'habit') return '习惯'
  if (result.type === 'project') return '项目'
  return '文件'
}
