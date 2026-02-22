<template>
  <div id="page-wrapper" class="page p-6 overflow-y-auto relative" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="w-full max-w-3xl mx-auto">
      <div class="flex items-center mb-6">
        <h1 class="text-2xl">Downloads</h1>
        <div class="grow" />
        <p v-if="downloadedItems.length" class="text-sm text-gray-400">
          {{ downloadedItems.length }} {{ downloadedItems.length === 1 ? 'item' : 'items' }} &bull; {{ totalSizeFormatted }}
        </p>
      </div>

      <!-- Low storage warning -->
      <div v-if="queuePaused" class="mb-4 p-3 rounded-lg bg-warning/20 border border-warning/40 flex items-center gap-3">
        <span class="material-symbols text-warning text-2xl">warning</span>
        <div class="flex-1">
          <p class="text-warning font-semibold text-sm">Low Storage</p>
          <p class="text-xs text-gray-300">Downloads paused — less than 200 MB free. Free up space and resume.</p>
        </div>
        <button class="text-sm text-white hover:text-warning focus:outline-none" @click="resumeQueue">Resume</button>
      </div>

      <!-- Active download queue section -->
      <div v-if="hasQueueItems" class="mb-6 space-y-3">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-lg font-semibold">Download Queue</h2>
          <div class="flex items-center gap-2">
            <button v-if="failedItems.length" class="text-sm text-yellow-400 hover:text-yellow-300 focus:outline-none" @click="retryFailed">
              Retry Failed
            </button>
            <button v-if="!queuePaused && queueProcessing" class="text-sm text-gray-300 hover:text-white focus:outline-none" @click="pauseQueue">
              Pause
            </button>
            <button v-if="queuePaused && !queueProcessing" class="text-sm text-success hover:text-success/80 focus:outline-none" @click="resumeQueue">
              Resume
            </button>
            <button class="text-sm text-error hover:text-error/80 focus:outline-none" @click="cancelAll">
              Cancel All
            </button>
          </div>
        </div>

        <!-- Active download -->
        <div v-if="activeItem" class="bg-primary/30 rounded-lg p-4">
          <div class="flex items-center gap-3 mb-2">
            <svg class="animate-spin text-yellow-400 w-5 h-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p class="font-semibold truncate flex-1">{{ activeItemTitle }}</p>
            <button class="text-gray-400 hover:text-error focus:outline-none" title="Cancel" @click="cancelItem(activeItem.itemId)">
              <span class="material-symbols text-lg">close</span>
            </button>
          </div>
          <!-- Byte-level progress bar -->
          <div class="w-full h-2 bg-black/30 rounded-full overflow-hidden">
            <div class="h-full bg-yellow-400 rounded-full transition-all duration-300" :style="{ width: activeProgressPct + '%' }" />
          </div>
          <p class="text-xs text-gray-400 mt-1">{{ activeProgressText }}</p>
        </div>

        <!-- Pending items -->
        <div v-for="entry in pendingItems" :key="entry.itemId" class="flex items-center gap-3 bg-primary/20 rounded-lg p-3">
          <span class="material-symbols text-blue-400 text-lg flex-shrink-0">schedule</span>
          <p class="truncate flex-1 text-sm">{{ getQueueItemTitle(entry) }}</p>
          <button class="text-gray-400 hover:text-error focus:outline-none" title="Cancel" @click="cancelItem(entry.itemId)">
            <span class="material-symbols text-lg">close</span>
          </button>
        </div>

        <!-- Failed items -->
        <div v-for="entry in failedItems" :key="entry.itemId" class="flex items-center gap-3 bg-error/10 rounded-lg p-3">
          <span class="material-symbols text-error text-lg flex-shrink-0">error</span>
          <div class="flex-1 min-w-0">
            <p class="truncate text-sm">{{ getQueueItemTitle(entry) }}</p>
            <p class="text-xs text-error/80 truncate">{{ entry.error }}</p>
          </div>
          <button class="text-gray-400 hover:text-error focus:outline-none" title="Cancel" @click="cancelItem(entry.itemId)">
            <span class="material-symbols text-lg">close</span>
          </button>
        </div>

        <!-- Summary line -->
        <p v-if="pendingItems.length" class="text-xs text-gray-500">
          {{ pendingItems.length }} pending{{ failedItems.length ? `, ${failedItems.length} failed` : '' }}
        </p>
      </div>

      <!-- Empty state -->
      <div v-if="!downloadedItems.length && !hasQueueItems" class="flex flex-col items-center justify-center py-20 text-gray-400">
        <span class="material-symbols text-6xl mb-4">cloud_download</span>
        <p class="text-lg mb-2">No downloads yet</p>
        <p class="text-sm text-center max-w-xs">Download audiobooks from the library or from a book's "..." menu for offline listening.</p>
      </div>

      <!-- Downloaded items grouped by library -->
      <div v-if="downloadedItems.length" class="space-y-6">
        <div v-for="group in downloadedItemsByLibrary" :key="group.libraryId">
          <h2 class="text-lg font-semibold mb-3 text-gray-300">{{ group.libraryName }}</h2>
          <div class="space-y-3">
            <div
              v-for="item in group.items"
              :key="item.id"
              class="flex items-center gap-4 bg-primary/30 rounded-lg p-4"
            >
              <!-- Cover -->
              <div class="flex-shrink-0 w-16 h-16">
                <img
                  v-if="item.coverPath"
                  :src="getCoverSrc(item)"
                  class="w-full h-full object-cover rounded"
                  alt=""
                />
                <div v-else class="w-full h-full bg-primary/60 rounded flex items-center justify-center">
                  <span class="material-symbols text-gray-400 text-2xl">book</span>
                </div>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <p class="font-semibold truncate">{{ item.title }}</p>
                <p v-if="item.author" class="text-sm text-gray-400 truncate">{{ item.author }}</p>
                <p class="text-xs text-gray-500 mt-1">
                  {{ formatSize(item.totalSize) }} &bull; Downloaded {{ formatDate(item.downloadedAt) }}
                </p>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2 flex-shrink-0">
                <button
                  title="Play"
                  class="flex items-center justify-center text-success hover:text-success/80 focus:outline-none"
                  @click="playItem(item)"
                >
                  <span class="material-symbols text-2xl">play_circle</span>
                </button>
                <button
                  title="Delete offline copy"
                  class="flex items-center justify-center text-gray-400 hover:text-error focus:outline-none"
                  @click="confirmDelete(item)"
                >
                  <span class="material-symbols text-xl">delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Delete all button -->
      <div v-if="downloadedItems.length" class="mt-8 flex justify-end">
        <button class="text-sm text-error hover:text-error/80 focus:outline-none" @click="confirmDeleteAll">
          Delete all downloads
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {}
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    downloadedItems() {
      return this.$store.getters['offline/downloadedItemsList']
    },
    libraries() {
      return this.$store.state.libraries.libraries || []
    },
    downloadedItemsByLibrary() {
      const groups = {}
      for (const item of this.downloadedItems) {
        const libId = item.libraryId || '_other'
        if (!groups[libId]) {
          const lib = this.libraries.find((l) => l.id === libId)
          groups[libId] = {
            libraryId: libId,
            libraryName: lib ? lib.name : 'Other',
            items: []
          }
        }
        groups[libId].items.push(item)
      }
      // Sort: named libraries first (alphabetical), "Other" last
      return Object.values(groups).sort((a, b) => {
        if (a.libraryId === '_other') return 1
        if (b.libraryId === '_other') return -1
        return a.libraryName.localeCompare(b.libraryName)
      })
    },
    totalSize() {
      return this.downloadedItems.reduce((sum, item) => sum + (item.totalSize || 0), 0)
    },
    totalSizeFormatted() {
      return this.formatSize(this.totalSize)
    },
    // Queue state
    queue() {
      return this.$store.state.offline.queue
    },
    queueProcessing() {
      return this.$store.state.offline.queueProcessing
    },
    queuePaused() {
      return this.$store.state.offline.queuePaused
    },
    hasQueueItems() {
      return this.queue.length > 0
    },
    activeItem() {
      return this.$store.getters['offline/activeQueueItem']
    },
    pendingItems() {
      return this.$store.getters['offline/pendingQueueItems']
    },
    failedItems() {
      return this.$store.getters['offline/failedQueueItems']
    },
    activeItemTitle() {
      if (!this.activeItem) return ''
      return this.getQueueItemTitle(this.activeItem)
    },
    activeByteProgress() {
      if (!this.activeItem) return null
      return this.$store.getters['offline/getByteProgress'](this.activeItem.itemId)
    },
    activeProgressPct() {
      if (!this.activeByteProgress || !this.activeByteProgress.total) {
        // Fall back to file-based progress
        if (!this.activeItem) return 0
        return this.$store.getters['offline/getDownloadProgress'](this.activeItem.itemId)
      }
      return Math.round((this.activeByteProgress.loaded / this.activeByteProgress.total) * 100)
    },
    activeProgressText() {
      if (this.activeByteProgress && this.activeByteProgress.total > 0) {
        const loadedMB = (this.activeByteProgress.loaded / (1024 * 1024)).toFixed(1)
        const totalMB = (this.activeByteProgress.total / (1024 * 1024)).toFixed(1)
        return `${loadedMB} / ${totalMB} MB`
      }
      return `${this.activeProgressPct}%`
    }
  },
  methods: {
    formatSize(bytes) {
      if (!bytes) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB']
      let i = 0
      let val = bytes
      while (val >= 1024 && i < units.length - 1) {
        val /= 1024
        i++
      }
      return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
    },
    formatDate(ts) {
      if (!ts) return ''
      return new Date(ts).toLocaleDateString()
    },
    getCoverSrc(item) {
      const routerBasePath = this.$config.routerBasePath === '/' ? '' : this.$config.routerBasePath
      if (!item.id) return null
      return `${routerBasePath}/api/items/${item.id}/cover`
    },
    getQueueItemTitle(entry) {
      return entry.libraryItem?.media?.metadata?.title || entry.libraryItem?.title || entry.itemId
    },
    playItem(item) {
      this.$eventBus.$emit('play-item', {
        libraryItemId: item.id,
        episodeId: null
      })
    },
    cancelItem(itemId) {
      this.$store.dispatch('offline/cancelQueueItem', itemId)
    },
    cancelAll() {
      this.$store.dispatch('offline/cancelAllQueue')
    },
    pauseQueue() {
      this.$store.commit('offline/setQueuePaused', true)
    },
    resumeQueue() {
      this.$store.dispatch('offline/resumeQueue')
    },
    retryFailed() {
      this.$store.dispatch('offline/retryFailed')
    },
    confirmDelete(item) {
      const payload = {
        message: `Delete the offline copy of "${item.title}"? This cannot be undone.`,
        callback: (confirmed) => {
          if (confirmed) this.$store.dispatch('offline/deleteItem', item.id)
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    confirmDeleteAll() {
      const payload = {
        message: `Delete all ${this.downloadedItems.length} offline downloads?`,
        callback: (confirmed) => {
          if (confirmed) {
            for (const item of this.downloadedItems) {
              this.$store.dispatch('offline/deleteItem', item.id)
            }
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    }
  }
}
</script>
