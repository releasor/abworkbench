import type { ReaderBook, ReaderLibraryState, ReaderOpenRequest, ReaderOpenResult, ReaderProgress } from './types'

function mostRecentProgress(map: Record<string, ReaderProgress>): ReaderProgress | null {
  let best: ReaderProgress | null = null
  for (const entry of Object.values(map)) {
    if (!best || entry.updatedAt > best.updatedAt) best = entry
  }
  return best
}

export function isBookReadable(
  book: ReaderBook | undefined | null,
  fileExists: (path: string) => boolean = () => true,
): boolean {
  if (!book) return false
  if (book.source === 'local') return Boolean(book.path && fileExists(book.path))
  return Boolean(book.chapterUrl || book.catalogUrl)
}

/** Drop progress entries when the target book is missing or its local file is gone. */
export function sanitizeProgress(
  state: ReaderLibraryState,
  fileExists: (path: string) => boolean = () => true,
): ReaderLibraryState {
  const progressByBook: Record<string, ReaderProgress> = { ...(state.progressByBook || {}) }
  if (state.progress?.bookId && !progressByBook[state.progress.bookId]) {
    progressByBook[state.progress.bookId] = state.progress
  }

  for (const id of Object.keys(progressByBook)) {
    const book = state.books.find((b) => b.id === id)
    if (!isBookReadable(book, fileExists)) {
      delete progressByBook[id]
    }
  }

  let progress = state.progress
  if (progress && progressByBook[progress.bookId]) {
    progress = progressByBook[progress.bookId]
  } else {
    progress = mostRecentProgress(progressByBook)
  }

  return { ...state, progress, progressByBook }
}

/** Decide whether to open reading or library from launcher request + persisted state. */
export function resolveOpenMode(
  request: ReaderOpenRequest,
  state: ReaderLibraryState,
  fileExists: (path: string) => boolean = () => true,
): ReaderOpenResult {
  if (request === 'library') return { mode: 'library' }

  const cleaned = sanitizeProgress(state, fileExists)
  const id = cleaned.progress?.bookId
  const book = id ? cleaned.books.find((b) => b.id === id) : undefined
  const valid = Boolean(id && isBookReadable(book, fileExists))

  if (request === 'reading') {
    if (valid && id) return { mode: 'reading', bookId: id }
    return { mode: 'library' }
  }

  if (valid && id) return { mode: 'reading', bookId: id }
  return { mode: 'library' }
}
