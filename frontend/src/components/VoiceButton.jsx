import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'

export default function VoiceButton({ onTranscript, onBeforeListen, disabled = false, compact = false }) {
  const recognitionRef = useRef(null)
  const [listening, setListening] = useState(false)
  const [supported] = useState(() => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition))

  useEffect(() => () => recognitionRef.current?.abort(), [])

  function toggle() {
    if (!supported || disabled) return
    if (listening) { recognitionRef.current?.stop(); return }
    // Do not let recognition hear LifeOS reading its previous answer.
    onBeforeListen?.()
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new Recognition()
    let delivered = false
    recognition.lang = navigator.language || 'en-IN'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => setListening(true)
    recognition.onend = () => {
      setListening(false)
      if (recognitionRef.current === recognition) recognitionRef.current = null
    }
    recognition.onerror = event => {
      setListening(false)
      if (event.error === 'not-allowed') onTranscript('', 'Microphone permission was blocked. Allow it in your browser settings.')
      else if (event.error !== 'no-speech' && event.error !== 'aborted') onTranscript('', `Voice input error: ${event.error}`)
    }
    recognition.onresult = event => {
      if (delivered) return
      const transcript = Array.from(event.results).map(x => x[0].transcript).join(' ').trim()
      if (transcript) {
        delivered = true
        onTranscript(transcript)
        try { recognition.stop() } catch { /* recognition already ended */ }
      }
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

let activeUtterance = null
let pendingSpeechTimer = null

export function stopSpeaking() {
  if (pendingSpeechTimer !== null) {
    window.clearTimeout(pendingSpeechTimer)
    pendingSpeechTimer = null
  }
  activeUtterance = null
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export function speak(text, { onStart, onEnd, onError } = {}) {
  if (!('speechSynthesis' in window) || !text) return false

  // Clear the browser queue so an older answer cannot be replayed.
  stopSpeaking()
  const utterance = new SpeechSynthesisUtterance(text.replace(/[*#•]/g, ' '))
  utterance.lang = navigator.language || 'en-IN'
  utterance.rate = 1.02
  const voices = window.speechSynthesis.getVoices()
  utterance.voice = voices.find(v => v.lang.startsWith('en-IN')) || voices.find(v => v.lang.startsWith('en')) || null
  activeUtterance = utterance

  utterance.onstart = () => {
    if (activeUtterance === utterance) onStart?.()
  }
  utterance.onend = () => {
    if (activeUtterance !== utterance) return
    activeUtterance = null
    onEnd?.()
  }
  utterance.onerror = event => {
    if (activeUtterance !== utterance) return
    activeUtterance = null
    if (event.error !== 'canceled' && event.error !== 'interrupted') onError?.(event)
    else onEnd?.()
  }

  // Chrome can retain a cancelled utterance if cancel() and speak() happen in
  // the same event tick. Starting on a fresh tick avoids that stale queue.
  pendingSpeechTimer = window.setTimeout(() => {
    pendingSpeechTimer = null
    if (activeUtterance !== utterance) return
    window.speechSynthesis.resume()
    window.speechSynthesis.speak(utterance)
  }, 40)

  return true
}
