import { useEffect, useState } from 'react'
import { Check, Circle, Plus, Trash2 } from 'lucide-react'
import { api } from '../api'
import { Card, Empty, ErrorNotice, Loading, PageHeader, Pill } from '../components/UI'

export default function Tasks() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ title: '', priority: 'medium', due_at: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = () => api('/api/tasks').then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false))
  useEffect(load, [])
  async function add(e) {
    e.preventDefault(); setError('')
    try {
      await api('/api/tasks', { method: 'POST', body: JSON.stringify({ ...form, due_at: form.due_at ? new Date(form.due_at).toISOString() : null }) })
      setForm({ title: '', priority: 'medium', due_at: '' }); load()
    } catch (e) { setError(e.message) }
  }
  async function toggle(item) { await api(`/api/tasks/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: item.status === 'done' ? 'todo' : 'done' }) }); load() }
  async function remove(id) { await api(`/api/tasks/${id}`, { method: 'DELETE' }); load() }
  return <>
    <PageHeader eyebrow="EXECUTION" title="Tasks" description="Capture what matters, then get it done." />
    <ErrorNotice error={error} onClose={() => setError('')} />
    <Card><form className="inline-form task-form" onSubmit={add}><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?" required /><select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option></select><input type="datetime-local" value={form.due_at} onChange={e => setForm({ ...form, due_at: e.target.value })} /><button className="primary"><Plus /> Add task</button></form></Card>
    <Card className="list-card">{loading ? <Loading /> : items.length ? <div className="item-list">{items.map(item => <div className={`list-item ${item.status === 'done' ? 'completed' : ''}`} key={item.id}><button className="check-button" onClick={() => toggle(item)}>{item.status === 'done' ? <Check /> : <Circle />}</button><div className="item-main"><strong>{item.title}</strong><span>{item.due_at ? new Date(item.due_at).toLocaleString() : 'No deadline'}</span></div><Pill tone={item.priority}>{item.priority}</Pill><button className="icon-danger" onClick={() => remove(item.id)}><Trash2 /></button></div>)}</div> : <Empty>Add your first task—or say “add task to…” in the assistant.</Empty>}</Card>
  </>
}

