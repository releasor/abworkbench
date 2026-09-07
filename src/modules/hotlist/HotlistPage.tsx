import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Flame, RefreshCw } from 'lucide-react'
import BorderGlow from '../../components/common/BorderGlow/BorderGlow'
import { GlassCard } from '../../components/common/GlassSurface'
import { useBorderGlowSurfaceColor, useBorderGlowTheme } from '../../components/common/BorderGlow/borderGlowTheme'
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
  const glowTheme = useBorderGlowTheme()
  const surfaceColor = useBorderGlowSurfaceColor()
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
    void Promise.resolve().then(() => load(false))
  }, [load])

  const handleOpen = useCallback((url: string) => {
    void openHotlistUrl(url)
  }, [])

  const visibleBoards = useMemo(
    () => sortHotlistBoards(boards, platformOrder),
    [boards, platformOrder],
  )

  const refreshButton = (
    <button
      type="button"
      className="interactive-glass dashboard-chip inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
      disabled={refreshing || (loading && boards.length === 0)}
      onClick={() => void load(true)}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
      {refreshing ? t('hotlist.refreshing') : error && boards.length === 0 ? t('hotlist.retry') : t('hotlist.refresh')}
    </button>
  )

  let body: ReactNode
  if (loading && boards.length === 0) {
    body = (
      <div className="hotlist-state">
        <Flame className="h-8 w-8 animate-pulse text-primary" />
        <p className="text-sm text-text-muted">{t('hotlist.loading')}</p>
      </div>
    )
  } else if (error && boards.length === 0) {
    body = (
      <div className="hotlist-state hotlist-state--error">
        <p className="text-sm">{error}</p>
        {refreshButton}
      </div>
    )
  } else {
    body = (
      <>
        {error ? (
          <GlassCard className="dashboard-panel px-4 py-3 text-sm text-red-300">
            {error}
          </GlassCard>
        ) : null}
        <div className="hotlist-grid">
          {visibleBoards.map((board) => (
            <HotlistBoardCard key={board.id} board={board} onOpen={handleOpen} />
          ))}
        </div>
      </>
    )
  }

  return (
    <BorderGlow
      {...glowTheme}
      borderRadius={22}
      backgroundColor={surfaceColor}
      glowMaskColor={surfaceColor}
      className="hotlist-stage-frame border-glow-card--glass h-full min-h-0 w-full"
      innerClassName="hotlist-stage flex h-full min-h-0 flex-col page-enter-key"
    >
      <div className="hotlist-content-scroll flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-5">
        <BorderGlow
          {...glowTheme}
          borderRadius={28}
          backgroundColor={surfaceColor}
          glowMaskColor={surfaceColor}
          className="w-full shrink-0 border-glow-card--glass"
          innerClassName="dashboard-hero relative overflow-hidden p-6 md:p-8"
        >
          <div className="relative z-[2] flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 max-w-2xl">
              <div className="home-kicker mb-3 inline-flex items-center gap-2">
                <Flame size={12} />
                <span>{t('page.hotlist')}</span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-text md:text-4xl">{t('page.hotlist')}</h1>
              <p className="mt-2 text-sm text-text-muted">{t('hotlist.subtitle')}</p>
            </div>
            <div className="shrink-0">{refreshButton}</div>
          </div>
        </BorderGlow>

        {body}
      </div>
    </BorderGlow>
  )
}
