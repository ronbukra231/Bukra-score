import { useState } from 'react'
import { useLanguage } from '../i18n/index'

interface ExplanationData {
  what_does?: string | null
  revenue_streams?: string | null
  why_attractive?: string | null
  risks?: string | null
  eli5?: string | null
  no_api_key?: boolean
  is_fallback?: boolean
  error?: string
}

interface Props {
  explanation: ExplanationData | null
  loading: boolean
  error: string
  englishDescription: string
}

function parseBullets(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean)
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-800 pt-4">
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <h3 className="text-white font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// The 5-section layout, shared by both AI and fallback modes
function ExplanationSections({ explanation, t }: { explanation: ExplanationData; t: any }) {
  return (
    <>
      {explanation.what_does && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span>🏢</span>
            <h3 className="text-white font-semibold text-sm">{t.ai_s_whatDoes}</h3>
          </div>
          <p className="text-gray-300 text-sm leading-7">{explanation.what_does}</p>
        </div>
      )}

      {explanation.revenue_streams && (
        <Section icon="💰" title={t.ai_s_revenue}>
          <ul className="space-y-1.5">
            {parseBullets(explanation.revenue_streams).map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-300 text-sm leading-6">
                <span className="text-brand-400 mt-1 flex-shrink-0">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {explanation.why_attractive && (
        <Section icon="⭐" title={t.ai_s_whyAttractive}>
          <p className="text-gray-300 text-sm leading-7">{explanation.why_attractive}</p>
        </Section>
      )}

      {explanation.risks && (
        <Section icon="⚠️" title={t.ai_s_risks}>
          <p className="text-gray-300 text-sm leading-7">{explanation.risks}</p>
        </Section>
      )}

      {explanation.eli5 && (
        <Section icon="👦" title={t.ai_s_eli5}>
          <div className="bg-brand-600/10 border border-brand-600/25 rounded-xl px-4 py-3 text-brand-200 text-sm leading-7 italic">
            {explanation.eli5}
          </div>
        </Section>
      )}
    </>
  )
}

export default function AIExplanation({ explanation, loading, error, englishDescription }: Props) {
  const { t, isHe } = useLanguage()
  const [showOriginal, setShowOriginal] = useState(false)

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-brand-500 font-bold text-sm">✦ AI</span>
          <h2 className="text-lg font-bold text-white">{t.ai_title}</h2>
        </div>
        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span>{t.ai_loading}</span>
        </div>
        <div className="mt-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-800 rounded animate-pulse" style={{ width: `${70 + i * 8}%` }} />
          ))}
        </div>
      </div>
    )
  }

  // ── Error (no explanation at all) ──────────────────────────────────────────
  if (error && !explanation) {
    return (
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-brand-500 font-bold text-sm">✦ AI</span>
          <h2 className="text-lg font-bold text-white">{t.ai_title}</h2>
        </div>
        <p className="text-gray-500 text-sm">{t.ai_error}</p>
      </div>
    )
  }

  if (!explanation) return null

  const isFallback = explanation.is_fallback

  // ── English mode — always show English description directly ────────────────
  if (!isHe) {
    return (
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-brand-500 font-bold text-sm">✦</span>
          <h2 className="text-lg font-bold text-white">{t.ai_title}</h2>
        </div>
        {englishDescription ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span>🏢</span>
              <h3 className="text-white font-semibold text-sm">{t.ai_s_whatDoes}</h3>
            </div>
            <p className="text-gray-300 text-sm leading-7">{englishDescription}</p>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No description available.</p>
        )}
      </div>
    )
  }

  // ── Hebrew mode, AI-generated (no_api_key = false) ─────────────────────────
  if (!isFallback) {
    return (
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-brand-500 font-bold text-sm">✦ AI</span>
          <h2 className="text-lg font-bold text-white">{t.ai_title}</h2>
        </div>
        <ExplanationSections explanation={explanation} t={t} />
      </div>
    )
  }

  // ── Hebrew mode, template-based fallback (no API key) ─────────────────────
  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
      {/* Header with fallback badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-500 font-bold text-sm">✦</span>
        <h2 className="text-lg font-bold text-white">{t.ai_title}</h2>
        <span className="text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded-full px-2 py-0.5">
          הסבר בסיסי ללא AI
        </span>
      </div>

      {/* All 5 sections — from structured data */}
      <ExplanationSections explanation={explanation} t={t} />

      {/* Collapsible original English description */}
      {englishDescription && (
        <div className="border-t border-gray-800 pt-4">
          <button
            onClick={() => setShowOriginal(s => !s)}
            className="text-gray-500 hover:text-gray-300 text-xs transition flex items-center gap-1"
          >
            {showOriginal ? t.ai_hideOriginal : t.ai_showOriginal}
          </button>
          {showOriginal && (
            <p className="text-gray-500 text-xs leading-6 mt-2">
              {englishDescription}
            </p>
          )}
        </div>
      )}

      {/* Setup note for adding API key */}
      <div className="border-t border-gray-800 pt-3 text-gray-600 text-xs leading-relaxed">
        {t.ai_setupNoteHe}
      </div>
    </div>
  )
}
