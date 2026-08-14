import fs from 'node:fs'
import path from 'node:path'

export type ReaderCacheMeta = {
  catalog: Array<{ title: string; url: string }>
  nextUrl: string | null
  chapterUrl?: string
  chapterUrls?: string[]
}

export function readerCacheDir(userData: string, bookId: string): string {
  return path.join(userData, 'reader-cache', bookId)
}

export function writeChapterCache(
  userData: string,
  bookId: string,
  index: number,
  body: string,
  title: string,
): void {
  const dir = readerCacheDir(userData, bookId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${index}.json`), JSON.stringify({ title, body }), 'utf8')
}

export function readChapterCache(
  userData: string,
  bookId: string,
  index: number,
): { title: string; body: string } | null {
  const file = path.join(readerCacheDir(userData, bookId), `${index}.json`)
  try {
    if (!fs.existsSync(file)) return null
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as { title?: string; body?: string }
    if (typeof raw.body !== 'string') return null
    return { title: typeof raw.title === 'string' ? raw.title : `第${index + 1}章`, body: raw.body }
  } catch {
    return null
  }
}

export function readCacheMeta(userData: string, bookId: string): ReaderCacheMeta | null {
  const file = path.join(readerCacheDir(userData, bookId), 'meta.json')
  try {
    if (!fs.existsSync(file)) return null
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ReaderCacheMeta>
    return {
      catalog: Array.isArray(raw.catalog) ? raw.catalog : [],
      nextUrl: typeof raw.nextUrl === 'string' ? raw.nextUrl : null,
      chapterUrl: typeof raw.chapterUrl === 'string' ? raw.chapterUrl : undefined,
      chapterUrls: Array.isArray(raw.chapterUrls)
        ? raw.chapterUrls.filter((u): u is string => typeof u === 'string')
        : undefined,
    }
  } catch {
    return null
  }
}

export function writeCacheMeta(userData: string, bookId: string, meta: ReaderCacheMeta): void {
  const dir = readerCacheDir(userData, bookId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8')
}

/** Resolve which URL to fetch for a given chapter index from meta + book chapterUrl. */
export function resolveChapterUrl(
  meta: ReaderCacheMeta | null,
  chapterIndex: number,
  bookChapterUrl?: string,
): string | null {
  if (meta?.catalog[chapterIndex]?.url) return meta.catalog[chapterIndex].url
  if (meta?.chapterUrls?.[chapterIndex]) return meta.chapterUrls[chapterIndex]
  if (chapterIndex === 0 && bookChapterUrl) return bookChapterUrl
  if (chapterIndex === 1 && meta?.nextUrl) return meta.nextUrl
  if (
    chapterIndex > 0
    && meta?.chapterUrls
    && chapterIndex === meta.chapterUrls.length
    && meta.nextUrl
  ) {
    return meta.nextUrl
  }
  return null
}
