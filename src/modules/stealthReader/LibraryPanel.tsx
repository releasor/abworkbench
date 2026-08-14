import { useCallback, useEffect, useState } from 'react'
import { BookOpen, FolderOpen, Link2, Trash2, X } from 'lucide-react'
import type { ReaderUiSettings } from './StealthReaderApp'

interface BookRow {
  id: string
  title: string
  source: 'local' | 'web'
}

interface LibraryPanelProps {
  settings: ReaderUiSettings
  error: string
  onError: (msg: string) => void
  onOpenBook: (id: string) => void
  onPatchSettings: (partial: Partial<ReaderUiSettings>) => Promise<void>
  onReloadSettings: () => Promise<void>
}

export default function LibraryPanel({
  settings,
  onError,
  onOpenBook,
  onReloadSettings,
}: LibraryPanelProps) {
  const [books, setBooks] = useState<BookRow[]>([])
  const [progressBookId, setProgressBookId] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const lib = await window.electronAPI?.readerListBooks?.()
    if (lib?.books) setBooks(lib.books)
    setProgressBookId(lib?.progress?.bookId ?? null)
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void refresh()
    })
  }, [refresh])

  const pickDir = async () => {
    setBusy(true)
    onError('')
    try {
      const result = await window.electronAPI?.readerPickDirectory?.()
      if (result?.library?.books) setBooks(result.library.books)
      setProgressBookId(result?.library?.progress?.bookId ?? null)
      await onReloadSettings()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (bookId: string, event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    setBusy(true)
    onError('')
    try {
      const lib = await window.electronAPI?.readerRemoveBook?.(bookId)
      if (lib?.books) setBooks(lib.books)
      setProgressBookId(lib?.progress?.bookId ?? null)
    } finally {
      setBusy(false)
    }
  }

  const scrape = async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      onError('请粘贴小说目录页或章节页链接')
      return
    }
    setBusy(true)
    onError('')
    try {
      const result = await window.electronAPI?.readerScrapeUrl?.(trimmed)
      if (!result) {
        onError('桌面能力不可用')
        return
      }
      if (!result.ok) {
        onError(result.message)
        return
      }
      await refresh()
      onOpenBook(result.book.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col text-sm text-zinc-100">
      <div
        className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 font-medium">
          <BookOpen size={16} />
          摸鱼书架
        </div>
        <button
          type="button"
          className="rounded-lg p-1 hover:bg-white/10"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => void window.electronAPI?.hideReader?.()}
          title="隐藏"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3 overflow-auto p-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void pickDir()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10 disabled:opacity-50"
        >
          <FolderOpen size={16} />
          选择小说目录（.txt）
        </button>

        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="粘贴章节/目录 URL"
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs outline-none focus:border-sky-400/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void scrape()
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void scrape()}
            className="rounded-xl border border-sky-400/40 bg-sky-500/20 px-3 py-2 text-xs hover:bg-sky-500/30 disabled:opacity-50"
          >
            <Link2 size={14} className="inline" /> 抓取
          </button>
        </div>

        <div className="text-[11px] text-zinc-400">
          字号 {settings.fontSize} · 透明度 {Math.round(settings.opacity * 100)}%
          {settings.novelDir ? ` · ${settings.novelDir}` : ''}
        </div>

        <div className="space-y-1">
          {books.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/15 px-3 py-8 text-center text-xs text-zinc-400">
              还没有书。选择本地目录或粘贴链接开始。
            </div>
          )}
          {books.map((book) => (
            <div
              key={book.id}
              className="group flex w-full items-center gap-1 rounded-xl border border-transparent hover:border-white/15 hover:bg-white/5"
            >
              <button
                type="button"
                onClick={() => onOpenBook(book.id)}
                className="flex min-w-0 flex-1 items-center justify-between px-3 py-2 text-left"
              >
                <span className="truncate">{book.title}</span>
                <span className="ml-2 flex shrink-0 items-center gap-1 text-[10px] text-zinc-500">
                  {progressBookId === book.id && (
                    <span className="rounded bg-amber-500/25 px-1.5 py-0.5 text-amber-200">续读</span>
                  )}
                  {book.source === 'local' ? '本地' : '网上'}
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                title="移除"
                onClick={(e) => void remove(book.id, e)}
                className="mr-2 rounded-lg p-1.5 text-zinc-500 opacity-0 hover:bg-white/10 hover:text-red-300 group-hover:opacity-100 disabled:opacity-30"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
