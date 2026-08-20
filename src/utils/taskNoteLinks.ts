import { readLocalValue, writeLocalValue } from './localData'

const LINKS_KEY = 'abworkbench-task-note-links'

type LinkMap = Record<string, string[]> // taskId -> noteIds

function readMap(): LinkMap {
  try {
    return JSON.parse(readLocalValue(LINKS_KEY, '{}') || '{}') as LinkMap
  } catch {
    return {}
  }
}

export function getNotesForTask(taskId: string): string[] {
  return readMap()[taskId] || []
}

export function getTasksForNote(noteId: string): string[] {
  const map = readMap()
  return Object.entries(map).filter(([, notes]) => notes.includes(noteId)).map(([taskId]) => taskId)
}

export function linkTaskNote(taskId: string, noteId: string) {
  const map = readMap()
  const list = new Set(map[taskId] || [])
  list.add(noteId)
  map[taskId] = [...list]
  writeLocalValue(LINKS_KEY, JSON.stringify(map))
}

export function unlinkTaskNote(taskId: string, noteId: string) {
  const map = readMap()
  map[taskId] = (map[taskId] || []).filter((id) => id !== noteId)
  if (map[taskId].length === 0) delete map[taskId]
  writeLocalValue(LINKS_KEY, JSON.stringify(map))
}
