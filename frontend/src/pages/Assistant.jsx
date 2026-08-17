import { useEffect, useRef, useState } from 'react'
import { Bot, Send, Sparkles, StopCircle, Volume2 } from 'lucide-react'
import { api, emitAction } from '../api'
import { ErrorNotice, PageHeader } from '../components/UI'
import VoiceButton, { speak } from '../components/VoiceButton'

const welcome = { role: 'assistant', content: "I’m ready. Ask me anything, or tell me what to do—plan your day, add a task, remember something, record an expense, check Gmail, or play music.", agent: 'orchestrator' }

export default function Assistant() {
  const [messages, setMessages] = useState([welcome])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, loading])

  async function send(text = input, byVoice = false) {
    const message = text.trim()
    if (!message || loading) return
    setInput(''); setError(''); setMessages(x => [...x, { role: 'user', content: message }]); setLoading(true)
    try {
      const response = await api('/api/assistant/chat', { method: 'POST', body: JSON.stringify({ message }) })
      setMessages(x => [...x, { role: 'assistant', content: response.answer, agent: response.agent }])
      if (response.action) emitAction(response.action)
      if (byVoice) speak(response.answer)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  function voiceResult(transcript, voiceError) {
    if (voiceError) { setError(voiceError); return }
    setInput(transcript)
    send(transcript, true)
  }

  return <div className="assistant-page">
    <PageHeader eyebrow="MULTI-AGENT ASSISTANT" title="Talk to your LifeOS" description="Natural language in. Useful action out." />
    <div className="assistant-shell">
      <div className="chat-feed">
        {messages.map((message, index) => <div className={`chat-message ${message.role}`} key={index}>
          <div className="chat-avatar">{message.role === 'assistant' ? <Sparkles /> : 'Y'}</div>
          <div><span className="chat-role">{message.role === 'assistant' ? message.agent || 'LifeOS' : 'You'}</span><div className="bubble">{message.content}</div>{message.role === 'assistant' && <button className="speak-again" onClick={() => speak(message.content)}><Volume2 /> Read aloud</button>}</div>
        </div>)}
        {loading && <div className="chat-message assistant"><div className="chat-avatar"><Sparkles /></div><div><span className="chat-role">Routing agent</span><div className="bubble typing"><i /><i /><i /></div></div></div>}
        <div ref={bottomRef} />
      </div>
      <ErrorNotice error={error} onClose={() => setError('')} />
      <form className="composer" onSubmit={e => { e.preventDefault(); send() }}>
        <VoiceButton compact onTranscript={voiceResult} disabled={loading} />
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Ask anything or give LifeOS a command…" rows="1" />
        <button className="send-button" disabled={!input.trim() || loading}>{loading ? <StopCircle /> : <Send />}</button>
      </form>
      <div className="assistant-prompts">{['What is quantum computing?', 'Plan my day', 'Add task to revise DSA tomorrow at 7 PM', 'Play Arijit Singh songs'].map(x => <button key={x} onClick={() => send(x)}>{x}</button>)}</div>
    </div>
  </div>
}

