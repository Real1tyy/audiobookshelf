<template>
  <div id="page-wrapper" class="page p-6 overflow-y-auto relative" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="w-full max-w-3xl mx-auto">
      <div class="flex items-center mb-6">
        <h1 class="text-2xl">Shared Items</h1>
        <div class="grow" />
        <p v-if="shares.length" class="text-sm text-gray-400">
          {{ filteredShares.length }} {{ filteredShares.length === 1 ? 'item' : 'items' }}
        </p>
      </div>

      <!-- Search and sort controls -->
      <div v-if="shares.length" class="flex items-center gap-3 mb-4">
        <div class="flex-1">
          <input v-model="searchQuery" type="text" placeholder="Search by title, author, or slug..." class="w-full h-9 px-3 rounded bg-primary/40 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20" />
        </div>
        <select v-model="sortBy" class="h-9 px-2 rounded bg-primary/40 text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/20">
          <option value="createdAt">Date Shared</option>
          <option value="title">Title</option>
          <option value="expiresAt">Expiration</option>
        </select>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <svg class="animate-spin text-white w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>

      <!-- Empty state -->
      <div v-else-if="!shares.length" class="flex flex-col items-center justify-center py-20 text-gray-400">
        <span class="material-symbols text-6xl mb-4">share</span>
        <p class="text-lg mb-2">No shared items</p>
        <p class="text-sm text-center max-w-xs">Share audiobooks from the library to create public links for others to listen.</p>
      </div>

      <!-- Shared items list -->
      <div v-else-if="filteredShares.length" class="space-y-3">
        <div
          v-for="share in filteredShares"
          :key="share.id"
          class="flex items-center gap-4 bg-primary/30 rounded-lg p-4 cursor-pointer hover:bg-primary/50 transition-colors"
          @click="openItem(share)"
        >
          <!-- Cover -->
          <div class="flex-shrink-0 w-16 h-16">
            <img
              v-if="share.libraryItemId"
              :src="getCoverSrc(share)"
              class="w-full h-full object-cover rounded"
              alt=""
            />
            <div v-else class="w-full h-full bg-primary/60 rounded flex items-center justify-center">
              <span class="material-symbols text-gray-400 text-2xl">book</span>
            </div>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <p class="font-semibold truncate">{{ share.title || 'Unknown' }}</p>
            <p v-if="share.author" class="text-sm text-gray-400 truncate">{{ share.author }}</p>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <p class="text-xs text-gray-500">
                /share/{{ share.slug }}
              </p>
              <span v-if="share.isDownloadable" class="text-xxs px-1.5 py-0.5 rounded bg-success/20 text-success">downloadable</span>
              <span v-if="isExpired(share)" class="text-xxs px-1.5 py-0.5 rounded bg-error/20 text-error">expired</span>
              <span v-else-if="share.expiresAt" class="text-xxs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">expires {{ formatDate(share.expiresAt) }}</span>
              <span v-else class="text-xxs px-1.5 py-0.5 rounded bg-white/10 text-gray-400">no expiry</span>
            </div>
          </div>

          <!-- Unshare button -->
          <button
            title="Unshare"
            class="flex items-center justify-center w-10 h-10 rounded-full text-gray-400 hover:text-error hover:bg-error/10 focus:outline-none flex-shrink-0 transition-colors"
            @click.stop.prevent="confirmUnshare(share)"
            @mousedown.stop
          >
            <span class="material-symbols text-xl pointer-events-none">link_off</span>
          </button>
        </div>
      </div>

      <!-- No results from search -->
      <div v-else class="flex flex-col items-center justify-center py-12 text-gray-400">
        <span class="material-symbols text-4xl mb-3">search_off</span>
        <p class="text-sm">No shares match your search</p>
      </div>

      <!-- Unshare all button -->
      <div v-if="shares.length > 1" class="mt-8 flex justify-end">
        <button class="text-sm text-error hover:text-error/80 focus:outline-none" @click="confirmUnshareAll">
          Unshare all items
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
    }
  },
  data() {
    return {
      shares: [],
      loading: true,
      searchQuery: '',
      sortBy: 'createdAt'
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    filteredShares() {
      let result = [...this.shares]

      // Filter by search query
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase()
        result = result.filter((s) => {
          return (s.title || '').toLowerCase().includes(q) || (s.author || '').toLowerCase().includes(q) || (s.slug || '').toLowerCase().includes(q)
        })
      }

      // Sort
      result.sort((a, b) => {
        if (this.sortBy === 'title') {
          return (a.title || '').localeCompare(b.title || '')
        }
        if (this.sortBy === 'expiresAt') {
          const aExp = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity
          const bExp = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity
          return aExp - bExp
        }
        // Default: createdAt descending (newest first)
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bTime - aTime
      })

      return result
    }
  },
  methods: {
    async fetchShares() {
      this.loading = true
      try {
        const data = await this.$axios.$get('/api/share/mediaitem')
        this.shares = data.shares || []
      } catch (error) {
        console.error('Failed to fetch shares', error)
        this.$toast.error('Failed to load shared items')
        this.shares = []
      } finally {
        this.loading = false
      }
    },
    getCoverSrc(share) {
      const routerBasePath = this.$config.routerBasePath === '/' ? '' : this.$config.routerBasePath
      if (!share.libraryItemId) return null
      return `${routerBasePath}/api/items/${share.libraryItemId}/cover`
    },
    isExpired(share) {
      if (!share.expiresAt) return false
      return new Date(share.expiresAt).getTime() < Date.now()
    },
    formatDate(dateStr) {
      if (!dateStr) return ''
      return new Date(dateStr).toLocaleDateString()
    },
    openItem(share) {
      if (share.libraryItemId) {
        this.$router.push(`/item/${share.libraryItemId}`)
      }
    },
    confirmUnshare(share) {
      const title = share.title || share.slug
      // Use nextTick to ensure click event fully completes before showing modal
      // This prevents v-click-outside from immediately closing the confirm prompt
      this.$nextTick(() => {
        this.$store.commit('globals/setConfirmPrompt', {
          message: `Stop sharing "<strong>${title}</strong>"? The public link will stop working.`,
          callback: (confirmed) => {
            if (confirmed) this.unshareItem(share.id)
          },
          type: 'yesNo'
        })
      })
    },
    async unshareItem(id) {
      try {
        await this.$axios.$delete(`/api/share/mediaitem/${id}`)
        this.shares = this.shares.filter((s) => s.id !== id)
        this.$toast.success('Item unshared')
      } catch (error) {
        console.error('Failed to unshare item', error)
        this.$toast.error('Failed to unshare item')
      }
    },
    confirmUnshareAll() {
      const count = this.shares.length
      this.$nextTick(() => {
        this.$store.commit('globals/setConfirmPrompt', {
          message: `Unshare all <strong>${count}</strong> items? All public links will stop working.`,
          callback: (confirmed) => {
            if (confirmed) this.unshareAll()
          },
          type: 'yesNo'
        })
      })
    },
    async unshareAll() {
      const ids = this.shares.map((s) => s.id)
      for (const id of ids) {
        try {
          await this.$axios.$delete(`/api/share/mediaitem/${id}`)
        } catch (error) {
          console.error(`Failed to unshare ${id}`, error)
        }
      }
      this.shares = []
      this.$toast.success('All items unshared')
    },
    shareOpened() {
      // Re-fetch to get enriched metadata
      this.fetchShares()
    },
    shareClosed(data) {
      this.shares = this.shares.filter((s) => s.id !== data.id)
    }
  },
  mounted() {
    this.fetchShares()
    this.$root.socket.on('share_open', this.shareOpened)
    this.$root.socket.on('share_closed', this.shareClosed)
  },
  beforeDestroy() {
    this.$root.socket.off('share_open', this.shareOpened)
    this.$root.socket.off('share_closed', this.shareClosed)
  }
}
</script>
