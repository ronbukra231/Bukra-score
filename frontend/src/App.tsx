import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './i18n/index'
import { AuthProvider } from './contexts/AuthContext'
import { UserDataProvider } from './contexts/UserDataContext'
import RouteTracker from './components/RouteTracker'
import AdminGuard from './components/AdminGuard'
import AuthGuard from './components/AuthGuard'
import Home from './pages/Home'
import Company from './pages/Company'
import Scanner from './pages/Scanner'
import Accuracy from './pages/Accuracy'
import Legal from './pages/Legal'
import Radar from './pages/Radar'
import Login from './pages/Login'
import AdminLogin from './pages/AdminLogin'
import Desk from './pages/Desk'
import ResearchJournal from './pages/ResearchJournal'
import ResearchMemory from './pages/ResearchMemory'
import ResearchQuestions from './pages/ResearchQuestions'
import BeliefChanges from './pages/BeliefChanges'
import KnowledgeGraph from './pages/KnowledgeGraph'
import MarketBrain from './pages/MarketBrain'
import MarketIntelligence from './pages/MarketIntelligence'
import Diagnostics from './pages/Diagnostics'

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <UserDataProvider>
        <BrowserRouter>
          <RouteTracker />
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/company/:symbol" element={<Company />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/radar" element={<Radar />} />
            <Route path="/accuracy" element={<Accuracy />} />
            <Route path="/legal" element={<Legal />} />

            {/* Auth */}
            <Route path="/login" element={<Login />} />
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* Authenticated user workspace */}
            <Route path="/desk" element={<AuthGuard><Desk /></AuthGuard>} />

            {/* Admin-only internal intelligence */}
            <Route path="/journal"      element={<AdminGuard><ResearchJournal /></AdminGuard>} />
            <Route path="/memory"       element={<AdminGuard><ResearchMemory /></AdminGuard>} />
            <Route path="/questions"    element={<AdminGuard><ResearchQuestions /></AdminGuard>} />
            <Route path="/beliefs"      element={<AdminGuard><BeliefChanges /></AdminGuard>} />
            <Route path="/graph"        element={<AdminGuard><KnowledgeGraph /></AdminGuard>} />
            <Route path="/brain"        element={<AdminGuard><MarketBrain /></AdminGuard>} />
            <Route path="/intelligence" element={<AdminGuard><MarketIntelligence /></AdminGuard>} />

            {/* System diagnostics — unlisted but public for debugging */}
            <Route path="/system-check" element={<Diagnostics />} />
          </Routes>
        </BrowserRouter>
        </UserDataProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}
