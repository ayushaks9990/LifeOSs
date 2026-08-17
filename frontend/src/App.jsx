import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Auth from './pages/Auth'
import Assistant from './pages/Assistant'
import Calendar from './pages/Calendar'
import Dashboard from './pages/Dashboard'
import Finance from './pages/Finance'
import Goals from './pages/Goals'
import Integrations from './pages/Integrations'
import Memory from './pages/Memory'
import Tasks from './pages/Tasks'

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loader"><div className="brand-mark">L</div><span>Starting LifeOS…</span></div>
  if (!user) return <Auth />
  return <Routes>
    <Route element={<Layout />}>
      <Route index element={<Dashboard />} />
      <Route path="assistant" element={<Assistant />} />
      <Route path="tasks" element={<Tasks />} />
      <Route path="goals" element={<Goals />} />
      <Route path="calendar" element={<Calendar />} />
      <Route path="finance" element={<Finance />} />
      <Route path="memory" element={<Memory />} />
      <Route path="integrations" element={<Integrations />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>
}

