import { useSettings, useViewport, useFiles, useAudio, useTheme, useNetwork } from '@mywallpaper/sdk-react'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

// ---------------------------------------------------------------------------
// Settings interface (mirrors manifest.json settings)
// ---------------------------------------------------------------------------

interface MediaViewerSettings {
  // Media Source
  sourceType: 'url' | 'file'
  mediaUrl: string
  mediaFile: unknown

  // Display Options
  objectFit: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  objectPosition: string
  backgroundColor: string
  borderRadius: number

  // Playback Options
  autoplay: boolean
  loop: boolean
  muted: boolean
  volume: number
  showControls: boolean
  playbackRate: number

  // Visual Effects
  opacity: number
  blur: number
  brightness: number
  contrast: number
  saturate: number
  hueRotate: number

  // Advanced
  fallbackText: string
  refreshInterval: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'm4v', 'avi', 'mkv']
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp', 'avif', 'tiff']
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'weba', 'wma']

type MediaType = 'image' | 'video' | 'audio' | 'embed' | 'unknown' | null

interface EmbedPlatformConfig {
  patterns: RegExp[]
  embedUrl: (id: string, opts: EmbedOpts, isVideo?: boolean) => string
}

interface EmbedOpts {
  autoplay: boolean
  muted: boolean
  loop: boolean
}

interface EmbedData {
  platform: string
  embedUrl: string
  videoId: string
}

const EMBED_PLATFORMS: Record<string, EmbedPlatformConfig> = {
  youtube: {
    patterns: [
      /youtube\.com\/watch\?v=([^&]+)/,
      /youtube\.com\/embed\/([^?]+)/,
      /youtu\.be\/([^?]+)/,
      /youtube\.com\/shorts\/([^?]+)/,
    ],
    embedUrl: (id, opts) => {
      const params = new URLSearchParams({
        autoplay: opts.autoplay ? '1' : '0',
        mute: opts.muted ? '1' : '0',
        loop: opts.loop ? '1' : '0',
        rel: '0',
        modestbranding: '1',
        playsinline: '1',
        enablejsapi: '0',
      })
      return `https://www.youtube.com/embed/${id}?${params.toString()}`
    },
  },
  vimeo: {
    patterns: [/vimeo\.com\/(\d+)/],
    embedUrl: (id, opts) =>
      `https://player.vimeo.com/video/${id}?autoplay=${opts.autoplay ? 1 : 0}&muted=${opts.muted ? 1 : 0}&loop=${opts.loop ? 1 : 0}&background=1`,
  },
  twitch: {
    patterns: [/twitch\.tv\/videos\/(\d+)/, /twitch\.tv\/([^/?]+)$/],
    embedUrl: (id, opts, isVideo) => {
      const parent = typeof location !== 'undefined' ? location.hostname : 'localhost'
      return isVideo
        ? `https://player.twitch.tv/?video=${id}&parent=${parent}&autoplay=${opts.autoplay}`
        : `https://player.twitch.tv/?channel=${id}&parent=${parent}&autoplay=${opts.autoplay}&muted=${opts.muted}`
    },
  },
  dailymotion: {
    patterns: [/dailymotion\.com\/video\/([^_?]+)/],
    embedUrl: (id, opts) =>
      `https://www.dailymotion.com/embed/video/${id}?autoplay=${opts.autoplay ? 1 : 0}&mute=${opts.muted ? 1 : 0}`,
  },
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function getMediaType(url: string, mimeType = ''): MediaType {
  if (!url) return null

  if (mimeType) {
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('audio/')) return 'audio'
  }

  if (url.startsWith('data:')) {
    if (url.startsWith('data:video/')) return 'video'
    if (url.startsWith('data:image/')) return 'image'
    if (url.startsWith('data:audio/')) return 'audio'
    return null
  }

  if (url.startsWith('blob:')) return 'unknown'

  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname.toLowerCase()
    const extension = pathname.split('.').pop() || ''

    if (VIDEO_EXTENSIONS.includes(extension)) return 'video'
    if (IMAGE_EXTENSIONS.includes(extension)) return 'image'
    if (AUDIO_EXTENSIONS.includes(extension)) return 'audio'
  } catch {
    const extension = (url.split('.').pop()?.toLowerCase().split('?')[0]) || ''
    if (VIDEO_EXTENSIONS.includes(extension)) return 'video'
    if (IMAGE_EXTENSIONS.includes(extension)) return 'image'
    if (AUDIO_EXTENSIONS.includes(extension)) return 'audio'
  }

  if (
    url.includes('youtube.com') ||
    url.includes('youtu.be') ||
    url.includes('vimeo.com') ||
    url.includes('dailymotion.com')
  ) {
    return null
  }

  return 'unknown'
}

