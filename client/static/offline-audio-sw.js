/**
 * Offline Audio Service Worker
 *
 * Intercepts fetch requests for offline audio files (cached via the Cache Storage API)
 * and serves them directly from the cache. This lets the browser's audio element stream
 * audio from disk-backed cache instead of loading entire files into RAM via blob URLs.
 *
 * CHUNKED FILE SUPPORT: Large files (>50 MB) are stored as multiple separate cache
 * entries (chunks) to avoid crashing mobile browsers. When the audio element requests
 * a chunked file, this service worker transparently streams from the right chunks,
 * including proper Range request handling for seeking.
 */

const CACHE_NAME = 'abs-audio-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only intercept offline audio requests
  if (!url.pathname.startsWith('/offline/items/')) return

  event.respondWith(handleOfflineRequest(event.request, url))
})

async function handleOfflineRequest(request, url) {
  try {
    const cache = await caches.open(CACHE_NAME)

    // 1. Try direct cache match (small/non-chunked files)
    const direct = await cache.match(request)
    if (direct) {
      // If the audio element sent a Range header, handle it from the direct entry
      const rangeHeader = request.headers.get('Range')
      if (rangeHeader && direct.headers.get('Content-Length')) {
        return buildRangeResponseFromSingle(direct, rangeHeader)
      }
      return direct
    }

    // 2. Check for chunked file metadata
    const metaResp = await cache.match(url.pathname + '/_chunkmeta')
    if (!metaResp) {
      return new Response('Not found in offline cache', { status: 404, statusText: 'Not Found' })
    }

    const meta = await metaResp.json()
    const rangeHeader = request.headers.get('Range')

    if (rangeHeader) {
      return handleChunkedRange(cache, url.pathname, meta, rangeHeader)
    } else {
      return handleChunkedFull(cache, url.pathname, meta)
    }
  } catch (e) {
    return new Response('Cache error: ' + e.message, { status: 500, statusText: 'Internal Error' })
  }
}

/**
 * Handle Range request from a single (non-chunked) cached response.
 * The audio element sends Range requests for seeking.
 */
async function buildRangeResponseFromSingle(cachedResponse, rangeHeader) {
  const totalSize = parseInt(cachedResponse.headers.get('Content-Length') || '0', 10)
  if (!totalSize) return cachedResponse

  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
  if (!match) return cachedResponse

  const start = parseInt(match[1], 10)
  const end = match[2] ? parseInt(match[2], 10) : totalSize - 1

  if (start >= totalSize) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${totalSize}` }
    })
  }

  const contentType = cachedResponse.headers.get('Content-Type') || 'audio/mpeg'
  const blob = await cachedResponse.blob()
  const slice = blob.slice(start, end + 1, contentType)

  return new Response(slice, {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  })
}

/**
 * Serve a full chunked file by streaming all chunks sequentially.
 */
function handleChunkedFull(cache, basePath, meta) {
  const { totalSize, totalChunks, contentType } = meta
  let currentChunk = 0

  const stream = new ReadableStream({
    async pull(controller) {
      if (currentChunk >= totalChunks) {
        controller.close()
        return
      }
      const chunkResp = await cache.match(`${basePath}/_chunk_${currentChunk}`)
      if (!chunkResp) {
        controller.error(new Error(`Missing chunk ${currentChunk}`))
        return
      }
      if (chunkResp.body) {
        const reader = chunkResp.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
        }
      } else {
        // Fallback if body streaming not supported
        const buf = await chunkResp.arrayBuffer()
        controller.enqueue(new Uint8Array(buf))
      }
      currentChunk++
    }
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': contentType || 'audio/mpeg',
      'Content-Length': String(totalSize),
      'Accept-Ranges': 'bytes'
    }
  })
}

/**
 * Serve a byte-range from a chunked file.
 * Finds the right chunk(s), skips bytes before the range start,
 * and stops at the range end. This enables seeking in the audio player.
 */
function handleChunkedRange(cache, basePath, meta, rangeHeader) {
  const { totalSize, chunkSize, totalChunks, contentType } = meta

  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
  if (!match) {
    return handleChunkedFull(cache, basePath, meta)
  }

  const start = parseInt(match[1], 10)
  const end = match[2] ? parseInt(match[2], 10) : totalSize - 1
  const clampedEnd = Math.min(end, totalSize - 1)

  if (start >= totalSize) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${totalSize}` }
    })
  }

  const contentLength = clampedEnd - start + 1
  const startChunkIdx = Math.floor(start / chunkSize)
  const endChunkIdx = Math.floor(clampedEnd / chunkSize)

  let currentChunkIdx = startChunkIdx
  let bytesServed = 0

  const stream = new ReadableStream({
    async pull(controller) {
      if (currentChunkIdx > endChunkIdx || bytesServed >= contentLength) {
        controller.close()
        return
      }

      const chunkResp = await cache.match(`${basePath}/_chunk_${currentChunkIdx}`)
      if (!chunkResp) {
        controller.error(new Error(`Missing chunk ${currentChunkIdx}`))
        return
      }

      // Calculate how many bytes to skip at the start of this chunk
      const chunkByteStart = currentChunkIdx * chunkSize
      const skipBytes = currentChunkIdx === startChunkIdx ? (start - chunkByteStart) : 0

      if (chunkResp.body) {
        const reader = chunkResp.body.getReader()
        let skipped = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          let data = value
          let offset = 0

          // Skip leading bytes in the first chunk
          if (skipped < skipBytes) {
            const toSkip = Math.min(skipBytes - skipped, data.byteLength)
            offset = toSkip
            skipped += toSkip
          }

          if (offset >= data.byteLength) {
            continue
          }

          let slice = data.subarray(offset)

          // Trim trailing bytes if we've reached the range end
          const remaining = contentLength - bytesServed
          if (slice.byteLength > remaining) {
            slice = slice.subarray(0, remaining)
          }

          controller.enqueue(slice)
          bytesServed += slice.byteLength

          if (bytesServed >= contentLength) {
            reader.cancel().catch(() => {})
            break
          }
        }
      } else {
        // Fallback if body streaming not supported
        const buf = await chunkResp.arrayBuffer()
        const chunkByteEnd = Math.min(chunkByteStart + buf.byteLength, clampedEnd + 1)
        const sliceStart = skipBytes
        const sliceEnd = Math.min(buf.byteLength, sliceStart + contentLength - bytesServed)
        const slice = new Uint8Array(buf, sliceStart, sliceEnd - sliceStart)
        controller.enqueue(slice)
        bytesServed += slice.byteLength
      }

      currentChunkIdx++
    }
  })

  return new Response(stream, {
    status: 206,
    headers: {
      'Content-Type': contentType || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${clampedEnd}/${totalSize}`,
      'Content-Length': String(contentLength),
      'Accept-Ranges': 'bytes'
    }
  })
}
