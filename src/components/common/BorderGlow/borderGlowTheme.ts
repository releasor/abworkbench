import { useEffect, useState } from 'react'
import type { BorderGlowProps } from './BorderGlow'

export type BorderGlowTheme = Pick<
  BorderGlowProps,
  'glowColor' | 'colors' | 'glowIntensity' | 'edgeSensitivity' | 'fillOpacity' | 'glowRadius' | 'coneSpread'
>

const BORDER_GLOW_THEME: BorderGlowTheme = {
  glowColor: '40 80 80',
  colors: ['#c084fc', '#f472b6', '#38bdf8'],
  glowIntensity: 1,
  edgeSensitivity: 30,
  fillOpacity: 0.5,
  glowRadius: 40,
  coneSpread: 25,
}

export function readLightTheme(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.theme === 'light'
    || document.documentElement.classList.contains('abwb-theme-light')
}

export function readSurfaceColor(): string {
  if (typeof document === 'undefined') return '#120F17'
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim()
  return raw || '#120F17'
}

export function getBorderGlowTheme(_themeHint = readLightTheme()): BorderGlowTheme {
  void _themeHint
  return BORDER_GLOW_THEME
}

function themesEqual(a: BorderGlowTheme, b: BorderGlowTheme): boolean {
  return (
    a.glowColor === b.glowColor
    && a.glowIntensity === b.glowIntensity
    && a.edgeSensitivity === b.edgeSensitivity
    && a.fillOpacity === b.fillOpacity
    && a.glowRadius === b.glowRadius
    && a.coneSpread === b.coneSpread
    && a.colors.length === b.colors.length
    && a.colors.every((color, index) => color === b.colors[index])
  )
}

export function useBorderGlowTheme(): BorderGlowTheme {
  const [theme, setTheme] = useState(() => getBorderGlowTheme())

  useEffect(() => {
    const update = () => {
      const next = getBorderGlowTheme()
      setTheme((prev) => (themesEqual(prev, next) ? prev : next))
    }
    update()
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    return () => obs.disconnect()
  }, [])

  return theme
}

export function useBorderGlowSurfaceColor(): string {
  const [color, setColor] = useState(() => readSurfaceColor())

  useEffect(() => {
    const update = () => {
      const next = readSurfaceColor()
      setColor((prev) => (prev === next ? prev : next))
    }
    update()
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    return () => obs.disconnect()
  }, [])

  return color
}
