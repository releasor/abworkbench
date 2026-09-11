import { useMemo } from 'react'
import { GlassCard } from '../../components/common/GlassSurface'
import AccordionGallery from '../../components/common/AccordionGallery'
import { useTranslation } from '../../i18n'
import type { HotlistBoard } from './types'
import { formatHotlistUpdateLabel } from '../../utils/hotlistFormat'
import { mapHotlistItemsToAccordion } from './hotlistAccordion'

type Props = {
  board: HotlistBoard
  onOpen: (url: string) => void
}

export default function HotlistBoardCard({ board, onOpen }: Props) {
  const { t } = useTranslation()
  const panels = useMemo(
    () => mapHotlistItemsToAccordion(board.items, board.id, 6),
    [board.id, board.items],
  )

  return (
    <GlassCard borderRadius={22} className="dashboard-panel hotlist-card h-full min-w-0 w-full">
      <header className="hotlist-card__head">
        <div className="hotlist-card__title-wrap">
          <h2 className="hotlist-card__title">{board.title}</h2>
          {board.subtitle ? <span className="hotlist-card__subtitle">{board.subtitle}</span> : null}
        </div>
        <time className="hotlist-card__time" dateTime={board.updateTime}>
          {formatHotlistUpdateLabel(board.updateTime)}
        </time>
      </header>

      {board.loading ? (
        <div className="hotlist-card__body">
          <p className="hotlist-card__loading">{t('hotlist.loading')}</p>
        </div>
      ) : board.error ? (
        <div className="hotlist-card__body">
          <p className="hotlist-card__error">{board.error}</p>
        </div>
      ) : board.items.length === 0 ? (
        <div className="hotlist-card__body">
          <p className="hotlist-card__empty">{t('hotlist.empty')}</p>
        </div>
      ) : (
        <div className="hotlist-card__body hotlist-card__body--gallery">
          <AccordionGallery
            items={panels}
            defaultIndex={Math.min(2, Math.max(panels.length - 1, 0))}
            height={220}
            gap={8}
            radius={14}
            expandRatio={0.42}
            trigger="hover"
            grayscale
            showLabels
            accentColor="var(--color-primary, #67e8f9)"
            overlayColor="#060010"
            textColor="#ffffff"
            tilt={6}
            parallax={0.35}
            duration={0.45}
            ariaLabel={`${board.title} 热榜`}
            onItemOpen={(item) => {
              if (item.link) onOpen(item.link)
            }}
          />
        </div>
      )}
    </GlassCard>
  )
}
