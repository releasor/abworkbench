import type { ReaderBook, ReaderLibraryState, ReaderOpenRequest, ReaderOpenResult } from './types'

/** Drop progress when the target book is missing or its local file is gone. */
export function sanitizeProgress(
  state: ReaderLibraryState,
  fileExists: (path: string) => boolean = () => true,
): ReaderLibraryState {
  if (!state.progress) return state
  const book = state.books.find((b) => b.id === state.progress!.bookId)
  if (!book) return { ...state, progress: null }
  if (book.source === 'local') {
    if (!book.path || !fileExists(book.path)) {
      return { ...state, progress: null }
    }
  }
  return state
}

export function isBookReadable(
  book: ReaderBook | undefined | null,
  fileExists: (path: string) => boolean = () => true,
): boolean {
  if (!book) return false
  if (book.source === 'local') return Boolean(book.path && fileExists(book.path))
  // web: readable if we have a chapter URL (cache may still be empty)
  return Boolean(book.chapterUrl || book.catalogUrl)
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

  // auto
  if (valid && id) return { mode: 'reading', bookId: id }
  return { mode: 'library' }
}
