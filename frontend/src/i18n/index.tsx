import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { Lang, Translations } from './types'
import he from './he'
import en from './en'

const DICT: Record<Lang, Translations> = { he, en }
const STORAGE_KEY = 'bukra_lang'

/** Active language for non-React code (API client). Same source as the provider. */
export function getActiveLang(): Lang {
  return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'he'
}

// ── Context ───────────────────────────────────────────────────────────────────

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: Translations
  isHe: boolean
}

const LanguageContext = createContext<LangCtx>({
  lang: 'he',
  setLang: () => {},
  t: he,
  isHe: true,
})

// ── Provider ──────────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null
    return stored === 'en' ? 'en' : 'he'
  })

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }

  // Sync <html dir> and <html lang>
  useEffect(() => {
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: DICT[lang], isHe: lang === 'he' }}>
      {children}
    </LanguageContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLanguage(): LangCtx {
  return useContext(LanguageContext)
}
