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

      <!-- Empty state -->
      <div v-if="!downloadedItems.length" class="flex flex-col items-center justify-center py-20 text-gray-400">
        <span class="material-symbols text-6xl mb-4">cloud_download</span>
        <p class="text-lg mb-2">No downloads yet</p>
        <p class="text-sm text-center max-w-xs">Download audiobooks from the library or from a book's "..." menu for offline listening.</p>
      </div>

      <!-- Downloaded items list -->
      <div v-else class="space-y-3">
        <div
          v-for="item in downloadedItems"
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
    totalSize() {
      return this.downloadedItems.reduce((sum, item) => sum + (item.totalSize || 0), 0)
    },
    totalSizeFormatted() {
      return this.formatSize(this.totalSize)
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
    playItem(item) {
      this.$eventBus.$emit('play-item', {
        libraryItemId: item.id,
        episodeId: null
      })
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
