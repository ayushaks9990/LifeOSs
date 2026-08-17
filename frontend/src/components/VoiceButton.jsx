import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'

export default function VoiceButton({ onTranscript, disabled = false, compact = false }) {
  const recognitionRef = useRef(null)
  const [listening, setListening] = useState(false)
  const [supported] = useState(() => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition))

  useEffect(() => () => recognitionRef.current?.abort(), [])

  function toggle() {
    if (!supported || disabled) return
    if (listening) { recognitionRef.current?.stop(); return }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new Recognition()
    recognition.lang = navigator.language || 'en-IN'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = event => {
      setListening(false)
      if (event.error === 'not-allowed') onTranscript('', 'Microphone permission was blocked. Allow it in your browser settings.')
      else if (event.error !== 'no-speech' && event.error !== 'aborted') onTranscript('', `Voice input error: ${event.error}`)
    }
    recognition.onresult = event => {
      const transcript = Array.from(event.results).map(x => x[0].transcript).join(' ').trim()
      if (transcript) onTranscript(transcript)
    }
    recognitionRef.current = recognition
    try { recognition.start() } catch { setListening(false) }
  }

  return <button
    type="button"
    className={`voice-button ${listening ? 'listening' : ''} ${compact ? 'compact' : ''}`}
    onClick={toggle}
    disabled={disabled || !supported}
    title={supported ? (listening ? 'Stop listening' : 'Speak to LifeOS') : 'Voice recognition is not supported in this browser'}
  >
    {listening ? <MicOff /> : <Mic />}
    {!compact && <span>{listening ? 'Listening…' : supported ? 'Speak' : 'Voice unavailable'}</span>}
    {listening && <i className="voice-ring" />}
  </button>
}

export function speak(text) {
  if (!('speechSynthesis' in window) || !text) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text.replace(/[*#•]/g, ' '))
  utterance.lang = navigator.language || 'en-IN'
  utterance.rate = 1.02
  const voices = window.speechSynthesis.getVoices()
  utterance.voice = voices.find(v => v.lang.startsWith('en-IN')) || voices.find(v => v.lang.startsWith('en')) || null
  window.speechSynthesis.speak(utterance)
}

