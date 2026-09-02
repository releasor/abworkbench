import { Timer, Target, StickyNote, Cloud, type LucideIcon } from 'lucide-react'
import type { TranslationKey } from '../i18n'
import type { Page } from './pages'

export const HEADER_QUICK_NAV_PAGES = ['pomodoro', 'habits', 'notes', 'weather'] as const satisfies readonly Page[]

export type HeaderQuickNavPage = typeof HEADER_QUICK_NAV_PAGES[number]

export interface HeaderQuickNavItem {
  id: HeaderQuickNavPage
  labelKey: TranslationKey
  icon: LucideIcon
}

export const HEADER_QUICK_NAV_ITEMS: HeaderQuickNavItem[] = [
  { id: 'pomodoro', labelKey: 'page.pomodoro', icon: Timer },
  { id: 'habits', labelKey: 'page.habits', icon: Target },
  { id: 'notes', labelKey: 'page.notes', icon: StickyNote },
  { id: 'weather', labelKey: 'page.weather', icon: Cloud },
]

export function isHeaderQuickNavPage(page: Page): page is HeaderQuickNavPage {
  return (HEADER_QUICK_NAV_PAGES as readonly Page[]).includes(page)
}
