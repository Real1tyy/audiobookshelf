const CACHE_NAME = 'abs-audio-v1'
const STORAGE_KEY = 'abs-offline-items'

// AbortControllers keyed by itemId — outside Vue reactivity
const abortControllers = {}

export const state = () => ({
  downloadedItems: {}, // { [itemId]: { id, title, author, coverPath, libraryId, tracks:[{ino, startOffset, duration, mimeType, size, cacheKey, title}], totalSize, downloadedAt } }
  downloading: {} // { [itemId]: { progress: 0-100 } }
})

export const getters = {
  isDownloaded: (state) => (itemId) => {
    return !!state.downloadedItems[itemId]
  },
  isDownloading: (state) => (itemId) => {
    return !!state.downloading[itemId]
  },
  getDownloadProgress: (state) => (itemId) => {
    return state.downloading[itemId]?.progress || 0
  },
  downloadedItemsList: (state) => {
    return Object.values(state.downloadedItems)
  },
  getDownloadedItem: (state) => (itemId) => {
    return state.downloadedItems[itemId] || null
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
    state.downloading = { ...state.downloading, [itemId]: { progress } }
  },
  clearDownloading(state, itemId) {
    const downloading = { ...state.downloading }
    delete downloading[itemId]
    state.downloading = downloading
  }
}

export const actions = {
  init({ commit }) {
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
  },

  async downloadItem({ commit, state, dispatch }, { libraryItem, token }) {
    const itemId = libraryItem.id
    if (state.downloading[itemId]) return
    if (state.downloadedItems[itemId]) return

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
        return
      }
    }

    const includedFiles = audioFiles.filter((af) => !af.exclude)
    if (!includedFiles.length) {
      console.warn('[Offline] No audio files to download for', itemId)
      return
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
      return
    }

    const tracks = []
    let startOffset = 0
    let totalSize = 0

    for (let i = 0; i < includedFiles.length; i++) {
      if (controller.signal.aborted) {
        // Clean up partial downloads
        for (const t of tracks) {
          cache.delete(t.cacheKey).catch(() => {})
        }
        commit('clearDownloading', itemId)
        delete abortControllers[itemId]
        return
      }

      const af = includedFiles[i]
      const cacheKey = `/offline/items/${itemId}/file/${af.ino}`
      const url = `/api/items/${itemId}/file/${af.ino}`

      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const size = parseInt(response.headers.get('Content-Length') || '0', 10)

        // Put response body directly into cache (consumes the response body)
        await cache.put(cacheKey, response)

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
        if (e.name === 'AbortError') {
          for (const t of tracks) {
            cache.delete(t.cacheKey).catch(() => {})
          }
          commit('clearDownloading', itemId)
          delete abortControllers[itemId]
          return
        }
        console.error('[Offline] Failed to download track', af.ino, e)
        for (const t of tracks) {
          cache.delete(t.cacheKey).catch(() => {})
        }
        commit('clearDownloading', itemId)
        delete abortControllers[itemId]
        return
      }

      const progress = Math.round(((i + 1) / includedFiles.length) * 100)
      commit('setDownloading', { itemId, progress })
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
    commit('clearDownloading', itemId)
    dispatch('_saveToStorage')
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
      }
    }

    commit('removeDownloadedItem', itemId)
    dispatch('_saveToStorage')
  },

  /**
   * Download multiple items sequentially, skipping already-downloaded or in-progress items.
   * Returns { downloaded, skipped, failed }.
   */
  async downloadItems({ state, dispatch }, { libraryItems, token }) {
    let downloaded = 0
    let skipped = 0
    let failed = 0

    for (const item of libraryItems) {
      const itemId = item.id
      if (state.downloadedItems[itemId] || state.downloading[itemId]) {
        skipped++
        continue
      }
      try {
        await dispatch('downloadItem', { libraryItem: item, token })
        // Check if it actually got stored (downloadItem silently returns on some errors)
        if (state.downloadedItems[itemId]) {
          downloaded++
        } else {
          failed++
        }
      } catch (e) {
        console.error('[Offline] Failed to download item', itemId, e)
        failed++
      }
    }

    return { downloaded, skipped, failed }
  },

  cancelDownload({ commit }, itemId) {
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
  }
}
