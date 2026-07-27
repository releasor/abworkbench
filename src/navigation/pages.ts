import type { TranslationKey } from '../i18n'

export const APP_PAGES = ['dashboard', 'taskflow', 'pomodoro', 'habits', 'notes', 'weather', 'settings'] as const

export type Page = typeof APP_PAGES[number]

export const PAGE_TITLE_KEYS: Record<Page, TranslationKey> = {
  dashboard: 'page.dashboard',
  taskflow: 'page.taskflow',
  pomodoro: 'page.pomodoro',
  habits: 'page.habits',
  notes: 'page.notes',
  weather: 'page.weather',
  settings: 'page.settings',
}
