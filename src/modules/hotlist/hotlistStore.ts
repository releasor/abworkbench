import {
  fetchHotlistBatch,
  fetchHotlistPlatforms,
  sortHotlistBoards,
} from './hotlistApi.ts'
import type { HotlistBoard, HotlistPlatform } from './types.ts'

export type HotlistStoreSnapshot = {
  boards: HotlistBoard[]
  platformOrder: string[]
  loading: boolean
  refreshing: boolean
  error: string | null
}

type HotlistFetchers = {
  platforms: () => Promise<HotlistPlatform[]>
  batch: (ids: string[], noCache: boolean) => Promise<HotlistBoard[]>
}

const BATCH_SIZE = 10

const idleSnapshot: HotlistStoreSnapshot = {
  boards: [],
  platformOrder: [],
  loading: false,
  refreshing: false,
  error: null,
}

let snapshot: HotlistStoreSnapshot = idleSnapshot
let loadToken = 0
let inFlight: Promise<void> | null = null
const listeners = new Set<() => void>()

let fetchers: HotlistFetchers = {
  platforms: fetchHotlistPlatforms,
  batch: fetchHotlistBatch,
}

function emit() {
  for (const listener of listeners) listener()
}

function setSnapshot(partial: Partial<HotlistStoreSnapshot>) {
  snapshot = { ...snapshot, ...partial }
  emit()
}

function placeholderBoard(platform: HotlistPlatform): HotlistBoard {
  return {
    id: platform.id,
    title: platform.title,
    subtitle: platform.subtitle,
    updateTime: new Date().toISOString(),
    fromCache: false,
    items: [],
    loading: true,
  }
}

async function runLoad(noCache: boolean): Promise<void> {
  const token = loadToken + 1
  loadToken = token

  if (noCache) setSnapshot({ refreshing: true })
  else setSnapshot({ loading: true, error: null })

  try {
    const platforms = await fetchers.platforms()
    if (loadToken !== token) return

    const platformOrder = platforms.map((platform) => platform.id)
    const prev = snapshot.boards
    const keepExisting = noCache && prev.length > 0
    const nextBoards = keepExisting
      ? platforms.map((platform) => {
          const existing = prev.find((board) => board.id === platform.id)
          if (!existing) return placeholderBoard(platform)
          return { ...existing, loading: true, error: undefined }
        })
      : platforms.map(placeholderBoard)

    setSnapshot({
      platformOrder,
      boards: nextBoards,
      loading: false,
    })

    let batchError: string | null = null
    for (let i = 0; i < platforms.length; i += BATCH_SIZE) {
      if (loadToken !== token) return
      const ids = platforms.slice(i, i + BATCH_SIZE).map((p) => p.id)
      try {
        const chunk = await fetchers.batch(ids, noCache)
        if (loadToken !== token) return
        const byId = new Map(chunk.map((board) => [board.id, board]))
        setSnapshot({
          boards: snapshot.boards.map((board) => {
            const hit = byId.get(board.id)
            if (!hit) return board
            return { ...hit, loading: false }
          }),
        })
      } catch (err) {
        if (loadToken !== token) return
        const message = err instanceof Error ? err.message : '热榜加载失败'
        batchError = message
        setSnapshot({
          boards: snapshot.boards.map((board) => {
            if (!ids.includes(board.id)) return board
            if (board.items.length > 0 && !board.loading) return board
            return {
              ...board,
              loading: false,
              error: message,
              items: [],
            }
          }),
        })
      }
    }

    if (loadToken !== token) return
    if (batchError) setSnapshot({ error: batchError })
    else if (noCache) setSnapshot({ error: null })
  } catch (err) {
    if (loadToken !== token) return
    setSnapshot({
      error: err instanceof Error ? err.message : '热榜加载失败',
      boards: [],
    })
  } finally {
    if (loadToken === token) {
      setSnapshot({ loading: false, refreshing: false })
      inFlight = null
    }
  }
}

/** Start background hotlist fetch if none is in flight / ready. */
export function ensureHotlistPrefetch(): Promise<void> {
  if (inFlight) return inFlight
  if (snapshot.boards.some((board) => board.items.length > 0) && !snapshot.loading) {
    return Promise.resolve()
  }
  inFlight = runLoad(false)
  return inFlight
}

export function refreshHotlist(): Promise<void> {
  inFlight = runLoad(true)
  return inFlight
}

export function getHotlistStoreSnapshot(): HotlistStoreSnapshot {
  return snapshot
}

export function getVisibleHotlistBoards(): HotlistBoard[] {
  return sortHotlistBoards(snapshot.boards, snapshot.platformOrder)
}

export function subscribeHotlistStore(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test-only: swap network layer. */
export function setHotlistFetchersForTests(next: HotlistFetchers | null): void {
  fetchers = next ?? {
    platforms: fetchHotlistPlatforms,
    batch: fetchHotlistBatch,
  }
}

/** Test-only: reset module state. */
export function __resetHotlistStoreForTests(): void {
  loadToken += 1
  inFlight = null
  snapshot = idleSnapshot
  listeners.clear()
  fetchers = {
    platforms: fetchHotlistPlatforms,
    batch: fetchHotlistBatch,
  }
}
