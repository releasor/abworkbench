import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { en } from './locales/en'
import { zh } from './locales/zh'

export type Locale = 'en' | 'zh'

const locales = { en, zh } as const

export type TranslationKey = keyof typeof en

interface I18nState {
  language: Locale
  setLanguage: (lang: Locale) => void
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: 'zh',
      setLanguage: (lang) => set({ language: lang }),
    }),
    { name: 'abworkbench-i18n' }
  )
)

export function useTranslation() {
  const language = useI18nStore((s) => s.language)

  function t(key: TranslationKey): string {
    const value = locales[language][key]
    if (typeof value === 'function') {
      return (value as (...args: never[]) => string)()
    }
    return value as string
  }

  function tWith(key: TranslationKey, ...args: Array<string | number>): string {
    const value = locales[language][key]
    if (typeof value === 'function') {
      return (value as (...a: Array<string | number>) => string)(...args)
    }
    return value as string
  }

  return { t, tWith, language }
}
