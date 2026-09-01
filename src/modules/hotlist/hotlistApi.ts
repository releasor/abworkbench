import type { HotlistBoard, HotlistPlatform } from './types'

const BATCH_SIZE = 10
const PLATFORM_LIST_TIMEOUT_MS = 10000
const FETCH_TIMEOUT_MS = 15000
const BATCH_CONCURRENCY = 4

function batchTimeoutMs(ids: string[]): number {
  const rounds = Math.ceil(ids.length / BATCH_CONCURRENCY)
  return Math.min(120000, 5000 + rounds * (FETCH_TIMEOUT_MS + 2000))
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
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

export async function fetchHotlistPlatforms(): Promise<HotlistPlatform[]> {
  const api = window.electronAPI?.hotlistGetPlatforms
  if (api) {
    return withTimeout(api(), PLATFORM_LIST_TIMEOUT_MS, '获取热榜平台列表超时')
  }

  const legacy = window.electronAPI?.hotlistFetchAll
  if (legacy) {
    const boards = await withTimeout(legacy({ noCache: false }), PLATFORM_LIST_TIMEOUT_MS, '获取热榜平台列表超时')
    return boards.map((board) => ({
      id: board.id,
      title: board.title,
      subtitle: board.subtitle,
    }))
  }

  throw new Error('请在桌面端（Electron）中打开 Abworkbench 以加载热榜')
}

export async function fetchHotlistBatch(ids: string[], noCache = false): Promise<HotlistBoard[]> {
  const batchApi = window.electronAPI?.hotlistFetchBatch
  if (batchApi) {
    return withTimeout(batchApi({ ids, noCache }), batchTimeoutMs(ids), '热榜数据加载超时')
  }

  const singleApi = window.electronAPI?.hotlistFetch
  if (singleApi) {
    const perBoardTimeout = Math.max(12000, FETCH_TIMEOUT_MS + 2000)
    return Promise.all(
      ids.map((id) => withTimeout(singleApi(id, { noCache }), perBoardTimeout, `加载 ${id} 超时`)),
    )
  }

  throw new Error('请在桌面端（Electron）中打开 Abworkbench 以加载热榜')
}

export async function fetchAllHotlists(noCache = false): Promise<HotlistBoard[]> {
  const platforms = await fetchHotlistPlatforms()
  const boards: HotlistBoard[] = platforms.map(placeholderBoard)

  for (let i = 0; i < platforms.length; i += BATCH_SIZE) {
    const ids = platforms.slice(i, i + BATCH_SIZE).map((p) => p.id)
    try {
      const chunk = await fetchHotlistBatch(ids, noCache)
      const byId = new Map(chunk.map((board) => [board.id, board]))
      for (let j = 0; j < boards.length; j += 1) {
        const hit = byId.get(boards[j].id)
        if (hit) boards[j] = hit
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '热榜加载失败'
      for (let j = 0; j < boards.length; j += 1) {
        if (!ids.includes(boards[j].id) || !boards[j].loading) continue
        boards[j] = {
          ...boards[j],
          loading: false,
          error: message,
          items: [],
        }
      }
    }
  }

  return boards
}

export async function openHotlistUrl(url: string): Promise<void> {
  const open = window.electronAPI?.openTarget
  if (open) {
    await open(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
