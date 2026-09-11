import type { CSSProperties } from 'react'
import type { HotlistItem } from './types.ts'

export type HotlistAccordionPanel = {
  image: string
  label: string
  link: string
  alt: string
}

export type HotlistPalette = {
  base: string
  mid: string
  accent: string
}

const PALETTES: readonly HotlistPalette[] = [
  { base: '#0f172a', mid: '#334155', accent: '#67e8f9' },
  { base: '#1a1025', mid: '#5b21b6', accent: '#c4b5fd' },
  { base: '#0c1a17', mid: '#065f46', accent: '#6ee7b7' },
  { base: '#1c1010', mid: '#9a3412', accent: '#fdba74' },
  { base: '#0b1220', mid: '#1d4ed8', accent: '#93c5fd' },
  { base: '#1a1018', mid: '#9d174d', accent: '#f9a8d4' },
]

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic palette for a platform cover / panel theme. */
export function resolveHotlistPalette(boardId: string, rank: number, title: string): HotlistPalette {
  const seed = hashSeed(`${boardId}:${rank}:${title}`)
  return PALETTES[seed % PALETTES.length]
}

/** CSS custom properties so accordion panels + list content share the cover palette. */
export function hotlistPanelThemeStyle(palette: HotlistPalette): CSSProperties {
  return {
    '--hotlist-base': palette.base,
    '--hotlist-mid': palette.mid,
    '--hotlist-accent': palette.accent,
    '--ag-accent': palette.accent,
    '--ag-overlay': palette.base,
  } as CSSProperties
}

/** Deterministic SVG cover for text-only hotlist rows (no API images). */
export function buildHotlistCover(title: string, rank: number, boardId: string): string {
  const { base: c0, mid: c1, accent } = resolveHotlistPalette(boardId, rank, title)
  const safeTitle = title.replace(/[<>&"']/g, '').slice(0, 28)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c0}"/>
      <stop offset="55%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect width="900" height="1200" fill="url(#g)"/>
  <circle cx="720" cy="180" r="160" fill="${accent}" fill-opacity="0.18"/>
  <circle cx="160" cy="980" r="220" fill="${accent}" fill-opacity="0.12"/>
  <text x="72" y="160" fill="${accent}" font-family="Segoe UI, system-ui, sans-serif" font-size="92" font-weight="800">${rank}</text>
  <text x="72" y="1080" fill="#ffffff" fill-opacity="0.88" font-family="Segoe UI, system-ui, sans-serif" font-size="42" font-weight="600">${escapeXml(safeTitle)}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function mapHotlistItemsToAccordion(
  items: HotlistItem[],
  boardId: string,
  limit = 6,
): HotlistAccordionPanel[] {
  return items.slice(0, limit).map((item) => {
    const label = item.hot ? `${item.rank}. ${item.title} · ${item.hot}` : `${item.rank}. ${item.title}`
    return {
      image: buildHotlistCover(item.title, item.rank, boardId),
      label,
      link: item.url,
      alt: item.title,
    }
  })
}
