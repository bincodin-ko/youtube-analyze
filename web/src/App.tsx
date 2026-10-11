import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import New from './pages/New'
import Library, { CollectionPage, SearchPage } from './pages/Library'
import NotePage from './pages/Note'
import CombinedPage from './pages/Combined'
import { HighlightsPage } from './components/Highlights'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/library" element={<Library />} />
      <Route path="/collection/:id" element={<CollectionPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/new" element={<New />} />
      <Route path="/note/:id" element={<NotePage />} />
      <Route path="/combined/:id" element={<CombinedPage />} />
      <Route path="/highlights" element={<HighlightsPage />} />
    </Routes>
  )
}
