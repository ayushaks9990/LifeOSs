import { useEffect, useRef, useState } from 'react'
import {
  LoaderCircle,
  Send,
  Sparkles,
  Volume2,
} from 'lucide-react'

import { api, emitAction } from '../api'
import { ErrorNotice, PageHeader } from '../components/UI'
import VoiceButton, { speak } from '../components/VoiceButton'

const welcome = {
  role: 'assistant',
  content:
    'I’m ready. Ask me anything, or tell me what to do—plan your day, add a task, remember something, record an expense, check Gmail, or play music.',
  agent: 'orchestrator',
}

export default function Assistant() {
  const [messages, setMessages] = useState([welcome])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const chatFeedRef = useRef(null)
  const sendingRef = useRef(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const feed = chatFeedRef.current

      if (feed) {
        feed.scrollTop = feed.scrollHeight
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [messages, loading, error])

  async function send(text = input, byVoice = false) {
    const message = typeof text === 'string' ? text.trim() : ''

    if (!message || sendingRef.current) return

    sendingRef.current = true
    setInput('')
    setError('')
    setLoading(true)

    setMessages(currentMessages => [
      ...currentMessages,
      {
        role: 'user',
        content: message,
        agent: 'user',
      },
    ])

    try {
      const response = await api('/api/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({
          message,
        }),
      })

      if (
        !response ||
        typeof response !== 'object' ||
        typeof response.answer !== 'string'
      ) {
        throw new Error(
          'LifeOS received an invalid response from the API. Check the frontend API proxy configuration.'
        )
      }

      const answer = response.answer.trim()

      if (!answer) {
        throw new Error('LifeOS returned an empty answer. Please try again.')
      }

      setMessages(currentMessages => [
        ...currentMessages,
        {
          role: 'assistant',
          content: answer,
          agent:
            typeof response.agent === 'string'
              ? response.agent
              : 'LifeOS',
        },
      ])

      if (
        response.action &&
        typeof response.action === 'object'
      ) {
        emitAction(response.action)
      }

      if (byVoice) {
        speak(answer)
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Something went wrong while contacting LifeOS.'

      setError(message)
    } finally {
      sendingRef.current = false
      setLoading(false)
    }
  }

  function voiceResult(transcript, voiceError) {
    if (voiceError) {
      setError(voiceError)
      return
    }

    if (typeof transcript !== 'string' || !transcript.trim()) {
      setError('I could not understand the voice input. Please try again.')
      return
    }

    setInput(transcript)
    send(transcript, true)
  }

  function handleSubmit(event) {
    event.preventDefault()
    send()
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  return (
    <div className="assistant-page">
      <PageHeader
        eyebrow="MULTI-AGENT ASSISTANT"
        title="Talk to your LifeOS"
        description="Natural language in. Useful action out."
      />

      <div className="assistant-shell">
        <div
          className="chat-feed"
          ref={chatFeedRef}
          aria-live="polite"
        >
          {messages.map((message, index) => {
            const isAssistant = message.role === 'assistant'
            const content =
              typeof message.content === 'string'
                ? message.content
                : ''

            return (
              <div
                className={`chat-message ${message.role}`}
                key={`${message.role}-${index}`}
              >
                <div className="chat-avatar">
                  {isAssistant ? <Sparkles /> : 'Y'}
                </div>

                <div>
                  <span className="chat-role">
                    {isAssistant
                      ? message.agent || 'LifeOS'
                      : 'You'}
                  </span>

                  <div className="bubble">{content}</div>

                  {isAssistant && content && (
                    <button
                      type="button"
                      className="speak-again"
                      onClick={() => speak(content)}
                    >
                      <Volume2 />
                      Read aloud
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {loading && (
            <div className="chat-message assistant">
              <div className="chat-avatar">
                <Sparkles />
              </div>

              <div>
                <span className="chat-role">Routing agent</span>

                <div className="bubble typing">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          )}
        </div>

        <ErrorNotice
          error={error}
          onClose={() => setError('')}
        />

        <form className="composer" onSubmit={handleSubmit}>
          <VoiceButton
            compact
            onTranscript={voiceResult}
            disabled={loading}
          />

          <textarea
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything or give LifeOS a command…"
            rows={1}
            disabled={loading}
          />

          <button
            className="send-button"
            type="submit"
            disabled={!input.trim() || loading}
            aria-label={loading ? 'Sending message' : 'Send message'}
          >
            {loading ? (
              <LoaderCircle className="spin" />
            ) : (
              <Send />
            )}
          </button>
        </form>

        <div className="assistant-prompts">
          {[
            'What is quantum computing?',
            'Plan my day',
            'Add task to revise DSA tomorrow at 7 PM',
            'Play Arijit Singh songs',
          ].map(prompt => (
            <button
              type="button"
              key={prompt}
              disabled={loading}
              onClick={() => send(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
