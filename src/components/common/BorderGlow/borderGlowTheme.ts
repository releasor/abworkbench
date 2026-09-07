import { useEffect, useState } from 'react'
import type { BorderGlowProps } from './BorderGlow'

export type BorderGlowTheme = Pick<
  BorderGlowProps,
  'glowColor' | 'colors' | 'glowIntensity' | 'edgeSensitivity' | 'fillOpacity' | 'glowRadius' | 'coneSpread'
>

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

export function getBorderGlowTheme(isLight = readLightTheme()): BorderGlowTheme {
  return isLight
    ? {
        glowColor: '40 80 80',
        colors: ['#c084fc', '#f472b6', '#38bdf8'],
        glowIntensity: 1,
        edgeSensitivity: 30,
        fillOpacity: 0.5,
        glowRadius: 40,
        coneSpread: 25,
      }
    : {
        glowColor: '40 80 80',
        colors: ['#c084fc', '#f472b6', '#38bdf8'],
        glowIntensity: 1,
        edgeSensitivity: 30,
        fillOpacity: 0.5,
        glowRadius: 40,
        coneSpread: 25,
      }
}

export function useBorderGlowTheme(): BorderGlowTheme {
  const [theme, setTheme] = useState(() => getBorderGlowTheme())

  useEffect(() => {
    const update = () => setTheme(getBorderGlowTheme())
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
    const update = () => setColor(readSurfaceColor())
    update()
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    return () => obs.disconnect()
  }, [])

  return color
}
