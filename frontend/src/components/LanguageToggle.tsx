import { useLanguage } from '../i18n/index'

export default function LanguageToggle() {
  const { lang, setLang, t } = useLanguage()
  return (
    <button
      onClick={() => setLang(lang === 'he' ? 'en' : 'he')}
      className="text-xs font-semibold text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-2.5 py-1.5 transition shrink-0"
      title={lang === 'he' ? 'Switch to English' : 'עברית'}
    >
      {t.nav_langToggle}
    </button>
  )
}
