/**
 * Parse a timestamp string with keyword support.
 *
 * Supported formats:
 *   - Plain seconds: "120", "3.5"
 *   - MM:SS: "2:30"
 *   - H:MM:SS: "1:02:30"
 *   - Keywords: "start", "end", "now"
 *   - Keyword arithmetic: "start + 5", "end - 10", "now + 30.5"
 *
 * @param {string} str - The timestamp string to parse
 * @param {object} options
 * @param {number} options.totalDuration - Total duration in seconds (used for "end")
 * @param {number} [options.currentTime=0] - Current playback position in seconds (used for "now")
 * @returns {number} Parsed time in seconds, or NaN if invalid
 */
function parseTimestampWithKeywords(str, { totalDuration, currentTime = 0 }) {
  if (typeof str !== 'string') return NaN
  str = str.trim().toLowerCase()
  if (!str) return NaN

  // Keyword map
  const keywords = {
    start: 0,
    end: totalDuration,
    now: currentTime
  }

  // Check for keyword (with optional arithmetic)
  for (const [keyword, baseValue] of Object.entries(keywords)) {
    if (!str.startsWith(keyword)) continue

    const rest = str.slice(keyword.length).trim()

    // Exact keyword match
    if (!rest) return baseValue

    // Keyword + arithmetic: "start + 5", "end - 10", "now + 30.5"
    const match = rest.match(/^([+-])\s*(\d+(?:\.\d+)?)$/)
    if (match) {
      const offset = parseFloat(match[2])
      return match[1] === '+' ? baseValue + offset : baseValue - offset
    }

    // Invalid text after keyword
    return NaN
  }

  // Standard timestamp parsing: H:MM:SS, MM:SS, or plain seconds
  const parts = str.split(':').map(Number)
  if (parts.some(isNaN)) return NaN
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 1) return parts[0]
  return NaN
}

module.exports = { parseTimestampWithKeywords }
