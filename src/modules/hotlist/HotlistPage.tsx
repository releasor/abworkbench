import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Flame, RefreshCw } from 'lucide-react'
import { useTranslation } from '../../i18n'
import HotlistBoardCard from './HotlistBoardCard'
import { fetchHotlistBatch, fetchHotlistPlatforms, openHotlistUrl, sortHotlistBoards } from './hotlistApi'
import type { HotlistBoard, HotlistPlatform } from './types'
import './hotlist.css'

const BATCH_SIZE = 10

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

export default function HotlistPage() {
  const { t } = useTranslation()
  const [boards, setBoards] = useState<HotlistBoard[]>([])
  const [platformOrder, setPlatformOrder] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadTokenRef = useRef(0)

  const load = useCallback(async (noCache = false) => {
    const token = loadTokenRef.current + 1
    loadTokenRef.current = token

    if (noCache) setRefreshing(true)
    else {
      setLoading(true)
      setError(null)
    }

    try {
      const platforms = await fetchHotlistPlatforms()
      if (loadTokenRef.current !== token) return

      setPlatformOrder(platforms.map((platform) => platform.id))
      setBoards((prev) => {
        const keepExisting = noCache && prev.length > 0
        if (!keepExisting) return platforms.map(placeholderBoard)
        const byId = new Map(prev.map((board) => [board.id, board]))
        return platforms.map((platform) => {
          const existing = byId.get(platform.id)
          if (!existing) return placeholderBoard(platform)
          return {
            ...existing,
            loading: true,
            error: undefined,
          }
        })
      })
      setLoading(false)

      let batchError: string | null = null
      for (let i = 0; i < platforms.length; i += BATCH_SIZE) {
        if (loadTokenRef.current !== token) return
        const ids = platforms.slice(i, i + BATCH_SIZE).map((p) => p.id)
        try {
          const chunk = await fetchHotlistBatch(ids, noCache)
          if (loadTokenRef.current !== token) return
          const byId = new Map(chunk.map((board) => [board.id, board]))
          setBoards((prev) => prev.map((board) => {
            const hit = byId.get(board.id)
            if (!hit) return board
            return { ...hit, loading: false }
          }))
        } catch (err) {
          if (loadTokenRef.current !== token) return
          const message = err instanceof Error ? err.message : '热榜加载失败'
          batchError = message
          setBoards((prev) => prev.map((board) => {
            if (!ids.includes(board.id)) return board
            if (board.items.length > 0 && !board.loading) return board
            return {
              ...board,
              loading: false,
              error: message,
              items: [],
            }
          }))
        }
      }

      if (batchError) setError(batchError)
      else if (noCache) setError(null)
    } catch (err) {
      if (loadTokenRef.current !== token) return
      setError(err instanceof Error ? err.message : '热榜加载失败')
      setBoards([])
    } finally {
      if (loadTokenRef.current === token) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    void load(false)
  }, [load])

  const handleOpen = useCallback((url: string) => {
    void openHotlistUrl(url)
  }, [])

  const visibleBoards = useMemo(
    () => sortHotlistBoards(boards, platformOrder),
    [boards, platformOrder],
  )

  if (loading && boards.length === 0) {
    return (
      <div className="hotlist-page hotlist-page--state">
        <div className="hotlist-state">
          <Flame className="h-8 w-8 animate-pulse text-[var(--accent,#00f5d4)]" />
          <p>{t('hotlist.loading')}</p>
        </div>
      </div>
    )
  }

  if (error && boards.length === 0) {
    return (
      <div className="hotlist-page hotlist-page--state">
        <div className="hotlist-state hotlist-state--error">
          <p>{error}</p>
          <button type="button" className="hotlist-btn" onClick={() => void load(true)}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t('hotlist.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="hotlist-page page-enter-key">
      <div className="hotlist-toolbar">
        <div className="hotlist-toolbar__copy">
          <h1 className="hotlist-toolbar__title">{t('page.hotlist')}</h1>
          <p className="hotlist-toolbar__sub">{t('hotlist.subtitle')}</p>
        </div>
        <div className="hotlist-toolbar__actions">
          <button
            type="button"
            className="hotlist-btn"
            disabled={refreshing}
            onClick={() => void load(true)}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? t('hotlist.refreshing') : t('hotlist.refresh')}
          </button>
        </div>
      </div>

      {error ? <p className="hotlist-banner hotlist-banner--error">{error}</p> : null}

      <div className="hotlist-grid">
        {visibleBoards.map((board) => (
          <HotlistBoardCard key={board.id} board={board} onOpen={handleOpen} />
        ))}
      </div>
    </div>
  )
}