function buildFilterString(settings: MediaViewerSettings): string {
  const filters: string[] = []
  if (settings.blur > 0) filters.push(`blur(${settings.blur}px)`)
  if (settings.brightness !== 100) filters.push(`brightness(${settings.brightness}%)`)
  if (settings.contrast !== 100) filters.push(`contrast(${settings.contrast}%)`)
  if (settings.saturate !== 100) filters.push(`saturate(${settings.saturate}%)`)
  if (settings.hueRotate > 0) filters.push(`hue-rotate(${settings.hueRotate}deg)`)
  return filters.length > 0 ? filters.join(' ') : 'none'
}

function parseEmbedUrl(url: string, settings: MediaViewerSettings): EmbedData | null {
  if (!url) return null

  const opts: EmbedOpts = {
    autoplay: settings.autoplay ?? true,
    muted: settings.muted ?? true,
    loop: settings.loop ?? false,
  }

  for (const [platform, config] of Object.entries(EMBED_PLATFORMS)) {
    for (const pattern of config.patterns) {
      const match = url.match(pattern)
      if (match) {
        const id = match[1]
        const isVideo = platform === 'twitch' && url.includes('/videos/')
        return {
          platform,
          embedUrl: config.embedUrl(id, opts, isVideo),
          videoId: id,
        }
      }
    }
  }

  return null
}

function getMimeForExtension(url: string, type: 'video' | 'audio'): string {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0] || ''
  if (type === 'video') {
    const map: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      ogg: 'video/ogg',
      mov: 'video/quicktime',
      m4v: 'video/mp4',
    }
    return map[ext] || ''
  }
  const map: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    opus: 'audio/opus',
    weba: 'audio/webm',
    wma: 'audio/x-ms-wma',
  }
  return map[ext] || ''
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  container: {
    width: '100%',
    height: '100%',
    position: 'relative' as const,
    overflow: 'hidden' as const,
    transition: 'background-color 0.3s ease, border-radius 0.3s ease',
  },
  mediaWrapper: {
    width: '100%',
    height: '100%',
    overflow: 'hidden' as const,
    position: 'relative' as const,
    zIndex: 1,
  },
  mediaElement: {
    width: '100%',
    height: '100%',
    display: 'block' as const,
    transition: 'opacity 0.3s ease, filter 0.3s ease, border-radius 0.3s ease',
  },
  audioElement: {
    maxWidth: '90%',
    maxHeight: '60px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, rgba(30,30,46,0.9) 0%, rgba(20,20,30,0.95) 100%)',
  },
  embedFrame: {
    width: '100%',
    height: '100%',
    border: 'none',
    background: '#000',
  },
  fallback: (isDark: boolean) => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    background: isDark
      ? 'linear-gradient(135deg, rgba(30,30,46,0.9) 0%, rgba(20,20,30,0.95) 100%)'
      : 'linear-gradient(135deg, rgba(240,240,245,0.95) 0%, rgba(220,220,230,0.98) 100%)',
    color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
    textAlign: 'center' as const,
    padding: '20px',
    transition: 'opacity 0.3s ease',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  }),
  fallbackIcon: {
    width: '64px',
    height: '64px',
    marginBottom: '16px',
    opacity: 0.4,
  },
  fallbackText: {
    fontSize: '14px',
    fontWeight: 500,
    maxWidth: '200px',
    lineHeight: 1.4,
    margin: 0,
  },
  loading: (isDark: boolean) => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  }),
  spinner: (isDark: boolean) => ({
    width: '40px',
    height: '40px',
    border: isDark ? '3px solid rgba(255,255,255,0.2)' : '3px solid rgba(0,0,0,0.1)',
    borderTopColor: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)',
    borderRadius: '50%',
    animation: 'mw-media-spin 0.8s linear infinite',
  }),
}

