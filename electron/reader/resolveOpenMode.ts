import type { ReaderLibraryState, ReaderOpenRequest, ReaderOpenResult } from './types'

/** Decide whether to open reading or library from launcher request + persisted state. */
export function resolveOpenMode(
  request: ReaderOpenRequest,
  state: ReaderLibraryState,
): ReaderOpenResult {
  if (request === 'library') return { mode: 'library' }

  const id = state.progress?.bookId
  const valid = Boolean(id && state.books.some((b) => b.id === id))

  if (request === 'reading') {
    if (valid && id) return { mode: 'reading', bookId: id }
    return { mode: 'library' }
  }

  // auto
  if (valid && id) return { mode: 'reading', bookId: id }
  return { mode: 'library' }
}
