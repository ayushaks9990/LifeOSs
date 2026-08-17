import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bot, Brain, CalendarDays, CircleDollarSign, Gauge, Goal, LogOut, Menu,
  PlugZap, Sparkles, X, ListTodo
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import MusicDock from './MusicDock'

const nav = [
  ['/', Gauge, 'Overview'],
  ['/assistant', Bot, 'AI Assistant'],
  ['/tasks', ListTodo, 'Tasks'],
  ['/goals', Goal, 'Goals'],
  ['/calendar', CalendarDays, 'Calendar'],
  ['/finance', CircleDollarSign, 'Finance'],
  ['/memory', Brain, 'Memory'],
  ['/integrations', PlugZap, 'Integrations'],
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  function signOut() { logout(); navigate('/') }
  return <div className="shell">
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="side-brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>LifeOS</strong><span>PERSONAL INTELLIGENCE</span></div></div>
      <button className="mobile-close" onClick={() => setOpen(false)}><X /></button>
      <nav>{nav.map(([to, Icon, label]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
      <div className="side-user">
        <div className="avatar">{user.full_name.slice(0, 1).toUpperCase()}</div>
        <div><strong>{user.full_name}</strong><span>{user.email}</span></div>
        <button onClick={signOut} title="Sign out"><LogOut size={17} /></button>
      </div>
    </aside>
    {open && <button className="scrim" onClick={() => setOpen(false)} aria-label="Close menu" />}
    <main className="main">
      <header className="topbar"><button className="menu-button" onClick={() => setOpen(true)}><Menu /></button><span className="status-dot" /> <span>LifeOS online</span><div className="top-spacer" /><span className="top-hint">Say “plan my day”</span></header>
      <div className="content"><Outlet /></div>
    </main>
    <MusicDock />
  </div>
}

