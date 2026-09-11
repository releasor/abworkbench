import { useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { Flame, RefreshCw } from 'lucide-react'
import { GlassCard } from '../../components/common/GlassSurface'
import { useTranslation } from '../../i18n'
import HotlistPlatformRows from './HotlistPlatformRows'
import { openHotlistUrl, sortHotlistBoards } from './hotlistApi'
import { setHotlistHeaderChrome } from './hotlistHeaderChrome'
import {
  ensureHotlistPrefetch,
  getHotlistStoreSnapshot,
  refreshHotlist,
  subscribeHotlistStore,
} from './hotlistStore'
import './hotlist.css'

export default function HotlistPage() {
  const { t } = useTranslation()
  const { boards, platformOrder, loading, refreshing, error } = useSyncExternalStore(
    subscribeHotlistStore,
    getHotlistStoreSnapshot,
    getHotlistStoreSnapshot,
  )

  useEffect(() => {
    void ensureHotlistPrefetch()
  }, [])

  useEffect(() => {
    const label = refreshing
      ? t('hotlist.refreshing')
      : error && boards.length === 0
        ? t('hotlist.retry')
        : t('hotlist.refresh')
    setHotlistHeaderChrome({
      refreshing,
      disabled: refreshing || (loading && boards.length === 0),
      label,
      onRefresh: () => {
        void refreshHotlist()
      },
    })
    return () => setHotlistHeaderChrome(null)
  }, [boards.length, error, loading, refreshing, t])

  const handleOpen = useCallback((url: string) => {
    void openHotlistUrl(url)
  }, [])

  const visibleBoards = useMemo(
    () => sortHotlistBoards(boards, platformOrder),
    [boards, platformOrder],
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
        <button
          type="button"
          className="interactive-glass dashboard-chip inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-primary"
          onClick={() => void refreshHotlist()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('hotlist.retry')}
        </button>
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
        <HotlistPlatformRows boards={visibleBoards} onOpen={handleOpen} />
      </>
    )
  }

  return (
    <div className="hotlist-stage-frame h-full min-h-0 w-full">
      <div className="hotlist-stage flex h-full min-h-0 flex-col page-enter-key">
        <div className="hotlist-content-scroll flex min-h-0 flex-1 flex-col gap-3">
          {body}
        </div>
      </div>
    </div>
  )
}
