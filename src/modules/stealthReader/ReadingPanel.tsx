import { useCallback, useEffect, useRef, useState } from 'react'
import { BookMarked, Minus, Plus, X } from 'lucide-react'
import type { ReaderUiSettings } from './StealthReaderApp'

interface ReadingPanelProps {
  bookId: string
  settings: ReaderUiSettings
  onError: (msg: string) => void
  onBackLibrary: (message?: string) => void
  onPatchSettings: (partial: Partial<ReaderUiSettings>) => Promise<void>
}

const PERMANENT_FAIL = /不存在|未能提取|不是 HTML|请输入|不支持/

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
  const [hasNext, setHasNext] = useState(true)
  const [loading, setLoading] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadGen = useRef(0)
  const hideChromeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bumpChrome = useCallback(() => {
    setChromeVisible(true)
    if (hideChromeTimer.current) clearTimeout(hideChromeTimer.current)
    hideChromeTimer.current = setTimeout(() => setChromeVisible(false), 2200)
  }, [])

  useEffect(() => {
    queueMicrotask(() => bumpChrome())
    return () => {
      if (hideChromeTimer.current) clearTimeout(hideChromeTimer.current)
    }
  }, [bumpChrome, bookId])

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

  const loadChapter = useCallback(async (
    index: number,
    opts?: { restoreOffset?: number; isInitial?: boolean },
  ) => {
    const gen = ++loadGen.current
    onError('')
    setLoading(true)
    try {
      const result = await window.electronAPI?.readerGetChapter?.(bookId, index)
      if (gen !== loadGen.current) return false

      if (!result) {
        onError('无法读取章节')
        if (opts?.isInitial) onBackLibrary('无法读取章节，已返回书架')
        return false
      }
      if (!result.ok) {
        onError(result.message)
        const permanent = PERMANENT_FAIL.test(result.message)
        if (opts?.isInitial && permanent) {
          // Only clear progress for this dead book, not unrelated books.
          const lib = await window.electronAPI?.readerListBooks?.()
          if (lib?.progress?.bookId === bookId) {
            void window.electronAPI?.readerSetProgress?.(null)
          }
          onBackLibrary(result.message)
        }
        if (!opts?.isInitial && /没有更多章节|未缓存/.test(result.message)) {
          setHasNext(false)
        }
        return false
      }

      setTitle(result.chapter.title)
      setBody(result.chapter.body)
      setChapterIndex(result.chapter.chapterIndex)
      setChapterCount(result.chapter.chapterCount)
      setHasNext(result.chapter.chapterIndex + 1 < result.chapter.chapterCount)

      // Persist chapter index without wiping scroll unless this is a user turn-page.
      if (opts?.restoreOffset == null) {
        persistProgress(result.chapter.chapterIndex, 0)
      } else {
        persistProgress(result.chapter.chapterIndex, opts.restoreOffset)
      }

      requestAnimationFrame(() => {
        if (gen !== loadGen.current || !scrollRef.current) return
        scrollRef.current.scrollTop = opts?.restoreOffset ?? 0
      })
      return true
    } finally {
      if (gen === loadGen.current) setLoading(false)
    }
  }, [bookId, onBackLibrary, onError, persistProgress])

  useEffect(() => {
    loadGen.current += 1
    queueMicrotask(() => {
      void (async () => {
        const lib = await window.electronAPI?.readerListBooks?.()
        const start = lib?.progress?.bookId === bookId ? lib.progress.chapterIndex : 0
        const offset = lib?.progress?.bookId === bookId ? lib.progress.offset : 0
        await loadChapter(start, { isInitial: true, restoreOffset: offset })
      })()
    })
    return () => {
      loadGen.current += 1
    }
  }, [bookId, loadChapter])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (loading) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (chapterIndex > 0) void loadChapter(chapterIndex - 1)
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        if (e.key === ' ' && (e.target as HTMLElement)?.tagName === 'INPUT') return
        e.preventDefault()
        if (hasNext) void loadChapter(chapterIndex + 1)
      } else if (e.key === '+' || e.key === '=') {
        void onPatchSettings({ fontSize: Math.min(36, settings.fontSize + 1) })
      } else if (e.key === '-') {
        void onPatchSettings({ fontSize: Math.max(12, settings.fontSize - 1) })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chapterIndex, hasNext, loadChapter, loading, onPatchSettings, settings.fontSize])

  return (
    <div className="flex h-full flex-col" onMouseMove={bumpChrome}>
      <div
        className={`flex items-center gap-2 border-b border-white/10 px-2 py-1.5 text-xs text-zinc-200 transition-opacity ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <button
          type="button"
          className="rounded-md p-1 hover:bg-white/10"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => onBackLibrary()}
          title="书架"
        >
          <BookMarked size={14} />
        </button>
        <div className="min-w-0 flex-1 truncate opacity-80">{title || (loading ? '加载中…' : '阅读中')}</div>
        <input
          type="range"
          min={20}
          max={100}
          value={Math.round(settings.opacity * 100)}
          title={`透明度 ${Math.round(settings.opacity * 100)}%`}
          className="w-16 accent-sky-400"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onChange={(e) => {
            void onPatchSettings({ opacity: Number(e.target.value) / 100 })
          }}
        />
        <input
          type="color"
          value={settings.fontColor}
          title="字体颜色"
          className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onChange={(e) => {
            void onPatchSettings({ fontColor: e.target.value })
          }}
        />
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
        {body || (loading ? '加载中…' : '（空章节）')}
      </div>

      <div
        className={`flex items-center justify-between border-t border-white/10 px-3 py-1.5 text-[11px] text-zinc-400 transition-opacity ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          className="hover:text-zinc-200 disabled:opacity-30"
          disabled={loading || chapterIndex <= 0}
          onClick={() => void loadChapter(chapterIndex - 1)}
        >
          上一章
        </button>
        <span>
          {chapterIndex + 1} / {Math.max(chapterCount, chapterIndex + 1)}
          {loading ? ' · …' : ''}
        </span>
        <button
          type="button"
          className="hover:text-zinc-200 disabled:opacity-30"
          disabled={loading || !hasNext}
          onClick={() => void loadChapter(chapterIndex + 1)}
        >
          下一章
        </button>
      </div>
    </div>
  )
}
