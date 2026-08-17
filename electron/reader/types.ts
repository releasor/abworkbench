export type BookSource = 'local' | 'web'

export interface ReaderBook {
  id: string
  title: string
  source: BookSource
  path?: string
  catalogUrl?: string
  chapterUrl?: string
  pinned?: boolean
  updatedAt: number
}

export interface ReaderProgress {
  bookId: string
  chapterIndex: number
  offset: number
  updatedAt: number
}

export interface ReaderLibraryState {
  books: ReaderBook[]
  /** Last active progress (auto-resume target). */
  progress: ReaderProgress | null
  /** Per-book resume points so switching titles does not wipe others. */
  progressByBook: Record<string, ReaderProgress>
}

export type ReaderOpenRequest = 'auto' | 'library' | 'reading'

export interface ReaderOpenResult {
  mode: 'reading' | 'library'
  bookId?: string
}

export interface ReaderSettings {
  opacity: number
  fontSize: number
  lineHeight: number
  fontColor: string
  bossKey: string
  disguiseEnabled: boolean
  novelDir: string
  windowBounds: { x: number; y: number; width: number; height: number } | null
}

export interface ChapterSlice {
  index: number
  title: string
  body: string
  start: number
  end: number
}
