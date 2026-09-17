import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { JournalProvider } from '@/lib/journals'
import Dashboard from '@/pages/Dashboard'
import Trades from '@/pages/Trades'
import TradeDetail from '@/pages/TradeDetail'
import TradeForm from '@/pages/TradeForm'
import CalendarPage from '@/pages/CalendarPage'
import Analytics from '@/pages/Analytics'
import Journal from '@/pages/Journal'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <JournalProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/trades/new" element={<TradeForm />} />
          <Route path="/trades/:id" element={<TradeDetail />} />
          <Route path="/trades/:id/edit" element={<TradeForm />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </JournalProvider>
  )
}
