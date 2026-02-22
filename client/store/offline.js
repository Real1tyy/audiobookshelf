const CACHE_NAME = 'abs-audio-v1'
const STORAGE_KEY = 'abs-offline-items'
const QUEUE_KEY = 'abs-download-queue'
const CHUNK_PROGRESS_KEY = 'abs-chunk-progress'
const GC_DELAY_MS = 3000
const MIN_FREE_BYTES = 200 * 1024 * 1024 // 200 MB
const PROGRESS_THROTTLE_MS = 750
const CHUNK_SIZE = 50 * 1024 * 1024 // 50 MB — each chunk is saved separately so a crash only loses one chunk

// AbortControllers keyed by itemId — outside Vue reactivity
const abortControllers = {}

// ── Chunk progress tracking (localStorage) ──
// Tracks which chunks of a large file have been successfully cached.
// On crash/refresh, we read this to skip already-completed chunks.

function _loadAllChunkProgress() {
  try {
    const raw = localStorage.getItem(CHUNK_PROGRESS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function _saveAllChunkProgress(data) {
  try {
    localStorage.setItem(CHUNK_PROGRESS_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('[Offline] Failed to save chunk progress', e)
  }
}

function _getFileChunkProgress(itemId, ino) {
  const all = _loadAllChunkProgress()
  return all[`${itemId}:${ino}`] || null
}

function _setFileChunkProgress(itemId, ino, progress) {
  const all = _loadAllChunkProgress()
  all[`${itemId}:${ino}`] = progress
  _saveAllChunkProgress(all)
}

function _clearFileChunkProgress(itemId, ino) {
  const all = _loadAllChunkProgress()
  delete all[`${itemId}:${ino}`]
  _saveAllChunkProgress(all)
}

/**
 * Assemble separately cached chunks into a single final cache entry using streaming.
 * Reads each chunk sequentially from Cache Storage and pipes into a new Response,
 * so we never hold the full file in JS memory.
 */
async function _assembleChunks(cache, cacheKey, contentType, totalSize, totalChunks) {
  const supportsRS = typeof ReadableStream === 'function'

  if (supportsRS) {
    let currentChunk = 0
    const assemblyStream = new ReadableStream({
      async pull(controller) {
        if (currentChunk >= totalChunks) {
          controller.close()
          return
        }
        const chunkKey = `${cacheKey}/_chunk_${currentChunk}`
        const resp = await cache.match(chunkKey)
        if (!resp) {
          controller.error(new Error(`Missing chunk ${currentChunk}`))
          return
        }
        const reader = resp.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
        }
        currentChunk++
      }
    })

    const headers = new Headers()
    headers.set('Content-Type', contentType)
    if (totalSize) headers.set('Content-Length', String(totalSize))
    await cache.put(cacheKey, new Response(assemblyStream, { headers }))
  } else {
    // Fallback: collect all chunks as blobs
    const parts = []
    for (let i = 0; i < totalChunks; i++) {
      const chunkKey = `${cacheKey}/_chunk_${i}`
      const resp = await cache.match(chunkKey)
      if (!resp) throw new Error(`Missing chunk ${i}`)
      parts.push(await resp.blob())
    }
    const blob = new Blob(parts, { type: contentType })
    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Content-Length', String(blob.size))
    await cache.put(cacheKey, new Response(blob, { headers }))
  }

  // Delete chunk entries
  for (let i = 0; i < totalChunks; i++) {
    cache.delete(`${cacheKey}/_chunk_${i}`).catch(() => {})
  }
}

export const state = () => ({
  downloadedItems: {}, // { [itemId]: { id, title, author, coverPath, libraryId, tracks, totalSize, downloadedAt } }
  downloading: {}, // { [itemId]: { progress: 0-100 } }
  queue: [], // [{ itemId, libraryItem, token, status: 'pending'|'active'|'failed', addedAt, error }]
  queueProcessing: false,
  queuePaused: false,
  byteProgress: {} // { [itemId]: { loaded, total } }
})

export const getters = {
  isDownloaded: (state) => (itemId) => {
    return !!state.downloadedItems[itemId]
  },
  isDownloading: (state) => (itemId) => {
    return !!state.downloading[itemId]
  },
  isQueued: (state) => (itemId) => {
    return state.queue.some((q) => q.itemId === itemId && q.status === 'pending')
  },
  isInQueue: (state) => (itemId) => {
    return state.queue.some((q) => q.itemId === itemId)
  },
  getDownloadProgress: (state) => (itemId) => {
    return state.downloading[itemId]?.progress || 0
  },
  getByteProgress: (state) => (itemId) => {
    return state.byteProgress[itemId] || null
  },
  downloadedItemsList: (state) => {
    return Object.values(state.downloadedItems)
  },
  getDownloadedItem: (state) => (itemId) => {
    return state.downloadedItems[itemId] || null
  },
  pendingQueueItems: (state) => {
    return state.queue.filter((q) => q.status === 'pending')
  },
  activeQueueItem: (state) => {
    return state.queue.find((q) => q.status === 'active') || null
  },
  failedQueueItems: (state) => {
    return state.queue.filter((q) => q.status === 'failed')
  },
  queueLength: (state) => {
    return state.queue.length
  }
}

export const mutations = {
  setDownloadedItem(state, { itemId, data }) {
    state.downloadedItems = { ...state.downloadedItems, [itemId]: data }
  },
  removeDownloadedItem(state, itemId) {
    const items = { ...state.downloadedItems }
    delete items[itemId]
    state.downloadedItems = items
  },
  setDownloading(state, { itemId, progress }) {
    // Mutate in-place when only progress value changes to avoid object churn
    if (state.downloading[itemId]) {
      state.downloading[itemId].progress = progress
    } else {
      state.downloading = { ...state.downloading, [itemId]: { progress } }
    }
  },
  clearDownloading(state, itemId) {
    const downloading = { ...state.downloading }
    delete downloading[itemId]
    state.downloading = downloading
  },
  setQueue(state, queue) {
    state.queue = [...queue]
  },
  addToQueue(state, entry) {
    state.queue = [...state.queue, entry]
  },
  updateQueueItem(state, { itemId, updates }) {
    state.queue = state.queue.map((q) => (q.itemId === itemId ? { ...q, ...updates } : q))
  },
  removeFromQueue(state, itemId) {
    state.queue = state.queue.filter((q) => q.itemId !== itemId)
  },
  clearQueue(state) {
    state.queue = []
  },
  setQueueProcessing(state, val) {
    state.queueProcessing = val
  },
  setQueuePaused(state, val) {
    state.queuePaused = val
  },
  setByteProgress(state, { itemId, loaded, total }) {
    // Mutate in-place when entry exists to avoid object spread on every progress tick
    if (state.byteProgress[itemId]) {
      state.byteProgress[itemId].loaded = loaded
      state.byteProgress[itemId].total = total
    } else {
      state.byteProgress = { ...state.byteProgress, [itemId]: { loaded, total } }
    }
  },
  clearByteProgress(state, itemId) {
    const bp = { ...state.byteProgress }
    delete bp[itemId]
    state.byteProgress = bp
  }
}

export const actions = {
  init({ commit, dispatch }) {
    // Load downloaded items from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const items = JSON.parse(stored)
        for (const [itemId, data] of Object.entries(items)) {
          commit('setDownloadedItem', { itemId, data })
        }
      }
    } catch (e) {
      console.error('[Offline] Failed to load offline metadata from localStorage', e)
    }

    // Crash recovery: load queue from localStorage
    try {
      const storedQueue = localStorage.getItem(QUEUE_KEY)
      if (storedQueue) {
        const queue = JSON.parse(storedQueue)
        // Reset any active items back to pending (tab was killed mid-download)
        const recovered = queue.map((q) => (q.status === 'active' ? { ...q, status: 'pending' } : q))
        // Remove completed items from the queue
        const pending = recovered.filter((q) => q.status === 'pending' || q.status === 'failed')
        if (pending.length) {
          commit('setQueue', pending)
          console.log(`[Offline] Recovered ${pending.length} queued items from previous session`)
          // Auto-resume after a short delay
          setTimeout(() => {
            dispatch('processQueue')
          }, 2000)
        }
      }
    } catch (e) {
      console.error('[Offline] Failed to load download queue from localStorage', e)
    }
  },

  /**
   * Enqueue one or more library items for download.
   * Skips items that are already downloaded or already in the queue.
   * Returns the count of newly enqueued items.
   */
  enqueue({ state, commit, dispatch }, { libraryItems, token }) {
    const items = Array.isArray(libraryItems) ? libraryItems : [libraryItems]
    let added = 0

    for (const item of items) {
      const itemId = item.id
      // Skip if already downloaded, currently downloading, or already queued
      if (state.downloadedItems[itemId]) continue
      if (state.queue.some((q) => q.itemId === itemId)) continue

      commit('addToQueue', {
        itemId,
        libraryItem: item,
        token,
        status: 'pending',
        addedAt: Date.now(),
        error: null
      })
      added++
    }

    if (added > 0) {
      dispatch('_saveQueueToStorage')
      // Auto-start processor if not already running
      if (!state.queueProcessing) {
        dispatch('processQueue')
      }
    }

    return added
  },

  /**
   * Core queue processor loop.
   * Picks the next pending item, checks storage, downloads it, waits for GC, repeats.
   */
  async processQueue({ state, commit, dispatch }) {
    if (state.queueProcessing) return
    commit('setQueueProcessing', true)

    while (true) {
      // Check if paused
      if (state.queuePaused) {
        break
      }

      // Find next pending item
      const next = state.queue.find((q) => q.status === 'pending')
      if (!next) break

      // Check storage quota before each download
      const hasSpace = await dispatch('_checkStorageQuota')
      if (!hasSpace) {
        commit('setQueuePaused', true)
        console.warn('[Offline] Low storage — pausing download queue')
        break
      }

      // Mark as active
      commit('updateQueueItem', { itemId: next.itemId, updates: { status: 'active' } })
      dispatch('_saveQueueToStorage')

      try {
        await dispatch('_downloadSingleItem', { queueEntry: next })
        // Success — remove from queue
        commit('removeFromQueue', next.itemId)
      } catch (e) {
        if (e.name === 'AbortError' || e.message === 'cancelled') {
          // Item was cancelled — already removed from queue by cancelQueueItem
          continue
        }
        console.error('[Offline] Queue item failed', next.itemId, e)
        commit('updateQueueItem', {
          itemId: next.itemId,
          updates: { status: 'failed', error: e.message || 'Download failed' }
        })
      }

      dispatch('_saveQueueToStorage')

      // GC delay between items — let the browser reclaim memory
      await new Promise((resolve) => setTimeout(resolve, GC_DELAY_MS))
    }

    commit('setQueueProcessing', false)
  },

  /**
   * Download a single item by streaming each track directly into Cache Storage.
   *
   * RESUMABLE CHUNKED DOWNLOAD: Large files (>50 MB) are downloaded in 50 MB
   * chunks using HTTP Range requests. Each chunk is stored as a separate cache
   * entry, so if the page crashes mid-download we only lose the in-flight chunk
   * (~50 MB) instead of the entire file. On retry, completed chunks are skipped
   * and the download resumes from where it left off.
   *
   * After all chunks are cached, they are streamed into a single final cache
   * entry (zero-copy assembly) and the temporary chunk entries are deleted.
   *
   * Small files (≤50 MB) still use the fast single-fetch streaming path.
   */
  async _downloadSingleItem({ commit, state, dispatch }, { queueEntry }) {
    const { itemId, libraryItem, token } = queueEntry

    // Request persistent storage on first download
    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {})
    }

    // Get audio files — may need to fetch if item is in minified form
    let audioFiles = libraryItem.media?.audioFiles
    let itemMeta = libraryItem
    if (!audioFiles || !audioFiles.length) {
      try {
        const resp = await fetch(`/api/items/${itemId}?expanded=1`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        itemMeta = await resp.json()
        audioFiles = itemMeta.media?.audioFiles || []
      } catch (e) {
        console.error('[Offline] Failed to fetch item details', e)
        throw e
      }
    }

    const includedFiles = audioFiles.filter((af) => !af.exclude)
    if (!includedFiles.length) {
      console.warn('[Offline] No audio files to download for', itemId)
      throw new Error('No audio files')
    }

    const controller = new AbortController()
    abortControllers[itemId] = controller

    commit('setDownloading', { itemId, progress: 0 })

    let cache
    try {
      cache = await caches.open(CACHE_NAME)
    } catch (e) {
      console.error('[Offline] Failed to open Cache Storage', e)
      commit('clearDownloading', itemId)
      delete abortControllers[itemId]
      throw e
    }

    const tracks = []
    let startOffset = 0
    let totalSize = 0

    // Pre-calculate total bytes for accurate progress
    let totalBytesAllFiles = 0
    const fileSizes = []
    for (const af of includedFiles) {
      const size = af.metadata?.size || 0
      fileSizes.push(size)
      totalBytesAllFiles += size
    }
    let downloadedBytesAllFiles = 0

    for (let i = 0; i < includedFiles.length; i++) {
      if (controller.signal.aborted) {
        for (const t of tracks) {
          cache.delete(t.cacheKey).catch(() => {})
        }
        commit('clearDownloading', itemId)
        commit('clearByteProgress', itemId)
        delete abortControllers[itemId]
        throw new Error('cancelled')
      }

      const af = includedFiles[i]
      const cacheKey = `/offline/items/${itemId}/file/${af.ino}`
      const url = `/api/items/${itemId}/file/${af.ino}`

      try {
        // ── CHECK IF TRACK IS ALREADY FULLY CACHED (crash recovery) ──
        const existingResp = await cache.match(cacheKey)
        if (existingResp) {
          const cachedSize = parseInt(existingResp.headers.get('Content-Length') || '0', 10) || (af.metadata?.size || 0)
          console.log(`[Offline] Track ${af.ino} already cached (${cachedSize} bytes), skipping`)
          downloadedBytesAllFiles += cachedSize
          if (cachedSize && cachedSize !== fileSizes[i]) {
            totalBytesAllFiles = totalBytesAllFiles - fileSizes[i] + cachedSize
            fileSizes[i] = cachedSize
          }
          tracks.push({
            ino: af.ino,
            startOffset,
            duration: af.duration || 0,
            mimeType: af.mimeType || 'audio/mpeg',
            size: cachedSize,
            cacheKey,
            title: af.metadata?.filename || `Track ${i + 1}`
          })
          startOffset += af.duration || 0
          totalSize += cachedSize
          commit('setByteProgress', { itemId, loaded: downloadedBytesAllFiles, total: totalBytesAllFiles })
          const pct = totalBytesAllFiles > 0 ? Math.round((downloadedBytesAllFiles / totalBytesAllFiles) * 100) : Math.round(((i + 1) / includedFiles.length) * 100)
          commit('setDownloading', { itemId, progress: Math.min(pct, 99) })
          continue
        }

        // ── HEAD REQUEST to determine file size and Range support ──
        const headResp = await fetch(url, {
          method: 'HEAD',
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        })
        if (!headResp.ok) throw new Error(`HEAD HTTP ${headResp.status}`)

        const contentLength = parseInt(headResp.headers.get('Content-Length') || '0', 10)
        const contentType = headResp.headers.get('Content-Type') || af.mimeType || 'audio/mpeg'
        const acceptRanges = (headResp.headers.get('Accept-Ranges') || '').toLowerCase()
        const supportsRange = acceptRanges === 'bytes' || acceptRanges.includes('bytes')

        // Update total with accurate size from server
        if (contentLength && contentLength !== fileSizes[i]) {
          totalBytesAllFiles = totalBytesAllFiles - fileSizes[i] + contentLength
          fileSizes[i] = contentLength
        }

        const useChunked = supportsRange && contentLength > CHUNK_SIZE
        let fileLoaded = 0
        let lastProgressCommit = 0

        if (useChunked) {
          // ══════════════════════════════════════════════════════════════
          // ── CHUNKED RESUMABLE DOWNLOAD (large files, Range support) ──
          // ══════════════════════════════════════════════════════════════
          const totalChunks = Math.ceil(contentLength / CHUNK_SIZE)
          const existingProgress = _getFileChunkProgress(itemId, af.ino)
          const completedChunks = new Set(existingProgress?.completedChunks || [])

          // Count bytes from already-completed chunks
          for (const idx of completedChunks) {
            const chunkStart = idx * CHUNK_SIZE
            const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, contentLength)
            const chunkBytes = chunkEnd - chunkStart
            fileLoaded += chunkBytes
            downloadedBytesAllFiles += chunkBytes
          }

          if (completedChunks.size > 0) {
            console.log(`[Offline] Resuming ${af.ino}: ${completedChunks.size}/${totalChunks} chunks already cached`)
          }

          commit('setByteProgress', { itemId, loaded: downloadedBytesAllFiles, total: totalBytesAllFiles })

          for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
            if (controller.signal.aborted) throw new Error('cancelled')

            if (completedChunks.has(chunkIdx)) continue // already have this chunk

            const rangeStart = chunkIdx * CHUNK_SIZE
            const rangeEnd = Math.min(rangeStart + CHUNK_SIZE - 1, contentLength - 1)
            const expectedBytes = rangeEnd - rangeStart + 1

            const chunkResp = await fetch(url, {
              headers: {
                Authorization: `Bearer ${token}`,
                Range: `bytes=${rangeStart}-${rangeEnd}`
              },
              signal: controller.signal
            })

            if (!chunkResp.ok && chunkResp.status !== 206) {
              throw new Error(`Chunk HTTP ${chunkResp.status}`)
            }

            const chunkCacheKey = `${cacheKey}/_chunk_${chunkIdx}`
            const chunkHeaders = new Headers()
            chunkHeaders.set('Content-Type', contentType)
            chunkHeaders.set('Content-Length', String(expectedBytes))

            // Stream chunk to cache with progress tracking
            if (chunkResp.body && typeof TransformStream === 'function') {
              let chunkLoaded = 0
              const progressTransform = new TransformStream({
                transform: (piece, ctrlr) => {
                  chunkLoaded += piece.byteLength
                  fileLoaded += piece.byteLength
                  downloadedBytesAllFiles += piece.byteLength

                  const now = Date.now()
                  if (now - lastProgressCommit >= PROGRESS_THROTTLE_MS) {
                    lastProgressCommit = now
                    commit('setByteProgress', { itemId, loaded: downloadedBytesAllFiles, total: totalBytesAllFiles })
                    if (totalBytesAllFiles > 0) {
                      const pct = Math.round((downloadedBytesAllFiles / totalBytesAllFiles) * 100)
                      commit('setDownloading', { itemId, progress: Math.min(pct, 99) })
                    }
                  }
                  ctrlr.enqueue(piece)
                }
              })
              await cache.put(chunkCacheKey, new Response(chunkResp.body.pipeThrough(progressTransform), { headers: chunkHeaders }))
            } else {
              // Fallback: read as blob
              const blob = await chunkResp.blob()
              fileLoaded += blob.size
              downloadedBytesAllFiles += blob.size
              await cache.put(chunkCacheKey, new Response(blob, { headers: chunkHeaders }))
            }

            // Mark chunk as completed and persist to localStorage immediately
            completedChunks.add(chunkIdx)
            _setFileChunkProgress(itemId, af.ino, {
              totalSize: contentLength,
              chunkSize: CHUNK_SIZE,
              totalChunks,
              completedChunks: [...completedChunks]
            })

            commit('setByteProgress', { itemId, loaded: downloadedBytesAllFiles, total: totalBytesAllFiles })
            if (totalBytesAllFiles > 0) {
              const pct = Math.round((downloadedBytesAllFiles / totalBytesAllFiles) * 100)
              commit('setDownloading', { itemId, progress: Math.min(pct, 99) })
            }
          }

          // ── ASSEMBLE CHUNKS into final cache entry ──
          console.log(`[Offline] Assembling ${totalChunks} chunks for ${af.ino} (${contentLength} bytes)`)
          await _assembleChunks(cache, cacheKey, contentType, contentLength, totalChunks)
          _clearFileChunkProgress(itemId, af.ino)
          console.log(`[Offline] Assembly complete for ${af.ino}`)
        } else {
          // ══════════════════════════════════════════════════════════
          // ── SINGLE-FETCH PATH (small files or no Range support) ──
          // ══════════════════════════════════════════════════════════
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)

          const supportsTransformStream = typeof TransformStream === 'function'

          if (response.body && typeof response.body.getReader === 'function' && supportsTransformStream) {
            // Zero-copy streaming path
            const progressTransform = new TransformStream({
              transform: (chunk, ctrlr) => {
                fileLoaded += chunk.byteLength
                downloadedBytesAllFiles += chunk.byteLength

                const now = Date.now()
                if (now - lastProgressCommit >= PROGRESS_THROTTLE_MS) {
                  lastProgressCommit = now
                  commit('setByteProgress', { itemId, loaded: downloadedBytesAllFiles, total: totalBytesAllFiles })
                  if (totalBytesAllFiles > 0) {
                    const pct = Math.round((downloadedBytesAllFiles / totalBytesAllFiles) * 100)
                    commit('setDownloading', { itemId, progress: Math.min(pct, 99) })
                  }
                }
                ctrlr.enqueue(chunk)
              }
            })

            const streamedBody = response.body.pipeThrough(progressTransform)
            const headers = new Headers()
            headers.set('Content-Type', contentType)
            if (contentLength) headers.set('Content-Length', String(contentLength))
            await cache.put(cacheKey, new Response(streamedBody, { headers }))
          } else if (response.body && typeof response.body.getReader === 'function') {
            // Chunked fallback for browsers without TransformStream
            const FLUSH_SIZE = 4 * 1024 * 1024 // 4 MB
            const reader = response.body.getReader()
            const blobParts = []
            let pendingChunks = []
            let pendingSize = 0

            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              pendingChunks.push(value)
              pendingSize += value.byteLength
              fileLoaded += value.byteLength
              downloadedBytesAllFiles += value.byteLength

              if (pendingSize >= FLUSH_SIZE) {
                blobParts.push(new Blob(pendingChunks))
                pendingChunks = []
                pendingSize = 0
              }

              const now = Date.now()
              if (now - lastProgressCommit >= PROGRESS_THROTTLE_MS) {
                lastProgressCommit = now
                commit('setByteProgress', { itemId, loaded: downloadedBytesAllFiles, total: totalBytesAllFiles })
                if (totalBytesAllFiles > 0) {
                  const pct = Math.round((downloadedBytesAllFiles / totalBytesAllFiles) * 100)
                  commit('setDownloading', { itemId, progress: Math.min(pct, 99) })
                }
              }
            }

            if (pendingChunks.length) {
              blobParts.push(new Blob(pendingChunks))
              pendingChunks = []
            }

            const blob = new Blob(blobParts, { type: contentType })
            blobParts.length = 0
            const headers = new Headers()
            headers.set('Content-Type', contentType)
            headers.set('Content-Length', String(blob.size))
            await cache.put(cacheKey, new Response(blob, { headers }))
          } else {
            // Bare fallback
            await cache.put(cacheKey, response)
            fileLoaded = contentLength || 0
            downloadedBytesAllFiles += fileLoaded
          }
        }

        const size = fileLoaded || contentLength
        tracks.push({
          ino: af.ino,
          startOffset,
          duration: af.duration || 0,
          mimeType: af.mimeType || 'audio/mpeg',
          size,
          cacheKey,
          title: af.metadata?.filename || `Track ${i + 1}`
        })

        startOffset += af.duration || 0
        totalSize += size
      } catch (e) {
        if (e.name === 'AbortError' || e.message === 'cancelled') {
          for (const t of tracks) {
            cache.delete(t.cacheKey).catch(() => {})
          }
          commit('clearDownloading', itemId)
          commit('clearByteProgress', itemId)
          delete abortControllers[itemId]
          throw e
        }
        console.error('[Offline] Failed to download track', af.ino, e)
        // Don't clean up chunk progress on error — it enables resume on retry
        for (const t of tracks) {
          cache.delete(t.cacheKey).catch(() => {})
        }
        commit('clearDownloading', itemId)
        commit('clearByteProgress', itemId)
        delete abortControllers[itemId]
        throw e
      }

      // Final progress for this file
      commit('setByteProgress', { itemId, loaded: downloadedBytesAllFiles, total: totalBytesAllFiles })
      const filePct = Math.round(((i + 1) / includedFiles.length) * 100)
      commit('setDownloading', { itemId, progress: Math.min(filePct, 99) })
    }

    delete abortControllers[itemId]

    const itemData = {
      id: itemId,
      title: itemMeta.media?.metadata?.title || libraryItem.media?.metadata?.title || 'Unknown',
      author: itemMeta.media?.metadata?.authorName || libraryItem.media?.metadata?.authorName || '',
      coverPath: itemMeta.media?.coverPath || libraryItem.media?.coverPath || null,
      libraryId: itemMeta.libraryId || libraryItem.libraryId || null,
      tracks,
      totalSize,
      downloadedAt: Date.now()
    }

    commit('setDownloadedItem', { itemId, data: itemData })
    commit('setDownloading', { itemId, progress: 100 })
    // Small delay so UI can show 100% before clearing
    await new Promise((resolve) => setTimeout(resolve, 200))
    commit('clearDownloading', itemId)
    commit('clearByteProgress', itemId)
    dispatch('_saveToStorage')
  },

  /**
   * Check if there is enough storage space for another download.
   * Returns true if ≥200MB free (or if the API is unavailable).
   */
  async _checkStorageQuota() {
    try {
      if (navigator.storage?.estimate) {
        const { usage, quota } = await navigator.storage.estimate()
        const free = (quota || 0) - (usage || 0)
        if (free < MIN_FREE_BYTES) {
          return false
        }
      }
    } catch (e) {
      // If estimate fails, proceed optimistically
      console.warn('[Offline] Storage estimate failed', e)
    }
    return true
  },

  /**
   * Cancel a single queued item. If it's actively downloading, abort it.
   */
  async cancelQueueItem({ state, commit, dispatch }, itemId) {
    const entry = state.queue.find((q) => q.itemId === itemId)
    if (!entry) return

    if (entry.status === 'active') {
      // Abort the active download
      const controller = abortControllers[itemId]
      if (controller) {
        controller.abort()
      }
    }

    // Clean up any partial chunk data in Cache Storage and localStorage
    const chunkData = _loadAllChunkProgress()
    const keysToClean = Object.keys(chunkData).filter((k) => k.startsWith(`${itemId}:`))
    if (keysToClean.length) {
      try {
        const cache = await caches.open(CACHE_NAME)
        for (const key of keysToClean) {
          const progress = chunkData[key]
          const ino = key.split(':')[1]
          const cacheKey = `/offline/items/${itemId}/file/${ino}`
          for (let c = 0; c < (progress.totalChunks || 0); c++) {
            cache.delete(`${cacheKey}/_chunk_${c}`).catch(() => {})
          }
          delete chunkData[key]
        }
        _saveAllChunkProgress(chunkData)
      } catch (e) {
        console.warn('[Offline] Failed to clean up chunks on cancel', e)
      }
    }

    commit('removeFromQueue', itemId)
    commit('clearDownloading', itemId)
    commit('clearByteProgress', itemId)
    dispatch('_saveQueueToStorage')
  },

  /**
   * Cancel all queued items and stop processing.
   */
  cancelAllQueue({ state, commit, dispatch }) {
    // Abort any active download
    const active = state.queue.find((q) => q.status === 'active')
    if (active) {
      const controller = abortControllers[active.itemId]
      if (controller) {
        controller.abort()
      }
      commit('clearDownloading', active.itemId)
      commit('clearByteProgress', active.itemId)
    }

    commit('clearQueue')
    commit('setQueuePaused', false)
    dispatch('_saveQueueToStorage')
  },

  /**
   * Resume a paused queue and restart the processor.
   */
  resumeQueue({ commit, dispatch }) {
    commit('setQueuePaused', false)
    dispatch('processQueue')
  },

  /**
   * Reset failed items to pending and restart the processor.
   */
  retryFailed({ state, commit, dispatch }) {
    for (const entry of state.queue) {
      if (entry.status === 'failed') {
        commit('updateQueueItem', { itemId: entry.itemId, updates: { status: 'pending', error: null } })
      }
    }
    dispatch('_saveQueueToStorage')
    commit('setQueuePaused', false)
    if (!state.queueProcessing) {
      dispatch('processQueue')
    }
  },

  // ---- Backward-compatible actions (delegate to enqueue) ----

  /**
   * Download a single item. Now delegates to the queue system.
   */
  async downloadItem({ dispatch }, { libraryItem, token }) {
    dispatch('enqueue', { libraryItems: [libraryItem], token })
  },

  /**
   * Download multiple items sequentially. Now delegates to the queue system.
   * Returns { downloaded: count } for backward compatibility.
   */
  async downloadItems({ dispatch }, { libraryItems, token }) {
    const added = dispatch('enqueue', { libraryItems, token })
    return { downloaded: 0, skipped: 0, failed: 0, queued: added }
  },

  async getOfflineTracks({ state }, itemId) {
    const item = state.downloadedItems[itemId]
    if (!item) return null

    // Verify the cache is populated by spot-checking the first track
    let cache
    try {
      cache = await caches.open(CACHE_NAME)
    } catch (e) {
      return null
    }
    if (item.tracks.length) {
      const firstResponse = await cache.match(item.tracks[0].cacheKey)
      if (!firstResponse) {
        console.warn('[Offline] Cache entry missing for first track — stale download?', item.tracks[0].cacheKey)
        return null
      }
    }

    // Return lightweight descriptors. Blob URLs are created one-at-a-time
    // by loadOfflineBlobUrl() to avoid loading the whole audiobook into RAM.
    return item.tracks.map((track, i) => ({
      relativeContentUrl: null, // filled in lazily by LocalAudioPlayer
      offlineCacheKey: track.cacheKey, // signals "offline track" to the player
      startOffset: track.startOffset,
      duration: track.duration,
      mimeType: track.mimeType,
      title: track.title,
      index: i
    }))
  },

  async deleteItem({ commit, state, dispatch }, itemId) {
    const item = state.downloadedItems[itemId]
    if (!item) return

    let cache
    try {
      cache = await caches.open(CACHE_NAME)
    } catch (e) {}

    if (cache) {
      for (const track of item.tracks) {
        await cache.delete(track.cacheKey).catch(() => {})
        // Also clean up any leftover chunk entries
        for (let c = 0; c < 100; c++) {
          const deleted = await cache.delete(`${track.cacheKey}/_chunk_${c}`).catch(() => false)
          if (!deleted) break
        }
        _clearFileChunkProgress(itemId, track.ino)
      }
    }

    commit('removeDownloadedItem', itemId)
    dispatch('_saveToStorage')
  },

  cancelDownload({ dispatch }, itemId) {
    // Try queue-based cancel first, fall back to direct abort
    dispatch('cancelQueueItem', itemId)
    const controller = abortControllers[itemId]
    if (controller) {
      controller.abort()
    }
  },

  _saveToStorage({ state }) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.downloadedItems))
    } catch (e) {
      console.error('[Offline] Failed to save offline metadata to localStorage', e)
    }
  },

  _saveQueueToStorage({ state }) {
    try {
      // Save queue entries without the full libraryItem to keep localStorage small
      const serializable = state.queue.map((q) => ({
        itemId: q.itemId,
        libraryItem: { id: q.libraryItem.id, libraryId: q.libraryItem.libraryId },
        token: q.token,
        status: q.status,
        addedAt: q.addedAt,
        error: q.error
      }))
      localStorage.setItem(QUEUE_KEY, JSON.stringify(serializable))
    } catch (e) {
      console.error('[Offline] Failed to save download queue to localStorage', e)
    }
  }
}
