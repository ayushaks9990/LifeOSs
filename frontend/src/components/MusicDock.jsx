import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, LoaderCircle, Music2, Pause, Play, SkipForward, Square, X } from 'lucide-react'
import { api } from '../api'

let youtubePromise
function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (youtubePromise) return youtubePromise
  youtubePromise = new Promise(resolve => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT) }
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(script)
    }
  })
  return youtubePromise
}

function Player({ track, playerRef, onState }) {
  const hostRef = useRef(null)
  const firstTrack = useRef(track)
  useEffect(() => {
    let cancelled = false
    loadYouTubeAPI().then(YT => {
      if (cancelled || !hostRef.current) return
      playerRef.current = new YT.Player(hostRef.current, {
        width: '100%', height: '210', videoId: firstTrack.current.video_id,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: e => { e.target.playVideo(); onState('playing') },
          onStateChange: e => {
            if (e.data === YT.PlayerState.PLAYING) onState('playing')
            if (e.data === YT.PlayerState.PAUSED) onState('paused')
            if (e.data === YT.PlayerState.ENDED) onState('ended')
          },
          onError: () => onState('error')
        }
      })
    })
    return () => { cancelled = true; playerRef.current?.destroy?.(); playerRef.current = null }
  }, [])
  useEffect(() => {
    if (playerRef.current?.loadVideoById && track.video_id !== firstTrack.current.video_id) {
      playerRef.current.loadVideoById(track.video_id)
    }
  }, [track.video_id])
  return <div ref={hostRef} className="youtube-player" />
}

export default function MusicDock() {
  const [tracks, setTracks] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(true)
  const [state, setState] = useState('paused')
  const playerRef = useRef(null)
  const track = tracks[index]

  async function search(query) {
    setLoading(true); setError(''); setExpanded(true)
    try {
      const result = await api(`/api/music/search?q=${encodeURIComponent(query)}`)
      setTracks(result); setIndex(0)
    } catch (e) { setError(e.message); setTracks([]) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    const handler = event => {
      const action = event.detail || {}
      if (action.type === 'music_search') search(action.payload?.query || '')
      if (action.type === 'music_control') {
        const command = action.payload?.command
        if (command === 'pause') playerRef.current?.pauseVideo?.()
        if (command === 'resume') playerRef.current?.playVideo?.()
        if (command === 'stop') { playerRef.current?.stopVideo?.(); setTracks([]) }
      }
    }
    window.addEventListener('lifeos:action', handler)
    return () => window.removeEventListener('lifeos:action', handler)
  }, [])

  useEffect(() => {
    if (state === 'ended' && index < tracks.length - 1) setIndex(x => x + 1)
  }, [state])

  if (!track && !loading && !error) return null
  return <div className={`music-dock ${expanded ? 'expanded' : ''}`}>
    <div className="music-bar">
      <div className="music-icon">{loading ? <LoaderCircle className="spin" /> : <Music2 />}</div>
      <div className="music-meta">
        <span>{loading ? 'Finding your music…' : error ? 'Music unavailable' : track?.title}</span>
        <small>{error || track?.channel || 'Official YouTube playback'}</small>
      </div>
      {track && <div className="music-controls">
        <button onClick={() => state === 'playing' ? playerRef.current?.pauseVideo() : playerRef.current?.playVideo()}>{state === 'playing' ? <Pause /> : <Play />}</button>
        <button onClick={() => setIndex(x => (x + 1) % tracks.length)}><SkipForward /></button>
        <button onClick={() => { playerRef.current?.stopVideo?.(); setTracks([]) }}><Square /></button>
      </div>}
      {track && <button className="dock-expand" onClick={() => setExpanded(x => !x)}>{expanded ? <ChevronDown /> : <ChevronUp />}</button>}
      {error && <button className="dock-expand" onClick={() => setError('')}><X /></button>}
    </div>
    {track && expanded && <div className="music-body">
      <Player track={track} playerRef={playerRef} onState={setState} />
      <div className="queue"><strong>Up next</strong>{tracks.map((x, i) => <button className={i === index ? 'active' : ''} key={x.video_id} onClick={() => setIndex(i)}><img src={x.thumbnail} alt="" /><span>{x.title}<small>{x.channel}</small></span></button>)}</div>
    </div>}
  </div>
}