const KEYFRAMES_CSS = `
@keyframes mw-media-spin {
  to { transform: rotate(360deg); }
}
`

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FallbackIcon() {
  return (
    <div style={styles.fallbackIcon}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '100%', height: '100%' }}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21,15 16,10 5,21" />
      </svg>
    </div>
  )
}

function Spinner({ isDark }: { isDark: boolean }) {
  return (
    <div style={styles.loading(isDark)}>
      <div style={styles.spinner(isDark)} />
    </div>
  )
}

function Fallback({ message, isDark }: { message: string; isDark: boolean }) {
  return (
    <div style={styles.fallback(isDark)}>
      <FallbackIcon />
      <p style={styles.fallbackText}>{message}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MediaViewer() {
  const settings = useSettings<MediaViewerSettings>()
  const { width, height } = useViewport()
  const { request: requestFile, isFileReference } = useFiles()
  const audio = useAudio()
  const theme = useTheme()
  const { fetch: proxyFetch } = useNetwork()

  // Suppress unused-var lint for proxyFetch (available for network permission use)
  void proxyFetch
  void width
  void height

  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<MediaType>(null)
  const [embedData, setEmbedData] = useState<EmbedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const usingParentAudio = useRef(false)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const loadVersionRef = useRef(0)

  const isDark = theme.mode === 'dark'

  // Computed CSS filter string
  const filterString = useMemo(() => buildFilterString(settings), [
    settings.blur,
    settings.brightness,
    settings.contrast,
    settings.saturate,
    settings.hueRotate,
  ])

  // Computed media element style
  const mediaStyle = useMemo(
    () => ({
      ...styles.mediaElement,
      objectFit: settings.objectFit || 'contain',
      objectPosition: settings.objectPosition || 'center',
      opacity: (settings.opacity ?? 100) / 100,
      filter: filterString,
      borderRadius: `${settings.borderRadius || 0}px`,
    }),
    [settings.objectFit, settings.objectPosition, settings.opacity, settings.borderRadius, filterString],
  )

  const containerStyle = useMemo(
    () => ({
      ...styles.container,
      backgroundColor: settings.backgroundColor || 'transparent',
      borderRadius: `${settings.borderRadius || 0}px`,
    }),
    [settings.backgroundColor, settings.borderRadius],
  )

  // -------------------------------------------------------------------
  // Resolve media source and detect type
  // -------------------------------------------------------------------
  const loadMedia = useCallback(async () => {
    const thisVersion = ++loadVersionRef.current

    setLoading(true)
    setError(null)
    setEmbedData(null)
    setMediaUrl(null)
    setMediaType(null)

    // Stop parent audio from previous media
    if (usingParentAudio.current) {
      audio.stop()
      usingParentAudio.current = false
    }

    try {
      let url: string | null = null
      let mimeType = ''

      if (settings.sourceType === 'file') {
        if (isFileReference(settings.mediaFile)) {
          const blobUrl = await requestFile('mediaFile')
          if (thisVersion !== loadVersionRef.current) return
          if (blobUrl) {
            url = blobUrl
          } else {
            setLoading(false)
            setError('No file uploaded')
            return
          }
        } else {
          setLoading(false)
          setError('No file uploaded')
          return
        }
      } else {
        // URL source
        const rawUrl = settings.mediaUrl
        if (!rawUrl || rawUrl.length === 0) {
          setLoading(false)
          setError('No URL configured')
          return
        }

        // Check for data URL with mime
        if (rawUrl.startsWith('data:')) {
          const match = rawUrl.match(/^data:([^;,]+)/)
          if (match) mimeType = match[1]
          if (rawUrl.length < 50) {
            setLoading(false)
            setError('File data is corrupted or too large')
            return
          }
        }

        // Check for embed platforms first
        const embed = parseEmbedUrl(rawUrl, settings)
        if (embed) {
          if (thisVersion !== loadVersionRef.current) return
          setEmbedData(embed)
          setMediaType('embed')
          setMediaUrl(embed.embedUrl)
          setLoading(false)
          return
        }

        url = rawUrl
      }

      if (!url) {
        setLoading(false)
        setError(settings.sourceType === 'file' ? 'No file uploaded' : 'No URL configured')
        return
      }

      if (thisVersion !== loadVersionRef.current) return

      // Detect media type
      const detected = getMediaType(url, mimeType)

      if (detected === null) {
        setLoading(false)
        setError('Unsupported media type')
        return
      }

      // For 'unknown' blob URLs, default to 'image' (the browser will try to render it)
      const resolvedType = detected === 'unknown' ? 'image' : detected

      setMediaUrl(url)
      setMediaType(resolvedType)
      // Loading will be set to false by the media element's onLoad/onLoadedData handlers
    } catch (e) {
      if (thisVersion !== loadVersionRef.current) return
      setLoading(false)
      setError(e instanceof Error ? e.message : 'Failed to load media')
    }
  }, [settings.sourceType, settings.mediaUrl, settings.mediaFile, settings.autoplay, settings.muted, settings.loop, isFileReference, requestFile, audio])

  // -------------------------------------------------------------------
  // Load media on source changes
  // -------------------------------------------------------------------
  useEffect(() => {
    loadMedia()
  }, [loadMedia])

  // -------------------------------------------------------------------
  // Refresh interval
  // -------------------------------------------------------------------
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
    }

    if (settings.refreshInterval > 0 && settings.sourceType === 'url') {
      const intervalMs = settings.refreshInterval * 60 * 1000
      refreshTimerRef.current = setInterval(() => {
        loadMedia()
      }, intervalMs)
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [settings.refreshInterval, settings.sourceType, loadMedia])

  // -------------------------------------------------------------------
  // Video playback settings sync
  // -------------------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.loop = settings.loop
    video.controls = settings.showControls

    if (video.playbackRate !== settings.playbackRate) {
      video.playbackRate = settings.playbackRate
    }

    // Start/stop parent audio for unmuted video
    if (!settings.muted && !usingParentAudio.current) {
      const source = settings.sourceType === 'file' ? 'mediaFile' : settings.mediaUrl
      if (source) {
        audio.play(source)
        audio.setVolume((settings.volume ?? 80) / 100)
        usingParentAudio.current = true
      }
    } else if (settings.muted && usingParentAudio.current) {
      audio.stop()
      usingParentAudio.current = false
    }

    if (usingParentAudio.current) {
      audio.setVolume((settings.volume ?? 80) / 100)
    }

    if (settings.autoplay && video.paused) {
      video.play().catch(() => {})
    } else if (!settings.autoplay && !video.paused) {
      video.pause()
    }
  }, [
    settings.loop,
    settings.showControls,
    settings.playbackRate,
    settings.muted,
    settings.volume,
    settings.autoplay,
    settings.sourceType,
    settings.mediaUrl,
    audio,
  ])

  // -------------------------------------------------------------------
  // Audio element settings sync
  // -------------------------------------------------------------------
  useEffect(() => {
    const audioEl = audioRef.current
    if (!audioEl) return

    audioEl.loop = settings.loop
    audioEl.controls = settings.showControls ?? true
    audioEl.volume = (settings.volume ?? 80) / 100

    if (settings.autoplay && audioEl.paused) {
      audioEl.play().catch(() => {})
    } else if (!settings.autoplay && !audioEl.paused) {
      audioEl.pause()
    }
  }, [settings.loop, settings.showControls, settings.volume, settings.autoplay])

  // -------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (usingParentAudio.current) {
        audio.stop()
        usingParentAudio.current = false
      }
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [audio])

  // -------------------------------------------------------------------
  // Media event handlers
  // -------------------------------------------------------------------
  const handleImageLoad = useCallback(() => {
    setLoading(false)
    setError(null)
  }, [])

  const handleImageError = useCallback(() => {
    setLoading(false)
    setError(settings.fallbackText || 'Media unavailable')
  }, [settings.fallbackText])

  const handleVideoLoaded = useCallback(() => {
    setLoading(false)
    setError(null)
  }, [])

  const handleVideoError = useCallback(() => {
    setLoading(false)
    setError('Failed to load video')
  }, [])

  const handleAudioLoaded = useCallback(() => {
    setLoading(false)
    setError(null)
  }, [])

  const handleAudioError = useCallback(() => {
    setLoading(false)
    setError('Failed to load audio')
  }, [])

  const handleEmbedLoad = useCallback(() => {
    setLoading(false)
    setError(null)
  }, [])

  const handleEmbedError = useCallback(() => {
    setLoading(false)
    setError(embedData ? `Failed to load ${embedData.platform} video` : 'Failed to load embed')
  }, [embedData])

  // Video-audio sync handlers
  const handleVideoPlay = useCallback(() => {
    if (usingParentAudio.current) audio.play(settings.mediaUrl)
  }, [audio, settings.mediaUrl])

  const handleVideoPause = useCallback(() => {
    if (usingParentAudio.current) audio.pause()
  }, [audio])

  const handleVideoEnded = useCallback(() => {
    if (usingParentAudio.current && !settings.loop) audio.stop()
  }, [audio, settings.loop])

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  const renderMedia = () => {
    if (!mediaUrl || !mediaType) return null

    if (mediaType === 'embed') {
      return (
        <iframe
          src={mediaUrl}
          style={{ ...mediaStyle, ...styles.embedFrame }}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={handleEmbedLoad}
          onError={handleEmbedError}
        />
      )
    }

    if (mediaType === 'image') {
      return (
        <img
          src={mediaUrl}
          alt="Media content"
          draggable={false}
          style={mediaStyle}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      )
    }

    if (mediaType === 'video') {
      const isInlineSrc = mediaUrl.startsWith('data:') || mediaUrl.startsWith('blob:')
      const mimeType = !isInlineSrc ? getMimeForExtension(mediaUrl, 'video') : undefined

      return (
        <video
          ref={videoRef}
          style={mediaStyle}
          autoPlay={settings.autoplay}
          loop={settings.loop}
          muted
          controls={settings.showControls}
          playsInline
          preload="auto"
          onLoadedData={handleVideoLoaded}
          onError={handleVideoError}
          onPlay={handleVideoPlay}
          onPause={handleVideoPause}
          onEnded={handleVideoEnded}
        >
          {isInlineSrc ? null : <source src={mediaUrl} type={mimeType || undefined} />}
          {isInlineSrc && <source src={mediaUrl} />}
        </video>
      )
    }

    if (mediaType === 'audio') {
      const isInlineSrc = mediaUrl.startsWith('data:') || mediaUrl.startsWith('blob:')
      const mimeType = !isInlineSrc ? getMimeForExtension(mediaUrl, 'audio') : undefined

      return (
        <audio
          ref={audioRef}
          style={{
            ...mediaStyle,
            ...styles.audioElement,
            display: 'block',
            margin: 'auto',
            position: 'absolute' as const,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          autoPlay={settings.autoplay}
          loop={settings.loop}
          muted={settings.muted}
          controls={settings.showControls ?? true}
          preload="auto"
          onLoadedData={handleAudioLoaded}
          onError={handleAudioError}
        >
          {isInlineSrc ? null : <source src={mediaUrl} type={mimeType || undefined} />}
          {isInlineSrc && <source src={mediaUrl} />}
        </audio>
      )
    }

    return null
  }

  return (
    <>
      <style>{KEYFRAMES_CSS}</style>
      <div style={containerStyle}>
        <div style={styles.mediaWrapper}>{renderMedia()}</div>
        {error && !loading && <Fallback message={error} isDark={isDark} />}
        {loading && <Spinner isDark={isDark} />}
      </div>
    </>
  )
}
