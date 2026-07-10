import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './i18n/index'
import { AuthProvider } from './contexts/AuthContext'
import RouteTracker from './components/RouteTracker'
import Home from './pages/Home'
import Company from './pages/Company'
import Scanner from './pages/Scanner'
import Accuracy from './pages/Accuracy'
import Legal from './pages/Legal'
import Radar from './pages/Radar'
import ResearchJournal from './pages/ResearchJournal'
import ResearchMemory from './pages/ResearchMemory'
import ResearchQuestions from './pages/ResearchQuestions'
import BeliefChanges from './pages/BeliefChanges'
import KnowledgeGraph from './pages/KnowledgeGraph'
import MarketBrain from './pages/MarketBrain'
import MarketIntelligence from './pages/MarketIntelligence'
import AdminGuard from './components/AdminGuard'
import Diagnostics from './pages/Diagnostics'
import Login from './pages/Login'
import CapitalLab from './pages/CapitalLab'
import RequireAuth from './components/RequireAuth'
import EstateHall from './pages/EstateHall'
import ResearchRoom from './pages/ResearchRoom'
import PortfolioOffice from './pages/PortfolioOffice'
import WorldIntelligenceCenter from './pages/WorldIntelligenceCenter'
import EstateLibrary from './pages/EstateLibrary'
import StrategyRoom from './pages/StrategyRoom'

export default function App() {
  return (
    <AuthProvider>
    <LanguageProvider>
      <BrowserRouter>
        {/* Fires page_view + route_load_time on every navigation */}
        <RouteTracker />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/company/:symbol" element={<Company />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/radar" element={<Radar />} />
          <Route path="/journal" element={<AdminGuard><ResearchJournal /></AdminGuard>} />
          <Route path="/memory" element={<AdminGuard><ResearchMemory /></AdminGuard>} />
          <Route path="/questions" element={<AdminGuard><ResearchQuestions /></AdminGuard>} />
          <Route path="/beliefs" element={<AdminGuard><BeliefChanges /></AdminGuard>} />
          <Route path="/graph" element={<AdminGuard><KnowledgeGraph /></AdminGuard>} />
          <Route path="/brain" element={<AdminGuard><MarketBrain /></AdminGuard>} />
          <Route path="/intelligence" element={<AdminGuard><MarketIntelligence /></AdminGuard>} />
          <Route path="/accuracy" element={<Accuracy />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/system-check" element={<Diagnostics />} />
          <Route path="/login" element={<Login />} />
          <Route path="/capital-lab" element={<RequireAuth><CapitalLab /></RequireAuth>} />
          {/* The Research Estate — rooms, not pages */}
          <Route path="/estate" element={<RequireAuth><EstateHall /></RequireAuth>} />
          <Route path="/estate/research" element={<RequireAuth><ResearchRoom /></RequireAuth>} />
          <Route path="/estate/portfolio" element={<RequireAuth><PortfolioOffice /></RequireAuth>} />
          <Route path="/estate/world" element={<RequireAuth><WorldIntelligenceCenter /></RequireAuth>} />
          <Route path="/estate/library" element={<RequireAuth><EstateLibrary /></RequireAuth>} />
          <Route path="/estate/strategy" element={<RequireAuth><StrategyRoom /></RequireAuth>} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
    </AuthProvider>
  )
}
