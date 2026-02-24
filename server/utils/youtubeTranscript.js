const Logger = require('../Logger')

const YOUTUBE_URL_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/
]

/**
 * Check if a URL is a YouTube URL
 * @param {string} url
 * @returns {boolean}
 */
function isYouTubeUrl(url) {
  if (!url || typeof url !== 'string') return false
  return YOUTUBE_URL_PATTERNS.some((pattern) => pattern.test(url))
}

/**
 * Extract video ID from a YouTube URL
 * @param {string} url
 * @returns {string|null}
 */
function extractVideoId(url) {
  if (!url || typeof url !== 'string') return null
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

/**
 * Fetch transcript text from a YouTube video URL.
 * Returns the full transcript as a plain text string.
 *
 * @param {string} url - YouTube video URL
 * @returns {Promise<{transcript: string, videoId: string}>}
 */
async function fetchTranscript(url) {
  const videoId = extractVideoId(url)
  if (!videoId) {
    throw new Error('Invalid YouTube URL')
  }

  // youtube-transcript-plus is ESM-only, use dynamic import
  const { fetchTranscript: ytFetch } = await import('youtube-transcript-plus')

  const segments = await ytFetch(videoId)
  if (!segments || !segments.length) {
    throw new Error('No transcript available for this video')
  }

  const transcript = segments.map((s) => s.text).join(' ')
  return { transcript, videoId }
}

module.exports = {
  isYouTubeUrl,
  extractVideoId,
  fetchTranscript
}
