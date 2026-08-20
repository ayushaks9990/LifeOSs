import { useEffect, useState } from 'react'
import { CalendarPlus, Clock3, Plus, Trash2 } from 'lucide-react'
import { api } from '../api'
import { Card, Empty, ErrorNotice, Loading, PageHeader, Pill } from '../components/UI'

export default function Calendar() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ title: '', starts_at: '', ends_at: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = () => api('/api/calendar').then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false))
  useEffect(() => {
    // Returning load() here would return a Promise, not an effect cleanup function.
    void load()
  }, [])
  async function add(e) { e.preventDefault(); try { await api('/api/calendar', { method: 'POST', body: JSON.stringify({ title: form.title, starts_at: new Date(form.starts_at).toISOString(), ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null }) }); setForm({ title: '', starts_at: '', ends_at: '' }); load() } catch (e) { setError(e.message) } }
  async function remove(id) { await api(`/api/calendar/${id}`, { method: 'DELETE' }); load() }
  return <>
    <PageHeader eyebrow="TIME" title="Calendar & planner" description="See what is ahead and protect time for what matters." />
    <ErrorNotice error={error} onClose={() => setError('')} />
    <Card><form className="inline-form" onSubmit={add}><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Event title" required /><input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} required /><input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /><button className="primary"><Plus /> Schedule</button></form></Card>
    <Card className="timeline-card">{loading ? <Loading /> : items.length ? <div className="timeline">{items.map(item => <div key={item.id}><div className="timeline-date"><b>{new Date(item.starts_at).getDate()}</b><span>{new Date(item.starts_at).toLocaleString('en', { month: 'short' })}</span></div><i /><div className="timeline-event"><Pill tone={item.source === 'google' ? 'cyan' : ''}>{item.source}</Pill><strong>{item.title}</strong><span><Clock3 /> {new Date(item.starts_at).toLocaleString()}</span></div><button className="icon-danger" onClick={() => remove(item.id)}><Trash2 /></button></div>)}</div> : <Empty>Your schedule is clear. Add an event or sync Google Calendar.</Empty>}</Card>
  </>
}
