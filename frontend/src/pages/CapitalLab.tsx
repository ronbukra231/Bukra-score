import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const STRATEGY_CARDS = [
  { icon: '⭐', name: 'מדד איכות',    desc: 'חברות עם רווחיות גבוהה, חוב נמוך וצמיחה עקבית' },
  { icon: '🤖', name: 'מדד AI',       desc: 'חברות מובילות בתחום הבינה המלאכותית' },
  { icon: '💎', name: 'מדד דיבידנדים', desc: 'חברות עם היסטוריית דיבידנד ארוכה ויציבה' },
  { icon: '🚀', name: 'מדד צמיחה',   desc: 'חברות עם קצב צמיחה שנתי גבוה ברווח ובהכנסות' },
]

export default function CapitalLab() {
  const { isAuthenticated } = useAuth()

  return (
    <div
      dir="rtl"
      className="min-h-screen text-white"
      style={{ background: 'linear-gradient(160deg, #0a0e1a 0%, #0d1117 50%, #0a0c14 100%)' }}
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <Link
          to="/"
          className="text-xs text-amber-400/70 hover:text-amber-300 transition flex items-center gap-1.5"
        >
          ← ציון בוקרא
        </Link>
        {!isAuthenticated && (
          <Link
            to="/login"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition"
          >
            התחבר
          </Link>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 py-14 space-y-16">

        {/* ── Hero ── */}
        <div className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/25 bg-amber-500/5 text-amber-400 text-xs font-semibold tracking-widest uppercase mb-2">
            Capital Lab
          </div>
          <h1
            className="text-4xl md:text-5xl font-black tracking-tight"
            style={{ background: 'linear-gradient(135deg, #f5e6c8 0%, #d4a847 60%, #a07830 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            מעבדת ההשקעות שלך
          </h1>
          <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            בנה מדדים, חקור חברות, וגלה את פילוסופיית ההשקעה שלך
          </p>
        </div>

        {/* ── My Indexes ── */}
        <section className="space-y-5">
          <SectionHeader
            label="המדדים שלי"
            sub="מדדים מותאמים אישית שיצרת"
          />
          <div
            className="rounded-2xl border border-white/5 p-10 text-center space-y-4"
            style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}
          >
            <div className="text-4xl opacity-30">📂</div>
            <p className="text-gray-500 text-sm">עדיין לא יצרת מדד</p>
            <button
              type="button"
              disabled
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-amber-500/30 text-amber-400/60 cursor-not-allowed"
              title="Coming soon"
            >
              <span>+</span> צור מדד חדש
            </button>
            <p className="text-gray-600 text-xs pt-1">בקרוב</p>
          </div>
        </section>

        {/* ── Trait Search ── */}
        <section className="space-y-5">
          <SectionHeader
            label="חיפוש לפי תכונות"
            sub="תאר בשפה חופשית מה אתה מחפש — המערכת תמצא"
          />
          <div
            className="rounded-2xl border border-white/5 p-6 space-y-3"
            style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}
          >
            <div className="relative">
              <input
                type="text"
                disabled
                placeholder='לדוגמה: מצא לי חברות ששומרות על 40% רווח נקי'
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-gray-400 placeholder-gray-600 cursor-not-allowed focus:outline-none"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-xs">בקרוב</span>
            </div>
            <p className="text-gray-600 text-xs px-1">
              חיפוש סמנטי לפי מאפיינים פיננסיים — בפיתוח
            </p>
          </div>
        </section>

        {/* ── Strategy Lab ── */}
        <section className="space-y-5">
          <SectionHeader
            label="מעבדת אסטרטגיות"
            sub="תבניות מדדים מוכנות לשימוש — בקרוב"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {STRATEGY_CARDS.map(card => (
              <StrategyCard key={card.name} {...card} />
            ))}
          </div>
        </section>

        {/* ── Footer note ── */}
        <p className="text-center text-gray-700 text-xs pb-4">
          Capital Lab נבנית בהדרגה — כל תכונה מאומתת לפני הפצה
        </p>
      </div>
    </div>
  )
}

function SectionHeader({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex items-end gap-3">
      <div>
        <h2 className="text-lg font-bold text-white">{label}</h2>
        <p className="text-gray-500 text-xs mt-0.5">{sub}</p>
      </div>
      <div className="flex-1 h-px mb-1" style={{ background: 'linear-gradient(90deg, rgba(212,168,71,0.2) 0%, transparent 100%)' }} />
    </div>
  )
}

function StrategyCard({ icon, name, desc }: { icon: string; name: string; desc: string }) {
  return (
    <div
      className="rounded-2xl border p-5 space-y-2 relative overflow-hidden group"
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
        borderColor: 'rgba(212,168,71,0.12)',
      }}
    >
      {/* Subtle amber glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ background: 'radial-gradient(ellipse at top right, rgba(212,168,71,0.06) 0%, transparent 70%)' }}
      />
      <div className="text-2xl">{icon}</div>
      <div>
        <p className="text-sm font-bold text-white">{name}</p>
        <p className="text-gray-500 text-xs mt-1 leading-relaxed">{desc}</p>
      </div>
      <span className="inline-block text-xs px-2 py-0.5 rounded-full border border-amber-500/20 text-amber-500/60 mt-1">
        בקרוב
      </span>
    </div>
  )
}
