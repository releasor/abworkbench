import { memo, useMemo } from 'react'
import AccordionGallery, { type AccordionGalleryItem } from '../../components/common/AccordionGallery'
import type { HotlistBoard } from './types'
import { buildHotlistCover } from './hotlistAccordion'
import HotlistBoardList from './HotlistBoardList'

const PLATFORMS_PER_ROW = 5

type Props = {
  boards: HotlistBoard[]
  onOpen: (url: string) => void
}

function chunkBoards(boards: HotlistBoard[], size: number): HotlistBoard[][] {
  const rows: HotlistBoard[][] = []
  for (let i = 0; i < boards.length; i += size) {
    rows.push(boards.slice(i, i + size))
  }
  return rows
}

function boardSignature(board: HotlistBoard): string {
  return [
    board.id,
    board.title,
    board.updateTime,
    board.loading ? '1' : '0',
    board.error ?? '',
    String(board.items.length),
    board.items[0]?.title ?? '',
    board.items[board.items.length - 1]?.title ?? '',
  ].join('|')
}

const HotlistGalleryRow = memo(function HotlistGalleryRow({
  boards,
  rowIndex,
  onOpen,
}: {
  boards: HotlistBoard[]
  rowIndex: number
  onOpen: (url: string) => void
}) {
  const boardsKey = boards.map(boardSignature).join('::')
  const items: AccordionGalleryItem[] = useMemo(
    () =>
      boards.map((board) => ({
        image: buildHotlistCover(board.title, rowIndex + 1, board.id),
        label: board.title,
        alt: board.title,
        content: <HotlistBoardList board={board} onOpen={onOpen} />,
      })),
    // Covers are stable per id/title/row; list content tracks board payload via signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardsKey, onOpen, rowIndex],
  )

  return (
    <AccordionGallery
      className="hotlist-platform-gallery"
      items={items}
      defaultIndex={Math.min(2, Math.max(items.length - 1, 0))}
      height={420}
      gap={10}
      radius={16}
      expandRatio={0.52}
      trigger="hover"
      grayscale
      showLabels
      accentColor="var(--color-primary, #67e8f9)"
      overlayColor="#060010"
      textColor="#ffffff"
      tilt={6}
      parallax={0.4}
      duration={0.5}
      ariaLabel={`热榜平台 第 ${rowIndex + 1} 行`}
    />
  )
})

export default function HotlistPlatformRows({ boards, onOpen }: Props) {
  const rows = useMemo(() => chunkBoards(boards, PLATFORMS_PER_ROW), [boards])

  return (
    <div className="hotlist-rows">
      {rows.map((row, rowIndex) => (
        <HotlistGalleryRow
          key={row.map((b) => b.id).join('-')}
          boards={row}
          rowIndex={rowIndex}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}
