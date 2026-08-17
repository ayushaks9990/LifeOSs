import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Music2,
  Pause,
  Play,
  SkipForward,
  Square,
  X,
} from 'lucide-react'

import { api } from '../api'

let youtubePromise = null

function loadYouTubeAPI() {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT)
  }

  if (youtubePromise) {
    return youtubePromise
  }

  youtubePromise = new Promise((resolve, reject) => {
    let completed = false

    const finish = callback => value => {
      if (completed) return
      completed = true
      window.clearTimeout(timeout)
      callback(value)
    }

    const resolveOnce = finish(resolve)
    const rejectOnce = finish(reject)

    const previousCallback =
      window.onYouTubeIframeAPIReady

    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.()

      if (window.YT?.Player) {
        resolveOnce(window.YT)
      } else {
        rejectOnce(
          new Error('YouTube Player API did not initialize.')
        )
      }
    }

    let script = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    )

    if (!script) {
      script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      document.head.appendChild(script)
    }

    script.addEventListener(
      'error',
      () => {
        rejectOnce(
          new Error('Could not load the YouTube Player API.')
        )
      },
      { once: true }
    )

    const timeout = window.setTimeout(() => {
      rejectOnce(
        new Error(
          'YouTube Player took too long to load. Check your internet connection.'
        )
      )
    }, 15000)
  }).catch(error => {
    youtubePromise = null
    throw error
  })

  return youtubePromise
}

function isValidTrack(track) {
  return Boolean(
    track &&
    typeof track === 'object' &&
    typeof track.video_id === 'string' &&
    track.video_id.trim() &&
    typeof track.title === 'string'
  )
}

function Player({
  track,
  playerRef,
  onState,
  onError,
}) {
  const hostRef = useRef(null)
  const latestVideoIdRef = useRef(track.video_id)

  useEffect(() => {
    latestVideoIdRef.current = track.video_id

    if (playerRef.current?.loadVideoById) {
      playerRef.current.loadVideoById(track.video_id)
    }
  }, [track.video_id, playerRef])

  useEffect(() => {
    let cancelled = false

    loadYouTubeAPI()
      .then(YT => {
        if (
          cancelled ||
          !hostRef.current ||
          !YT?.Player
        ) {
          return
        }

        const initialVideoId =
          latestVideoIdRef.current

        playerRef.current = new YT.Player(
          hostRef.current,
          {
            width: '100%',
            height: '210',
            videoId: initialVideoId,

            playerVars: {
              autoplay: 1,
              playsinline: 1,
              rel: 0,
              origin: window.location.origin,
            },

            events: {
              onReady: event => {
                if (cancelled) return

                const latestVideoId =
                  latestVideoIdRef.current

                if (latestVideoId !== initialVideoId) {
                  event.target.loadVideoById(
                    latestVideoId
                  )
                } else {
                  event.target.playVideo()
                }

                onState('playing')
              },

              onStateChange: event => {
                if (cancelled) return

                if (
                  event.data ===
                  YT.PlayerState.PLAYING
                ) {
                  onState('playing')
                }

                if (
                  event.data ===
                  YT.PlayerState.PAUSED
                ) {
                  onState('paused')
                }

                if (
                  event.data ===
                  YT.PlayerState.BUFFERING
                ) {
                  onState('loading')
                }

                if (
                  event.data ===
                  YT.PlayerState.ENDED
                ) {
                  onState('ended')
                }
              },

              onError: event => {
                if (cancelled) return

                onState('error')
                onError(
                  `YouTube could not play this video (error ${event.data}). Try the next song.`
                )
              },
            },
          }
        )
      })
      .catch(error => {
        if (cancelled) return

        onState('error')
        onError(
          error instanceof Error
            ? error.message
            : 'Could not start the YouTube Player.'
        )
      })

    return () => {
      cancelled = true

      try {
        playerRef.current?.destroy?.()
      } catch {
        // The player may already have been removed.
      }

      playerRef.current = null
    }
  }, [onError, onState, playerRef])

  return (
    <div
      ref={hostRef}
      className="youtube-player"
    />
  )
}

