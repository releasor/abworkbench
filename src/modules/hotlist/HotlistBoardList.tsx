import { memo } from 'react'
import AnimatedList from '../../components/common/AnimatedList'
import { useTranslation } from '../../i18n'
import type { HotlistBoard, HotlistItem } from './types'
import { formatHotlistUpdateLabel } from '../../utils/hotlistFormat'

type Props = {
  board: HotlistBoard
  onOpen: (url: string) => void
}

function rankClass(rank: number): string {
  if (rank === 1) return 'hotlist-rank hotlist-rank--1'
  if (rank === 2) return 'hotlist-rank hotlist-rank--2'
  if (rank === 3) return 'hotlist-rank hotlist-rank--3'
  return 'hotlist-rank'
}

function HotlistRow({
  item,
  selected,
  onOpen,
}: {
  item: HotlistItem
  selected: boolean
  onOpen: (url: string) => void
}) {
  return (
    <button
      type="button"
      className={`hotlist-card__link hotlist-panel-list__row${selected ? ' is-selected' : ''}`}
      title={item.title}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(item.url)
      }}
    >
      <span className={rankClass(item.rank)} aria-hidden="true">
        {item.rank}
      </span>
      <span className="hotlist-card__text">{item.title}</span>
      {item.hot ? <span className="hotlist-card__hot">{item.hot}</span> : null}
    </button>
  )
}

/** Ranked hotlist rows shown inside an expanded AccordionGallery platform panel. */
function HotlistBoardList({ board, onOpen }: Props) {
  const { t } = useTranslation()
  const labels = board.items.map((item) => item.title)

  return (
    <div className="hotlist-panel-list">
      <div className="hotlist-panel-list__meta">
        {board.subtitle ? <span className="hotlist-panel-list__subtitle">{board.subtitle}</span> : null}
        <time className="hotlist-panel-list__time" dateTime={board.updateTime}>
          {formatHotlistUpdateLabel(board.updateTime)}
        </time>
      </div>

      {board.loading ? (
        <p className="hotlist-card__loading">{t('hotlist.loading')}</p>
      ) : board.error ? (
        <p className="hotlist-card__error">{board.error}</p>
      ) : board.items.length === 0 ? (
        <p className="hotlist-card__empty">{t('hotlist.empty')}</p>
      ) : (
        <AnimatedList
          className="hotlist-animated-list"
          items={labels}
          showGradients={false}
          enableArrowNavigation={false}
          displayScrollbar={false}
          initialSelectedIndex={-1}
          onItemSelect={(_item, index) => {
            const hit = board.items[index]
            if (hit) onOpen(hit.url)
          }}
          renderItem={(_item, index, selected) => {
            const hit = board.items[index]
            if (!hit) return null
            return <HotlistRow item={hit} selected={selected} onOpen={onOpen} />
          }}
        />
      )}
    </div>
  )
}

export default memo(HotlistBoardList)
