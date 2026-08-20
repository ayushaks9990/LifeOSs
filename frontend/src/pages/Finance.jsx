import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Plus, Trash2, WalletCards } from 'lucide-react'
import { api } from '../api'
import { Card, Empty, ErrorNotice, Loading, PageHeader, Pill } from '../components/UI'

export default function Finance() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ title: '', amount: '', category: 'other', kind: 'expense', currency: 'INR', occurred_on: new Date().toISOString().slice(0, 10) })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = () => api('/api/finance').then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false))
  useEffect(() => {
    // Invoke the async loader without returning its Promise to React.
    void load()
  }, [])
  const totals = useMemo(() => items.reduce((a, x) => ({ ...a, [x.kind]: a[x.kind] + x.amount }), { income: 0, expense: 0 }), [items])
  async function add(e) { e.preventDefault(); try { await api('/api/finance', { method: 'POST', body: JSON.stringify({ ...form, amount: Number(form.amount) }) }); setForm({ ...form, title: '', amount: '' }); load() } catch (e) { setError(e.message) } }
  async function remove(id) { await api(`/api/finance/${id}`, { method: 'DELETE' }); load() }
  return <>
    <PageHeader eyebrow="AWARENESS" title="Personal finance" description="A simple, honest view of money moving in and out." />
    <ErrorNotice error={error} onClose={() => setError('')} />
    <div className="finance-summary"><Card><span><ArrowDownLeft /> Income</span><strong>₹{totals.income.toLocaleString('en-IN')}</strong></Card><Card><span><ArrowUpRight /> Expenses</span><strong>₹{totals.expense.toLocaleString('en-IN')}</strong></Card><Card><span><WalletCards /> Balance</span><strong>₹{(totals.income - totals.expense).toLocaleString('en-IN')}</strong></Card></div>
    <Card><form className="inline-form finance-form" onSubmit={add}><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Description" required /><input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="Amount" required /><select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}><option value="expense">Expense</option><option value="income">Income</option></select><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option>other</option><option>food</option><option>travel</option><option>shopping</option><option>bills</option><option>salary</option></select><input type="date" value={form.occurred_on} onChange={e => setForm({ ...form, occurred_on: e.target.value })} /><button className="primary"><Plus /> Record</button></form></Card>
    <Card className="list-card">{loading ? <Loading /> : items.length ? <div className="item-list">{items.map(item => <div className="list-item" key={item.id}><div className={`money-icon ${item.kind}`}>{item.kind === 'income' ? <ArrowDownLeft /> : <ArrowUpRight />}</div><div className="item-main"><strong>{item.title}</strong><span>{new Date(`${item.occurred_on}T00:00:00`).toLocaleDateString()}</span></div><Pill>{item.category}</Pill><strong className={`money ${item.kind}`}>{item.kind === 'income' ? '+' : '-'} ₹{item.amount.toLocaleString('en-IN')}</strong><button className="icon-danger" onClick={() => remove(item.id)}><Trash2 /></button></div>)}</div> : <Empty>Record an entry or say “I spent 250 on lunch”.</Empty>}</Card>
  </>
}