export default function MusicDock() {
  const [tracks, setTracks] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(true)
  const [playerState, setPlayerState] =
    useState('paused')

  const playerRef = useRef(null)
  const mountedRef = useRef(true)

  const track =
    Array.isArray(tracks) ? tracks[index] : null

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  async function search(query) {
    const cleanQuery =
      typeof query === 'string' ? query.trim() : ''

    if (!cleanQuery) {
      setError('Tell LifeOS which song or artist to play.')
      return
    }

    setLoading(true)
    setError('')
    setExpanded(true)
    setPlayerState('loading')

    try {
      const result = await api(
        `/api/music/search?q=${encodeURIComponent(
          cleanQuery
        )}`
      )

      if (!Array.isArray(result)) {
        throw new Error(
          'YouTube search returned an invalid response.'
        )
      }

      const validTracks = result.filter(isValidTrack)

      if (!validTracks.length) {
        throw new Error(
          'No playable YouTube videos were found.'
        )
      }

      if (!mountedRef.current) return

      setTracks(validTracks)
      setIndex(0)
      setPlayerState('loading')
    } catch (requestError) {
      if (!mountedRef.current) return

      setTracks([])
      setIndex(0)
      setPlayerState('error')

      setError(
        requestError instanceof Error
          ? requestError.message
          : 'YouTube music search failed.'
      )
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }

  function stopMusic() {
    try {
      playerRef.current?.stopVideo?.()
    } catch {
      // Player may not be ready.
    }

    setTracks([])
    setIndex(0)
    setError('')
    setPlayerState('paused')
  }

  function togglePlayback() {
    try {
      if (playerState === 'playing') {
        playerRef.current?.pauseVideo?.()
      } else {
        playerRef.current?.playVideo?.()
      }
    } catch {
      setError(
        'The YouTube Player is not ready yet.'
      )
    }
  }

  function playNext() {
    if (!tracks.length) return

    setError('')
    setPlayerState('loading')

    setIndex(currentIndex =>
      (currentIndex + 1) % tracks.length
    )
  }

  useEffect(() => {
    const handler = event => {
      const action = event.detail

      if (!action || typeof action !== 'object') {
        return
      }

      if (action.type === 'music_search') {
        search(action.payload?.query || '')
        return
      }

      if (action.type !== 'music_control') {
        return
      }

      const command = action.payload?.command

      try {
        if (command === 'pause') {
          playerRef.current?.pauseVideo?.()
        }

        if (
          command === 'resume' ||
          command === 'continue'
        ) {
          playerRef.current?.playVideo?.()
        }

        if (command === 'stop') {
          stopMusic()
        }
      } catch {
        setError(
          'The YouTube Player is not ready yet.'
        )
      }
    }

    window.addEventListener(
      'lifeos:action',
      handler
    )

    return () => {
      window.removeEventListener(
        'lifeos:action',
        handler
      )
    }
  }, [])

  useEffect(() => {
    if (playerState !== 'ended') return

    setPlayerState('loading')

    setIndex(currentIndex => {
      if (currentIndex < tracks.length - 1) {
        return currentIndex + 1
      }

      return 0
    })
  }, [playerState, tracks.length])

  if (!track && !loading && !error) {
    return null
  }

  return (
    <div
      className={`music-dock ${
        expanded ? 'expanded' : ''
      }`}
    >
      <div className="music-bar">
        <div className="music-icon">
          {loading ||
          playerState === 'loading' ? (
            <LoaderCircle className="spin" />
          ) : (
            <Music2 />
          )}
        </div>

        <div className="music-meta">
          <span>
            {loading
              ? 'Finding your music…'
              : error
                ? 'Music unavailable'
                : track?.title ||
                  'YouTube music'}
          </span>

          <small>
            {error ||
              track?.channel ||
              'Official YouTube playback'}
          </small>
        </div>

        {track && (
          <div className="music-controls">
            <button
              type="button"
              onClick={togglePlayback}
              aria-label={
                playerState === 'playing'
                  ? 'Pause music'
                  : 'Play music'
              }
            >
              {playerState === 'playing' ? (
                <Pause />
              ) : (
                <Play />
              )}
            </button>

            <button
              type="button"
              onClick={playNext}
              aria-label="Play next song"
            >
              <SkipForward />
            </button>

            <button
              type="button"
              onClick={stopMusic}
              aria-label="Stop music"
            >
              <Square />
            </button>
          </div>
        )}

        {track && (
          <button
            type="button"
            className="dock-expand"
            onClick={() =>
              setExpanded(current => !current)
            }
            aria-label={
              expanded
                ? 'Collapse player'
                : 'Expand player'
            }
          >
            {expanded ? (
              <ChevronDown />
            ) : (
              <ChevronUp />
            )}
          </button>
        )}

        {error && (
          <button
            type="button"
            className="dock-expand"
            onClick={() => setError('')}
            aria-label="Close music error"
          >
            <X />
          </button>
        )}
      </div>

      {track && expanded && (
        <div className="music-body">
          <Player
            track={track}
            playerRef={playerRef}
            onState={setPlayerState}
            onError={setError}
          />

          <div className="queue">
            <strong>Up next</strong>

            {tracks.map((item, itemIndex) => (
              <button
                type="button"
                className={
                  itemIndex === index
                    ? 'active'
                    : ''
                }
                key={item.video_id}
                onClick={() => {
                  setError('')
                  setPlayerState('loading')
                  setIndex(itemIndex)
                }}
              >
                {item.thumbnail && (
                  <img
                    src={item.thumbnail}
                    alt=""
                    loading="lazy"
                  />
                )}

                <span>
                  {item.title}
                  <small>{item.channel}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
