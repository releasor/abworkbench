export const LOCAL_DATA_CHANGE_EVENT = 'abworkbench-local-data-change'

export interface LocalDataChangeDetail<T = unknown> {
  key: string
  value: T
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type DispatcherLike = Pick<EventTarget, 'dispatchEvent'>

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage
  return typeof localStorage === 'undefined' ? null : localStorage
}

function getDispatcher(dispatcher?: DispatcherLike): DispatcherLike | null {
  if (dispatcher) return dispatcher
  return typeof window === 'undefined' ? null : window
}

function emitLocalDataChange<T>(key: string, value: T, dispatcher?: DispatcherLike) {
  const target = getDispatcher(dispatcher)
  if (!target) return
  target.dispatchEvent(new CustomEvent(LOCAL_DATA_CHANGE_EVENT, { detail: { key, value } satisfies LocalDataChangeDetail<T> }))
}

export function readLocalCollection<T>(key: string, fallback: T[], storage?: StorageLike): T[] {
  const target = getStorage(storage)
  if (!target) return fallback
  try {
    const raw = target.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as T[] : fallback
  } catch {
    return fallback
  }
}

export function writeLocalCollection<T>(key: string, items: T[], storage?: StorageLike, dispatcher?: DispatcherLike): T[] {
  const target = getStorage(storage)
  if (target) target.setItem(key, JSON.stringify(items))
  emitLocalDataChange(key, items, dispatcher)
  return items
}

export function appendLocalCollection<T>(key: string, item: T, storage?: StorageLike, dispatcher?: DispatcherLike): T[] {
  const next = [item, ...readLocalCollection<T>(key, [], storage)]
  return writeLocalCollection(key, next, storage, dispatcher)
}

export function updateLocalCollection<T extends { id: string }>(key: string, id: string, patch: Partial<T>, storage?: StorageLike, dispatcher?: DispatcherLike): T[] {
  const next = readLocalCollection<T>(key, [], storage).map((item) => item.id === id ? { ...item, ...patch } : item)
  return writeLocalCollection(key, next, storage, dispatcher)
}

export function writeLocalValue(key: string, value: string, storage?: StorageLike, dispatcher?: DispatcherLike): string {
  const target = getStorage(storage)
  if (target) target.setItem(key, value)
  emitLocalDataChange(key, value, dispatcher)
  return value
}

export function readLocalValue(key: string, fallback = '', storage?: StorageLike): string {
  const target = getStorage(storage)
  return target?.getItem(key) ?? fallback
}
