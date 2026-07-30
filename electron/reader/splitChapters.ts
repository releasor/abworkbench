import type { ChapterSlice } from './types'

const HEADING = /^(?:第[零一二三四五六七八九十百千0-9]+章\s*.*|Chapter\s+\d+\s*.*)$/gim

/** Split novel text into chapters by common heading patterns; else one full-text chapter. */
export function splitChapters(text: string): ChapterSlice[] {
  const matches = [...text.matchAll(HEADING)]
  if (matches.length === 0) {
    return [{ index: 0, title: '全文', body: text, start: 0, end: text.length }]
  }

  const slices: ChapterSlice[] = []
  const first = matches[0]
  const firstIndex = first.index ?? 0

  if (firstIndex > 0) {
    slices.push({
      index: 0,
      title: '前言',
      body: text.slice(0, firstIndex),
      start: 0,
      end: firstIndex,
    })
  }

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const start = m.index!
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length
    const titleLine = m[0].trim()
    const bodyStart = start + m[0].length
    slices.push({
      index: slices.length,
      title: titleLine,
      body: text.slice(bodyStart, end).replace(/^\r?\n/, ''),
      start,
      end,
    })
  }

  return slices
}
