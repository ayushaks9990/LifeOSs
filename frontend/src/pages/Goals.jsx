import { useEffect, useState } from 'react'
import { Plus, Target, Trash2 } from 'lucide-react'
import { api } from '../api'
import { Card, Empty, ErrorNotice, Loading, PageHeader } from '../components/UI'

export default function Goals() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ title: '', target_date: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = () => api('/api/goals').then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false))
  useEffect(() => {
    // Keep the Promise inside the effect so route unmounting has no invalid cleanup.
    void load()
  }, [])
  async function add(e) { e.preventDefault(); try { await api('/api/goals', { method: 'POST', body: JSON.stringify({ ...form, target_date: form.target_date || null }) }); setForm({ title: '', target_date: '' }); load() } catch (e) { setError(e.message) } }
  async function progress(id, value) { setItems(x => x.map(g => g.id === id ? { ...g, progress: Number(value) } : g)); await api(`/api/goals/${id}`, { method: 'PATCH', body: JSON.stringify({ progress: Number(value) }) }) }
  async function remove(id) { await api(`/api/goals/${id}`, { method: 'DELETE' }); load() }
  return <>
    <PageHeader eyebrow="DIRECTION" title="Goals" description="Turn long-range ambitions into visible progress." />
    <ErrorNotice error={error} onClose={() => setError('')} />
    <Card><form className="inline-form" onSubmit={add}><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="A meaningful goal…" required /><input type="date" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} /><button className="primary"><Plus /> Add goal</button></form></Card>
    {loading ? <Loading /> : items.length ? <div className="goals-grid">{items.map(goal => <Card className="goal-card" key={goal.id}><div className="goal-top"><div className="metric-icon cyan"><Target /></div><button className="icon-danger" onClick={() => remove(goal.id)}><Trash2 /></button></div><h3>{goal.title}</h3><p>{goal.target_date ? `Target ${new Date(`${goal.target_date}T00:00:00`).toLocaleDateString()}` : 'No target date'}</p><div className="goal-progress"><span>Progress <b>{goal.progress}%</b></span><input type="range" min="0" max="100" value={goal.progress} onChange={e => progress(goal.id, e.target.value)} /><div><i style={{ width: `${goal.progress}%` }} /></div></div></Card>)}</div> : <Card><Empty>Set your first goal. LifeOS will use it when planning your day.</Empty></Card>}
  </>
}
