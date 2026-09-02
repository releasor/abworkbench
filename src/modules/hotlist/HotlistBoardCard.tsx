import { useTranslation } from '../../i18n'
import type { HotlistBoard } from './types'
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

export default function HotlistBoardCard({ board, onOpen }: Props) {
  const { t } = useTranslation()
  return (
    <article className="hotlist-card">
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
        <div className="hotlist-card__body">
          <ol className="hotlist-card__list">
            {board.items.map((item) => (
              <li key={`${board.id}-${item.rank}-${item.url}`} className="hotlist-card__item">
                <button
                  type="button"
                  className="hotlist-card__link"
                  onClick={() => onOpen(item.url)}
                  title={item.title}
                >
                  <span className={rankClass(item.rank)} aria-hidden="true">
                    {item.rank}
                  </span>
                  <span className="hotlist-card__text">{item.title}</span>
                  {item.hot ? <span className="hotlist-card__hot">{item.hot}</span> : null}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  )
}
