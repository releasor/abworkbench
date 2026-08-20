import { readLocalCollection, writeLocalCollection } from './localData'

export const CAPTURE_HISTORY_KEY = 'abworkbench-capture-history'

export interface CaptureHistoryItem {
  id: string
  mode: 'task' | 'note' | 'reminder' | 'expense' | 'health'
  title: string
  raw: string
  createdAt: number
  undoPayload?: Record<string, unknown>
}

export function pushCaptureHistory(item: CaptureHistoryItem, limit = 20) {
  const next = [item, ...readLocalCollection<CaptureHistoryItem>(CAPTURE_HISTORY_KEY, []).filter((x) => x.id !== item.id)].slice(0, limit)
  writeLocalCollection(CAPTURE_HISTORY_KEY, next)
  return next
}

export function listCaptureHistory() {
  return readLocalCollection<CaptureHistoryItem>(CAPTURE_HISTORY_KEY, [])
}
