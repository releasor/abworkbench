import type { TranslationKey } from '../i18n'

export const APP_PAGES = [
  'dashboard',
  'taskflow',
  'pomodoro',
  'habits',
  'notes',
  'reminders',
  'weather',
  'hotlist',
  'mineradio',
  'settings',
] as const

export type Page = typeof APP_PAGES[number]

export const PAGE_TITLE_KEYS: Record<Page, TranslationKey> = {
  dashboard: 'page.dashboard',
  taskflow: 'page.taskflow',
  pomodoro: 'page.pomodoro',
  habits: 'page.habits',
  notes: 'page.notes',
  reminders: 'page.reminders',
  weather: 'page.weather',
  hotlist: 'page.hotlist',
  mineradio: 'page.mineradio',
  settings: 'page.settings',
}
