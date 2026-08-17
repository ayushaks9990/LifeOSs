import { useEffect, useState } from 'react'
import { ArrowUpRight, CalendarDays, CheckCircle2, CircleDollarSign, Goal, ListTodo, Mic2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { Card, ErrorNotice, Loading, PageHeader, Pill } from '../components/UI'

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api('/api/dashboard').then(setData).catch(e => setError(e.message)) }, [])
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'
  if (!data && !error) return <Loading />
  return <>
    <PageHeader eyebrow="COMMAND CENTER" title={`${greeting}, ${user.full_name.split(' ')[0]}.`} description="Here’s the shape of your life right now.">
      <Link className="primary" to="/assistant"><Mic2 size={18} /> Talk to LifeOS</Link>
    </PageHeader>
    <ErrorNotice error={error} />
    {data && <>
      <div className="metrics-grid">
        <Card className="metric"><div className="metric-icon purple"><ListTodo /></div><span>Tasks completed</span><strong>{data.task_done}<small> / {data.task_total}</small></strong><div className="mini-progress"><i style={{ width: `${data.task_total ? data.task_done / data.task_total * 100 : 0}%` }} /></div></Card>
        <Card className="metric"><div className="metric-icon cyan"><Goal /></div><span>Goal progress</span><strong>{data.goal_average}<small>%</small></strong><div className="mini-progress cyan"><i style={{ width: `${data.goal_average}%` }} /></div></Card>
        <Card className="metric"><div className="metric-icon green"><CircleDollarSign /></div><span>This month</span><strong>₹{Number(data.monthly_expense).toLocaleString('en-IN')}<small> spent</small></strong><p className="metric-note">₹{Number(data.monthly_income).toLocaleString('en-IN')} income</p></Card>
        <Card className="metric"><div className="metric-icon orange"><CalendarDays /></div><span>Upcoming events</span><strong>{data.upcoming.length}</strong><p className="metric-note">Next 30 days</p></Card>
      </div>
      <Card className="command-card">
        <div className="command-glow" /><div><span className="eyebrow"><Sparkles size={14} /> LIFEOS QUICK START</span><h2>Your day, orchestrated.</h2><p>Ask a question or turn a thought into action using natural speech.</p><div className="prompt-chips"><Link to="/assistant">“Plan my day”</Link><Link to="/assistant">“Play Blinding Lights”</Link><Link to="/assistant">“Remember my interview is Friday”</Link></div></div>
        <Link to="/assistant" className="orb-link"><Mic2 /><i /><span>Start speaking</span></Link>
      </Card>
      <div className="dashboard-columns">
        <Card><div className="card-head"><div><span className="eyebrow">FOCUS</span><h3>Recent tasks</h3></div><Link to="/tasks">View all <ArrowUpRight /></Link></div>
          <div className="compact-list">{data.recent_tasks.length ? data.recent_tasks.map(task => <div key={task.id}><CheckCircle2 className={task.status === 'done' ? 'done-icon' : ''} /><span>{task.title}<small>{task.status}</small></span><Pill tone={task.priority}>{task.priority}</Pill></div>) : <p className="empty">No tasks yet.</p>}</div>
        </Card>
        <Card><div className="card-head"><div><span className="eyebrow">SCHEDULE</span><h3>Coming up</h3></div><Link to="/calendar">Calendar <ArrowUpRight /></Link></div>
          <div className="compact-list events">{data.upcoming.length ? data.upcoming.map(event => <div key={event.id}><b>{new Date(event.starts_at).getDate()}<small>{new Date(event.starts_at).toLocaleString('en', { month: 'short' })}</small></b><span>{event.title}<small>{new Date(event.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></span></div>) : <p className="empty">Your calendar is clear.</p>}</div>
        </Card>
      </div>
    </>}
  </>
}

