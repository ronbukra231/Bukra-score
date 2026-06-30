import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './i18n/index'
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

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/company/:symbol" element={<Company />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/radar" element={<Radar />} />
          <Route path="/journal" element={<ResearchJournal />} />
          <Route path="/memory" element={<ResearchMemory />} />
          <Route path="/questions" element={<ResearchQuestions />} />
          <Route path="/beliefs" element={<BeliefChanges />} />
          <Route path="/graph" element={<KnowledgeGraph />} />
          <Route path="/brain" element={<MarketBrain />} />
          <Route path="/accuracy" element={<Accuracy />} />
          <Route path="/legal" element={<Legal />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  )
}
