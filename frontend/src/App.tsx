import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './i18n/index'
import Home from './pages/Home'
import Company from './pages/Company'
import Scanner from './pages/Scanner'
import Accuracy from './pages/Accuracy'
import Legal from './pages/Legal'

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/company/:symbol" element={<Company />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/accuracy" element={<Accuracy />} />
          <Route path="/legal" element={<Legal />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  )
}
