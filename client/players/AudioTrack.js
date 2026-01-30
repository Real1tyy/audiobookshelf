export default class AudioTrack {
  constructor(track, sessionId, routerBasePath) {
    this.index = track.index || 0
    this.startOffset = track.startOffset || 0 // Total time of all previous tracks
    this.duration = track.duration || 0
    this.title = track.title || ''
    this.contentUrl = track.contentUrl || null
    this.mimeType = track.mimeType
    this.metadata = track.metadata || {}

    this.sessionId = sessionId
    // IMPORTANT:
    // If routerBasePath is '/', prefixing it onto already-absolute paths like '/public/...'
    // produces '//public/...' which the browser treats as a *hostname* ('public') due to
    // protocol-relative URL semantics. Normalize '/' to '' and strip any trailing slashes.
    const rbp = (routerBasePath || '').trim()
    this.routerBasePath = rbp && rbp !== '/' ? rbp.replace(/\/+$/, '') : ''
    if (this.contentUrl?.startsWith('/hls')) {
      this.sessionTrackUrl = this.contentUrl
    } else {
      this.sessionTrackUrl = `/public/session/${sessionId}/track/${this.index}`
    }
  }

  /**
   * Used for CastPlayer
   */
  get fullContentUrl() {
    if (process.env.NODE_ENV === 'development') {
      return `${process.env.serverUrl}${this.sessionTrackUrl}`
    }
    return `${window.location.origin}${this.routerBasePath}${this.sessionTrackUrl}`
  }

  /**
   * Used for LocalPlayer
   */
  get relativeContentUrl() {
    return `${this.routerBasePath}${this.sessionTrackUrl}`
  }
}
