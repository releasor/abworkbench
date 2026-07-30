/** Strip tags and decode a few common entities for novel HTML bodies. */
export function stripTags(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function largestTextBlock(html: string): string {
  const chunks = [...html.matchAll(/<(?:div|p|section)[^>]*>([\s\S]*?)<\/(?:div|p|section)>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((t) => t.length > 80)
  chunks.sort((a, b) => b.length - a.length)
  return chunks[0] ?? stripTags(html)
}

function dedupeByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((i) => {
    if (seen.has(i.url)) return false
    seen.add(i.url)
    return true
  })
}

/** Prefer #content / article, else largest text block. */
export function extractMainText(html: string): string {
  const contentMatch = html.match(/<[^>]+id=["']content["'][^>]*>([\s\S]*?)<\/div>/i)
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  const raw = contentMatch?.[1] ?? articleMatch?.[1] ?? largestTextBlock(html)
  return stripTags(raw).replace(/[ \t]+\n/g, '\n').trim()
}

/** Resolve 「下一章」 style link against baseUrl. */
export function extractNextChapterHref(html: string, baseUrl: string): string | null {
  const m = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*下一[章节回]\s*<\/a>/i)
  if (!m) return null
  try {
    return new URL(m[1], baseUrl).href
  } catch {
    return null
  }
}

/** Collect chapter-like anchor links. */
export function extractChapterLinks(
  html: string,
  baseUrl: string,
): Array<{ title: string; url: string }> {
  const links: Array<{ title: string; url: string }> = []
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const title = stripTags(m[2]).trim()
    if (!/第.+章|Chapter\s*\d+/i.test(title)) continue
    try {
      links.push({ title, url: new URL(m[1], baseUrl).href })
    } catch {
      /* skip */
    }
  }
  return dedupeByUrl(links)
}
