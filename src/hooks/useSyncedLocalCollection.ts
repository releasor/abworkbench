import { useCallback, useEffect, useState } from 'react'
import { LOCAL_DATA_CHANGE_EVENT, readLocalCollection, writeLocalCollection } from '../utils/localData'

interface LocalDataChangeEvent<T> extends Event {
  detail?: {
    key: string
    value: T[]
  }
}

export function useSyncedLocalCollection<T extends { id: string }>(key: string, fallback: T[] = []) {
  const [items, setItemsState] = useState<T[]>(() => readLocalCollection<T>(key, fallback))

  useEffect(() => {
    const handleLocalChange = (event: Event) => {
      const detail = (event as LocalDataChangeEvent<T>).detail
      if (detail?.key === key) setItemsState(Array.isArray(detail.value) ? detail.value : readLocalCollection<T>(key, fallback))
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === key) setItemsState(readLocalCollection<T>(key, fallback))
    }
    window.addEventListener(LOCAL_DATA_CHANGE_EVENT, handleLocalChange)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(LOCAL_DATA_CHANGE_EVENT, handleLocalChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [fallback, key])

  const setItems = useCallback((value: T[] | ((current: T[]) => T[])) => {
    setItemsState((current) => {
      const next = typeof value === 'function' ? (value as (current: T[]) => T[])(current) : value
      writeLocalCollection(key, next)
      return next
    })
  }, [key])

  const add = useCallback((item: T) => setItems((current) => [item, ...current]), [setItems])
  const remove = useCallback((id: string) => setItems((current) => current.filter((item) => item.id !== id)), [setItems])
  const update = useCallback((id: string, patch: Partial<T>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)), [setItems])

  return { items, setItems, add, remove, update }
}
