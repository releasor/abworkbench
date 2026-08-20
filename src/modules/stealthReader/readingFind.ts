/** Case-insensitive substring hits in chapter body (capped). */
export function findTextMatches(body: string, query: string, limit = 200): number[] {
  const q = query.trim()
  if (!q || !body) return []
  const lower = body.toLowerCase()
  const needle = q.toLowerCase()
  const hits: number[] = []
  let from = 0
  while (from < lower.length) {
    const at = lower.indexOf(needle, from)
    if (at < 0) break
    hits.push(at)
    from = at + Math.max(1, needle.length)
    if (hits.length >= limit) break
  }
  return hits
}

export function buildHighlightParts(
  body: string,
  query: string,
  matches: number[],
): Array<{ text: string; hitIndex?: number }> {
  const q = query.trim()
  if (!q || matches.length === 0) return [{ text: body }]
  const parts: Array<{ text: string; hitIndex?: number }> = []
  let cursor = 0
  matches.forEach((at, hitIndex) => {
    if (at > cursor) parts.push({ text: body.slice(cursor, at) })
    parts.push({ text: body.slice(at, at + q.length), hitIndex })
    cursor = at + q.length
  })
  if (cursor < body.length) parts.push({ text: body.slice(cursor) })
  return parts
}
