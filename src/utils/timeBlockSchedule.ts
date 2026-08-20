import { readLocalValue, writeLocalValue } from './localData.ts'

export const TIME_BLOCK_SCHEDULE_KEY = 'abworkbench-time-block-schedule'

/** dayKey (YYYY-MM-DD) → taskId → hour (8–21) */
export type TimeBlockScheduleMap = Record<string, Record<string, number>>

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const MIN_HOUR = 8
const MAX_HOUR = 21

export function clampScheduleHour(hour: number): number {
  if (!Number.isFinite(hour)) return MIN_HOUR
  return Math.min(MAX_HOUR, Math.max(MIN_HOUR, Math.round(hour)))
}

export function readTimeBlockSchedule(storage?: StorageLike): TimeBlockScheduleMap {
  try {
    const raw = readLocalValue(TIME_BLOCK_SCHEDULE_KEY, '{}', storage)
    const parsed = JSON.parse(raw || '{}') as TimeBlockScheduleMap
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed
  } catch {
    return {}
  }
}

export function writeTimeBlockSchedule(
  map: TimeBlockScheduleMap,
  storage?: StorageLike,
): TimeBlockScheduleMap {
  writeLocalValue(TIME_BLOCK_SCHEDULE_KEY, JSON.stringify(map), storage)
  return map
}

export function getDayTaskHours(
  dayKey: string,
  map?: TimeBlockScheduleMap,
  storage?: StorageLike,
): Record<string, number> {
  const source = map ?? readTimeBlockSchedule(storage)
  return source[dayKey] || {}
}

export function setTaskScheduledHour(
  dayKey: string,
  taskId: string,
  hour: number,
  storage?: StorageLike,
): TimeBlockScheduleMap {
  const map = readTimeBlockSchedule(storage)
  const day = { ...(map[dayKey] || {}) }
  day[taskId] = clampScheduleHour(hour)
  return writeTimeBlockSchedule({ ...map, [dayKey]: day }, storage)
}

export function clearTaskScheduledHour(
  dayKey: string,
  taskId: string,
  storage?: StorageLike,
): TimeBlockScheduleMap {
  const map = readTimeBlockSchedule(storage)
  const day = { ...(map[dayKey] || {}) }
  delete day[taskId]
  const next = { ...map }
  if (Object.keys(day).length === 0) delete next[dayKey]
  else next[dayKey] = day
  return writeTimeBlockSchedule(next, storage)
}
