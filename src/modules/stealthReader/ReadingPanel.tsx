import { useCallback, useEffect, useRef, useState } from 'react'
import { BookMarked, Minus, Plus, X } from 'lucide-react'
import type { ReaderUiSettings } from './StealthReaderApp'

interface ReadingPanelProps {
  bookId: string
  settings: ReaderUiSettings
  onError: (msg: string) => void
  onBackLibrary: () => void
  onPatchSettings: (partial: Partial<ReaderUiSettings>) => Promise<void>
}

export default function ReadingPanel({
  bookId,
  settings,
  onError,
  onBackLibrary,
  onPatchSettings,
}: ReadingPanelProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [chapterIndex, setChapterIndex] = useState(0)
  const [chapterCount, setChapterCount] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persistProgress = useCallback((index: number, offset: number) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void window.electronAPI?.readerSetProgress?.({
        bookId,
        chapterIndex: index,
        offset,
        updatedAt: Date.now(),
      })
    }, 400)
  }, [bookId])

  const loadChapter = useCallback(async (index: number) => {
    onError('')
    const result = await window.electronAPI?.readerGetChapter?.(bookId, index)
    if (!result) {
      onError('无法读取章节')
      return
    }
    if (!result.ok) {
      onError(result.message)
      return
    }
    setTitle(result.chapter.title)
    setBody(result.chapter.body)
    setChapterIndex(result.chapter.chapterIndex)
    setChapterCount(result.chapter.chapterCount)
    persistProgress(result.chapter.chapterIndex, 0)
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    })
  }, [bookId, onError, persistProgress])

  useEffect(() => {
    queueMicrotask(() => {
      void (async () => {
        const lib = await window.electronAPI?.readerListBooks?.()
        const start = lib?.progress?.bookId === bookId ? lib.progress.chapterIndex : 0
        await loadChapter(start)
        if (lib?.progress?.bookId === bookId && scrollRef.current) {
          const offset = lib.progress.offset
          requestAnimationFrame(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = offset
          })
        }
      })()
    })
  }, [bookId, loadChapter])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (chapterIndex > 0) void loadChapter(chapterIndex - 1)
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        if (e.key === ' ' && (e.target as HTMLElement)?.tagName === 'INPUT') return
        e.preventDefault()
        if (chapterIndex + 1 < chapterCount) void loadChapter(chapterIndex + 1)
      } else if (e.key === '+' || e.key === '=') {
        void onPatchSettings({ fontSize: Math.min(36, settings.fontSize + 1) })
      } else if (e.key === '-') {
        void onPatchSettings({ fontSize: Math.max(12, settings.fontSize - 1) })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chapterCount, chapterIndex, loadChapter, onPatchSettings, settings.fontSize])

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center gap-2 border-b border-white/10 px-2 py-1.5 text-xs text-zinc-200"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <button
          type="button"
          className="rounded-md p-1 hover:bg-white/10"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={onBackLibrary}
          title="书架"
        >
          <BookMarked size={14} />
        </button>
        <div className="min-w-0 flex-1 truncate opacity-80">{title || '阅读中'}</div>
        <button
          type="button"
          className="rounded-md p-1 hover:bg-white/10"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => void onPatchSettings({ fontSize: Math.max(12, settings.fontSize - 1) })}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          className="rounded-md p-1 hover:bg-white/10"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => void onPatchSettings({ fontSize: Math.min(36, settings.fontSize + 1) })}
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          className="rounded-md p-1 hover:bg-white/10"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => void window.electronAPI?.hideReader?.()}
        >
          <X size={14} />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-4 py-3 leading-relaxed whitespace-pre-wrap"
        style={{
          WebkitAppRegion: 'no-drag',
          fontSize: settings.fontSize,
          color: settings.fontColor,
          opacity: Math.min(1, settings.opacity + 0.1),
        } as React.CSSProperties}
        onScroll={(e) => {
          persistProgress(chapterIndex, (e.target as HTMLDivElement).scrollTop)
        }}
      >
        {body || '（空章节）'}
      </div>

      <div
        className="flex items-center justify-between border-t border-white/10 px-3 py-1.5 text-[11px] text-zinc-400"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          className="hover:text-zinc-200 disabled:opacity-30"
          disabled={chapterIndex <= 0}
          onClick={() => void loadChapter(chapterIndex - 1)}
        >
          上一章
        </button>
        <span>
          {chapterIndex + 1} / {chapterCount}
        </span>
        <button
          type="button"
          className="hover:text-zinc-200 disabled:opacity-30"
          disabled={chapterIndex + 1 >= chapterCount}
          onClick={() => void loadChapter(chapterIndex + 1)}
        >
          下一章
        </button>
      </div>
    </div>
  )
}
