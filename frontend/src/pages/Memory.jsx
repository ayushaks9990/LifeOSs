import { useEffect, useState } from 'react'
import { Brain, Pin, Plus, Search, Trash2 } from 'lucide-react'
import { api } from '../api'
import { Card, Empty, ErrorNotice, Loading, PageHeader, Pill } from '../components/UI'

export default function Memory() {
  const [items, setItems] = useState([])
  const [content, setContent] = useState('')
  const [tag, setTag] = useState('general')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = (q = query) => api(`/api/memories?q=${encodeURIComponent(q)}`).then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false))
  useEffect(() => { const timer = setTimeout(() => load(query), 250); return () => clearTimeout(timer) }, [query])
  async function add(e) { e.preventDefault(); try { await api('/api/memories', { method: 'POST', body: JSON.stringify({ content, tag }) }); setContent(''); load('') } catch (e) { setError(e.message) } }
  async function remove(id) { await api(`/api/memories/${id}`, { method: 'DELETE' }); load() }
  return <>
    <PageHeader eyebrow="SECOND BRAIN" title="Memory" description="Useful context that stays available to your personal assistant." />
    <ErrorNotice error={error} onClose={() => setError('')} />
    <Card><form className="memory-form" onSubmit={add}><textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Something worth remembering…" required /><div><select value={tag} onChange={e => setTag(e.target.value)}><option>general</option><option>personal</option><option>work</option><option>study</option><option>idea</option></select><button className="primary"><Plus /> Save memory</button></div></form></Card>
    <div className="search-box"><Search /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your memories" /></div>
    {loading ? <Loading /> : items.length ? <div className="memory-grid">{items.map(item => <Card className="memory-card" key={item.id}><div><div className="metric-icon purple"><Brain /></div>{item.pinned && <Pin />}</div><p>{item.content}</p><footer><Pill>{item.tag}</Pill><span>{new Date(item.created_at).toLocaleDateString()}</span><button className="icon-danger" onClick={() => remove(item.id)}><Trash2 /></button></footer></Card>)}</div> : <Card><Empty>No matching memories.</Empty></Card>}
  </>
}

