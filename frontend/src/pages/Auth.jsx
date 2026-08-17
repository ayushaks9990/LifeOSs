import { useState } from 'react'
import { ArrowRight, BrainCircuit, CalendarCheck, Mic2, Music2, ShieldCheck, Sparkles } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { ErrorNotice } from '../components/UI'

export default function Auth() {
  const { acceptAuth } = useAuth()
  const [register, setRegister] = useState(true)
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const update = e => setForm({ ...form, [e.target.name]: e.target.value })
  async function submit(e) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const path = register ? '/api/auth/register' : '/api/auth/login'
      const body = register ? form : { email: form.email, password: form.password }
      acceptAuth(await api(path, { method: 'POST', body: JSON.stringify(body) }))
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  return <main className="auth-page">
    <section className="auth-story">
      <div className="auth-logo"><div className="brand-mark"><Sparkles /></div><span>LifeOS</span></div>
      <div><span className="eyebrow">YOUR LIFE, ONE INTELLIGENCE</span><h1>Think less about managing.<br /><em>Live more.</em></h1><p>A voice-first personal operating system that understands your day, remembers what matters, and turns intent into action.</p></div>
      <div className="feature-row"><span><Mic2 /> Voice native</span><span><BrainCircuit /> Multi-agent</span><span><ShieldCheck /> Private by design</span></div>
      <div className="auth-orbit"><div><CalendarCheck /></div><div><Music2 /></div><div><BrainCircuit /></div><i /></div>
    </section>
    <section className="auth-panel"><form onSubmit={submit}>
      <span className="eyebrow">{register ? 'CREATE YOUR SPACE' : 'WELCOME BACK'}</span>
      <h2>{register ? 'Start your LifeOS' : 'Sign in to LifeOS'}</h2>
      <p>{register ? 'One account. Every part of your digital life.' : 'Your assistant is ready when you are.'}</p>
      <ErrorNotice error={error} onClose={() => setError('')} />
      {register && <label>Full name<input name="full_name" value={form.full_name} onChange={update} placeholder="Ayush Shaw" required minLength="2" /></label>}
      <label>Email address<input type="email" name="email" value={form.email} onChange={update} placeholder="you@example.com" required /></label>
      <label>Password<input type="password" name="password" value={form.password} onChange={update} placeholder="Minimum 8 characters" required minLength="8" /></label>
      <button className="primary wide" disabled={loading}>{loading ? 'Please wait…' : register ? 'Create LifeOS' : 'Sign in'} <ArrowRight size={18} /></button>
      <button type="button" className="auth-switch" onClick={() => { setRegister(x => !x); setError('') }}>{register ? 'Already have an account? Sign in' : 'New to LifeOS? Create an account'}</button>
    </form></section>
  </main>
}

