import { useEffect, useState } from 'react'
import { CalendarSync, Check, Copy, Mail, MessageCircle, Music2, PlugZap, RefreshCw, Sparkles } from 'lucide-react'
import { api } from '../api'
import { Card, ErrorNotice, Loading, PageHeader, Pill } from '../components/UI'

function IntegrationCard({ icon: Icon, name, description, connected, children }) {
  return <Card className="integration-card"><header><div className="integration-icon"><Icon /></div><div><h3>{name}</h3><p>{description}</p></div><Pill tone={connected ? 'connected' : ''}>{connected ? <><Check /> Connected</> : 'Not connected'}</Pill></header>{children && <div className="integration-body">{children}</div>}</Card>
}

export default function Integrations() {
  const [status, setStatus] = useState(null)
  const [summary, setSummary] = useState('')
  const [wa, setWa] = useState({ phone_number_id: '', access_token: '' })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const load = () => api('/api/integrations/status').then(setStatus).catch(e => setError(e.message))
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('integration_error')) setError(params.get('integration_error'))
    load()
  }, [])
  async function googleConnect() { setBusy('google'); setError(''); try { const x = await api('/api/integrations/google/connect'); location.assign(x.authorization_url) } catch (e) { setError(e.message); setBusy('') } }
  async function gmailSummary() { setBusy('gmail'); setError(''); try { setSummary((await api('/api/integrations/gmail/summary')).summary) } catch (e) { setError(e.message) } finally { setBusy('') } }
  async function syncCalendar() { setBusy('calendar'); setError(''); try { const x = await api('/api/integrations/calendar/sync', { method: 'POST' }); setSummary(`Synced ${x.synced} Google Calendar events into LifeOS.`) } catch (e) { setError(e.message) } finally { setBusy('') } }
  async function connectWhatsApp(e) { e.preventDefault(); setBusy('whatsapp'); setError(''); try { await api('/api/integrations/whatsapp/connect', { method: 'POST', body: JSON.stringify(wa) }); setWa({ ...wa, access_token: '' }); load() } catch (e) { setError(e.message) } finally { setBusy('') } }
  async function whatsappSummary() { setBusy('whatsapp-summary'); setError(''); try { setSummary((await api('/api/integrations/whatsapp/summary')).summary) } catch (e) { setError(e.message) } finally { setBusy('') } }
  const webhook = `${location.origin}/api/integrations/whatsapp/webhook`
  if (!status) return <Loading />
  return <>
    <PageHeader eyebrow="CONNECTED LIFE" title="Integrations" description="Connect only the services you trust LifeOS to use." />
    <ErrorNotice error={error} onClose={() => setError('')} />
    <div className="integration-grid">
      <IntegrationCard icon={Mail} name="Google Workspace" description="Read-only Gmail summaries and two-way Calendar access through OAuth." connected={status.google}>
        {!status.google ? <button className="primary" onClick={googleConnect} disabled={busy === 'google'}><PlugZap /> {busy === 'google' ? 'Opening Google…' : 'Connect Google'}</button> : <div className="integration-buttons"><button onClick={gmailSummary} disabled={busy}><Mail /> Summarize inbox</button><button onClick={syncCalendar} disabled={busy}><CalendarSync /> Sync calendar</button></div>}
      </IntegrationCard>
      <IntegrationCard icon={Music2} name="YouTube Music" description="Official Data API search and embedded IFrame playback. No downloads or yt-dlp." connected={status.youtube}>
        <p className="integration-note">{status.youtube ? 'Ready. Say “play” followed by any song or artist.' : 'Add YOUTUBE_API_KEY to the backend environment, then redeploy.'}</p>
      </IntegrationCard>
      <IntegrationCard icon={Sparkles} name="LLM Intelligence" description="Answers general questions and powers summaries and adaptive plans." connected={status.llm}>
        <p className="integration-note">{status.llm ? 'The knowledge and planning agents are online.' : 'Add LLM_API_KEY to the backend environment. Groq and other OpenAI-compatible APIs work.'}</p>
      </IntegrationCard>
      <IntegrationCard icon={MessageCircle} name="WhatsApp Business" description="Receives authorized business messages using Meta Cloud API webhooks." connected={status.whatsapp}>
        <form className="whatsapp-form" onSubmit={connectWhatsApp}><label>Phone number ID<input value={wa.phone_number_id} onChange={e => setWa({ ...wa, phone_number_id: e.target.value })} placeholder="From Meta App Dashboard" required /></label><label>Permanent access token<input type="password" value={wa.access_token} onChange={e => setWa({ ...wa, access_token: e.target.value })} placeholder="Stored encrypted" required /></label><button className="primary" disabled={busy === 'whatsapp'}>{busy === 'whatsapp' ? 'Saving…' : status.whatsapp ? 'Update connection' : 'Connect WhatsApp'}</button></form>
        {status.whatsapp && <div className="integration-buttons whatsapp-summary-button"><button onClick={whatsappSummary} disabled={busy}><MessageCircle /> Summarize messages</button></div>}
        <div className="webhook-box"><span>Callback URL</span><code>{webhook}</code><button onClick={() => navigator.clipboard.writeText(webhook)}><Copy /></button></div>
        <p className="integration-note">Meta requires the backend WHATSAPP_VERIFY_TOKEN and WHATSAPP_APP_SECRET. This supported integration receives messages sent to your Business number; it does not scrape personal WhatsApp history.</p>
      </IntegrationCard>
    </div>
    {summary && <Card className="summary-card"><div><Sparkles /><strong>LifeOS result</strong></div><p>{summary}</p><button onClick={() => setSummary('')}>Close</button></Card>}
  </>
}
