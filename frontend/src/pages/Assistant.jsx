import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { api, emitAction } from '../api'
import { ErrorNotice, PageHeader } from '../components/UI'
import VoiceButton, { speak, stopSpeaking } from '../components/VoiceButton'

const welcome = { role: 'assistant', content: "I’m ready. Ask me anything, or tell me what to do—plan your day, add a task, remember something, record an expense, check Gmail, or play music.", agent: 'orchestrator' }

export default function Assistant() {
  const [messages, setMessages] = useState([welcome])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const speechSessionRef = useRef(0)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [messages, loading])

  useEffect(() => () => {
    speechSessionRef.current += 1
    stopSpeaking()
  }, [])

  function interruptSpeech() {
    speechSessionRef.current += 1
    stopSpeaking()
    setSpeaking(false)
  }

  function readAnswer(text) {
    interruptSpeech()
    const session = speechSessionRef.current
    const started = speak(text, {
      onStart: () => {
        if (speechSessionRef.current === session) setSpeaking(true)
      },
      onEnd: () => {
        if (speechSessionRef.current === session) setSpeaking(false)
      },
      onError: () => {
        if (speechSessionRef.current === session) {
          setSpeaking(false)
          setError('LifeOS could not play the spoken response in this browser.')
        }
      }
    })
    if (started) setSpeaking(true)
  }

  async function send(text = input, byVoice = false) {
    const message = text.trim()
    if (!message || loading) return
    // Every new command owns the audio channel. Stop the old response before
    // listening to or processing the new request.
    interruptSpeech()
    setInput(''); setError(''); setMessages(x => [...x, { role: 'user', content: message }]); setLoading(true)
    try {
      const response = await api('/api/assistant/chat', { method: 'POST', body: JSON.stringify({ message }) })
      if (!response || typeof response !== 'object' || typeof response.answer !== 'string') {
        throw new Error('LifeOS received an invalid response from the API. Please try again.')
      }
      setMessages(x => [...x, { role: 'assistant', content: response.answer, agent: response.agent || 'LifeOS' }])
      if (response.action) emitAction(response.action)
      if (byVoice) readAnswer(response.answer)
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
          <div><span className="chat-role">{message.role === 'assistant' ? message.agent || 'LifeOS' : 'You'}</span><div className="bubble">{message.content}</div>{message.role === 'assistant' && <button className="speak-again" onClick={() => readAnswer(message.content)}><Volume2 /> Read aloud</button>}</div>
        </div>)}
        {loading && <div className="chat-message assistant"><div className="chat-avatar"><Sparkles /></div><div><span className="chat-role">Routing agent</span><div className="bubble typing"><i /><i /><i /></div></div></div>}
        <div ref={bottomRef} />
      </div>
      <ErrorNotice error={error} onClose={() => setError('')} />
      <form className="composer" onSubmit={e => { e.preventDefault(); send() }}>
        <VoiceButton compact onTranscript={voiceResult} onBeforeListen={interruptSpeech} disabled={loading} />
        {speaking && <button className="interrupt-speech" type="button" onClick={interruptSpeech} title="Stop LifeOS speaking"><VolumeX /><span>Stop</span></button>}
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Ask anything or give LifeOS a command…" rows="1" />
        <button className="send-button" type="submit" disabled={!input.trim() || loading} aria-label={loading ? 'Sending message' : 'Send message'}>
          {loading ? <span className="send-loading" aria-hidden="true" /> : <Send />}
        </button>
      </form>
      <div className="assistant-prompts">{['What is quantum computing?', 'Plan my day', 'Add task to revise DSA tomorrow at 7 PM', 'Play Arijit Singh songs'].map(x => <button key={x} onClick={() => send(x)}>{x}</button>)}</div>
    </div>
  </div>
}
