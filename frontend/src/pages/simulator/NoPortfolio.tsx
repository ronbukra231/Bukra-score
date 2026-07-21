import { Link } from 'react-router-dom'
import { useLanguage } from '../../i18n/index'
import { GOLD, SERIF } from '../../estate/EstateShell'

export default function NoPortfolio() {
  const { t } = useLanguage()
  return (
    <div className="text-center py-20">
      <div className="text-2xl text-stone-300 font-light mb-3" style={{ fontFamily: SERIF }}>
        {t.sim_noPortfolioYet}
      </div>
      <Link to="/simulator/start"
        className="inline-block mt-4 rounded-full px-6 py-2.5 text-sm font-medium"
        style={{ background: GOLD, color: '#1c1410' }}>
        {t.sim_startSimulation}
      </Link>
    </div>
  )
}
