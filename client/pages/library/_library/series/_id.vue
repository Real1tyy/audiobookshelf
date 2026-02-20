<template>
  <div id="page-wrapper" class="bg-bg page overflow-y-auto p-4 md:p-8" :class="streamLibraryItem ? 'streaming' : ''">
    <div>
      <!-- Series Header -->
      <div class="flex flex-wrap sm:flex-nowrap justify-center sm:justify-start mb-6">
        <div class="w-32 min-w-32 relative">
          <div class="w-full h-40">
            <covers-preview-cover :src="seriesCoverUrl" :width="128" :book-cover-aspect-ratio="bookCoverAspectRatio" />
          </div>
          <!-- Play button overlay -->
          <div v-if="hasPlayableBooks" class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer rounded" @click="playSeries">
            <span class="material-symbols fill text-white text-5xl">play_arrow</span>
          </div>
        </div>
        <div class="grow py-4 sm:py-0 px-4 md:px-8">
          <div class="flex items-center mb-4">
            <h1 class="text-2xl">{{ series.name }}</h1>

            <!-- Play button -->
            <ui-btn v-if="hasPlayableBooks" color="bg-success" :padding-x="4" small class="flex items-center h-9 mx-4" @click="playSeries">
              <span class="material-symbols fill text-xl -ml-1 pr-1 text-white">play_arrow</span>
              {{ $strings.ButtonPlay }}
            </ui-btn>

            <!-- Download All button -->
            <ui-btn v-if="libraryItems.length" color="bg-info" :padding-x="4" small class="flex items-center h-9" :loading="downloadingSeries" @click="downloadAllSeries">
              <span class="material-symbols text-xl -ml-1 pr-1 text-white">cloud_download</span>
              {{ downloadProgressText }}
            </ui-btn>

            <!-- Edit button -->
            <button v-if="userCanUpdate" class="w-8 h-8 rounded-full flex items-center justify-center mx-2 cursor-pointer text-gray-300 hover:text-warning transform hover:scale-125 duration-100" @click="editSeries">
              <span class="material-symbols text-base">edit</span>
            </button>

            <!-- Delete button -->
            <button v-if="userCanDelete" class="w-8 h-8 rounded-full flex items-center justify-center mx-2 cursor-pointer text-gray-300 hover:text-error transform hover:scale-125 duration-100 relative z-10" style="pointer-events: auto" @click.stop.prevent="deleteSeries">
              <span class="material-symbols text-base">delete</span>
            </button>

            <!-- RSS feed button -->
            <ui-tooltip v-if="seriesRssFeed" :text="$strings.LabelOpenRSSFeed" direction="bottom">
              <ui-icon-btn icon="rss_feed" class="mx-2" :size="7" icon-font-size="1.2rem" bg-color="bg-success" outlined @click="showOpenSeriesRSSFeed" />
            </ui-tooltip>

            <!-- Context menu -->
            <ui-context-menu-dropdown v-if="contextMenuItems.length" :items="contextMenuItems" class="mx-px" @action="contextMenuAction" />
          </div>

          <p v-if="series.description" class="text-white/60 uppercase text-xs mb-2">{{ $strings.LabelDescription }}</p>
          <p v-if="series.description" class="text-white max-w-3xl text-base whitespace-pre-wrap">{{ series.description }}</p>

          <!-- Series Progress -->
          <div v-if="seriesProgress" class="mt-4 flex items-center gap-4">
            <div class="flex items-center">
              <span class="material-symbols text-xl text-white/60 mr-2">auto_stories</span>
              <p class="text-sm">{{ seriesProgress.libraryItemIdsFinished.length }} / {{ seriesProgress.libraryItemIds.length }} {{ $strings.LabelStatsItemsFinished }}</p>
            </div>
            <div v-if="seriesProgress.isFinished" class="flex items-center text-success">
              <span class="material-symbols text-xl mr-1">check_circle</span>
              <p class="text-sm">{{ $strings.LabelFinished }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Books Toolbar -->
      <app-series-books-toolbar :series-name="series.name" :total-books="filteredLibraryItems.length" :initial-search="searchQuery" :initial-filter="filterBy" :initial-sort="sortBy" :initial-sort-desc="sortDesc" @change="onToolbarChange" />

      <!-- Books Gallery -->
      <div class="py-4">
        <div class="flex flex-wrap">
          <div v-for="item in filteredLibraryItems" :key="item.id" class="p-2 relative" :style="{ width: cardWidth + 'px', height: cardHeight + 'px' }">
            <cards-lazy-book-card :ref="`book-card-${item.id}`" :book-mount="item" :bookshelf-view="$constants.BookshelfView.AUTHOR" :height="bookCoverHeight" @edit="editItem" @select="selectItem" />
          </div>
        </div>
        <div v-if="!filteredLibraryItems.length" class="flex h-32 items-center justify-center text-center px-2">
          <p class="text-xl text-white/60">{{ $strings.MessageNoItems }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, redirect, query, app }) {
    const libraryId = params.library
    const libraryData = await store.dispatch('libraries/fetch', libraryId)
    if (!libraryData) {
      return redirect('/oops?message=Library not found')
    }

    const library = libraryData.library
    if (library.mediaType === 'podcast') {
      return redirect(`/library/${libraryId}`)
    }

    // Parse query params
    const searchQuery = query.search || ''
    const filterBy = query.filter || 'all'
    const sortBy = query.sort || 'sequence'
    const sortDesc = query.desc === '1' ? true : false

    // Build query params
    const queryParams = new URLSearchParams()
    queryParams.append('include', 'items,progress,rssfeed')
    if (searchQuery) queryParams.append('search', searchQuery)
    if (filterBy !== 'all') queryParams.append('filter', filterBy)
    if (sortBy !== 'sequence') queryParams.append('sort', sortBy)
    queryParams.append('desc', sortDesc ? '1' : '0')

    const series = await app.$axios.$get(`/api/libraries/${library.id}/series/${params.id}?${queryParams.toString()}`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!series) {
      return redirect('/oops?message=Series not found')
    }

    return {
      series,
      seriesId: params.id,
      searchQuery,
      filterBy,
      sortBy,
      sortDesc
    }
  },
  data() {
    return {
      isSelectionMode: false,
      searchQuery: '',
      filterBy: 'all',
      sortBy: 'sequence',
      sortDesc: false,
      isLoadingSearch: false,
      downloadingSeries: false,
      downloadedCount: 0,
      downloadTotal: 0
    }
  },
  watch: {
    selectedMediaItems: {
      handler(newVal) {
        const newIsSelectionMode = !!newVal.length
        if (this.isSelectionMode !== newIsSelectionMode) {
          this.isSelectionMode = newIsSelectionMode
          this.updateBookSelectionMode(newIsSelectionMode)
        }
      }
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    libraryItems() {
      return this.series.libraryItems || []
    },
    filteredLibraryItems() {
      return this.libraryItems
    },
    seriesProgress() {
      return this.series.progress || null
    },
    seriesRssFeed() {
      return this.series.rssFeed || null
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    sizeMultiplier() {
      return this.$store.getters['user/getSizeMultiplier']
    },
    bookCoverHeight() {
      return 160
    },
    coverHeight() {
      return this.bookCoverHeight * this.sizeMultiplier
    },
    cardWidth() {
      return this.coverHeight / this.bookCoverAspectRatio
    },
    cardHeight() {
      return this.coverHeight + 64
    },
    selectedMediaItems() {
      return this.$store.state.globals.selectedMediaItems || []
    },
    seriesCoverUrl() {
      // Use series cover if available, otherwise fall back to first book's cover
      if (this.series.coverPath) {
        const basePath = this.$config.routerBasePath === '/' ? '' : this.$config.routerBasePath
        return `${basePath}/api/series/${this.series.id}/cover?ts=${this.series.updatedAt}`
      }
      if (this.libraryItems.length) {
        const firstItem = this.libraryItems[0]
        // Use getLibraryItemCoverSrc which handles both libraryItemId and id properties
        return this.$store.getters['globals/getLibraryItemCoverSrc'](firstItem)
      }
      return null
    },
    isSeriesFinished() {
      return this.seriesProgress && !!this.seriesProgress.isFinished
    },
    hasPlayableBooks() {
      return this.playableBooks.length > 0
    },
    playableBooks() {
      // Get books that have audio tracks, sorted by sequence
      return this.libraryItems
        .filter((item) => {
          const numTracks = item.media?.numTracks || item.media?.tracks?.length || 0
          return numTracks > 0
        })
        .sort((a, b) => {
          const seqA = a.sequence || ''
          const seqB = b.sequence || ''
          if (!seqA && !seqB) return 0
          if (!seqA) return 1
          if (!seqB) return -1
          return String(seqA).localeCompare(String(seqB), undefined, { numeric: true })
        })
    },
    isSeriesRemovedFromContinueListening() {
      return this.$store.getters['user/getIsSeriesRemovedFromContinueListening'](this.seriesId)
    },
    downloadProgressText() {
      if (this.downloadingSeries) {
        return `Downloading ${this.downloadedCount}/${this.downloadTotal}...`
      }
      return 'Download All'
    },
    contextMenuItems() {
      const items = [
        {
          text: this.isSeriesFinished ? this.$strings.MessageMarkAsNotFinished : this.$strings.MessageMarkAsFinished,
          action: 'mark-series-finished'
        }
      ]

      if (this.userIsAdminOrUp || this.seriesRssFeed) {
        items.push({
          text: this.$strings.LabelOpenRSSFeed,
          action: 'open-rss-feed'
        })
      }

      if (this.isSeriesRemovedFromContinueListening) {
        items.push({
          text: this.$strings.LabelReAddSeriesToContinueListening,
          action: 're-add-to-continue-listening'
        })
      }

      return items
    }
  },
  methods: {
    async onToolbarChange({ search, filter, sort, desc }) {
      const currentQuery = this.$route.query
      const hasChanged = search !== (currentQuery.search || '') || filter !== (currentQuery.filter || 'all') || sort !== (currentQuery.sort || 'sequence') || desc !== (currentQuery.desc === '1' ? true : false)

      if (!hasChanged) return

      // Update local state
      this.searchQuery = search
      this.filterBy = filter
      this.sortBy = sort
      this.sortDesc = desc

      // Build new query params
      const query = {}
      if (search) query.search = search
      if (filter !== 'all') query.filter = filter
      if (sort !== 'sequence') query.sort = sort
      query.desc = desc ? '1' : '0'

      // Update URL without reloading page
      this.$router.replace({ query })

      // Fetch updated series data
      await this.fetchSeriesData()
    },
    async fetchSeriesData() {
      this.isLoadingSearch = true
      try {
        // Build query params
        const queryParams = new URLSearchParams()
        queryParams.append('include', 'items,progress,rssfeed')
        if (this.searchQuery) queryParams.append('search', this.searchQuery)
        if (this.filterBy !== 'all') queryParams.append('filter', this.filterBy)
        if (this.sortBy !== 'sequence') queryParams.append('sort', this.sortBy)
        queryParams.append('desc', this.sortDesc ? '1' : '0')

        const series = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/series/${this.seriesId}?${queryParams.toString()}`)

        if (series) {
          this.series = series
          // Clear selection when filters change
          this.$store.commit('globals/resetSelectedMediaItems')
          this.isSelectionMode = false
          this.updateBookSelectionMode(false)
        }
      } catch (error) {
        console.error('Failed to fetch series data', error)
        this.$toast.error('Failed to update books')
      } finally {
        this.isLoadingSearch = false
      }
    },
    async downloadAllSeries() {
      if (this.downloadingSeries) return
      this.downloadingSeries = true

      const token = this.$store.getters['user/getToken']
      const items = this.libraryItems
      this.downloadTotal = items.length
      this.downloadedCount = 0

      for (const item of items) {
        const itemId = item.id
        if (this.$store.getters['offline/isDownloaded'](itemId) || this.$store.getters['offline/isDownloading'](itemId)) {
          this.downloadedCount++
          continue
        }
        try {
          await this.$store.dispatch('offline/downloadItem', { libraryItem: item, token })
        } catch (e) {
          console.error('[Series] Failed to download item', itemId, e)
        }
        this.downloadedCount++
      }

      this.downloadingSeries = false
      this.$toast.success(`Downloaded ${this.downloadedCount} of ${this.downloadTotal} items for offline use`)
    },
    editSeries() {
      this.$store.commit('globals/showEditSeriesModal', this.series)
    },
    playSeries() {
      if (!this.playableBooks.length) return

      // Build queue items from all playable books in sequence order
      const queueItems = this.playableBooks.map((item) => {
        const authors = item.media?.metadata?.authors || []
        return {
          libraryItemId: item.id,
          libraryId: item.libraryId,
          episodeId: null,
          title: item.media?.metadata?.title || 'Unknown',
          subtitle: authors.map((a) => a.name).join(', '),
          caption: this.series.name,
          duration: item.media?.duration || null,
          coverPath: item.media?.coverPath || null
        }
      })

      // Play the first item and set the queue
      this.$eventBus.$emit('play-item', {
        libraryItemId: queueItems[0].libraryItemId,
        episodeId: null,
        queueItems
      })
    },
    editItem(libraryItem) {
      const itemIds = this.filteredLibraryItems.map((e) => e.id)
      this.$store.commit('setBookshelfBookIds', itemIds)
      this.$store.commit('showEditModalOnTab', { libraryItem, tab: 'details' })
    },
    getMediaItemFromEntity(entity) {
      return {
        id: entity.id,
        mediaType: entity.mediaType,
        hasTracks: entity.mediaType === 'podcast' || entity.media?.audioFile || entity.media?.numTracks || (entity.media?.tracks && entity.media.tracks.length)
      }
    },
    getBookCardRef(itemId) {
      const ref = this.$refs[`book-card-${itemId}`]
      return ref?.[0] ?? null
    },
    selectItem({ entity, shiftKey }) {
      this.$store.commit('globals/toggleMediaItemSelected', this.getMediaItemFromEntity(entity))

      const newIsSelectionMode = !!this.selectedMediaItems.length
      if (this.isSelectionMode !== newIsSelectionMode) {
        this.isSelectionMode = newIsSelectionMode
        this.updateBookSelectionMode(newIsSelectionMode)
      }
    },
    clearSelectedEntities() {
      this.isSelectionMode = false
      this.updateBookSelectionMode(false)
    },
    updateBookSelectionMode(isSelectionMode) {
      this.filteredLibraryItems.forEach((item) => {
        const cardRef = this.getBookCardRef(item.id)
        if (cardRef) {
          cardRef.setSelectionMode(isSelectionMode)
          if (!isSelectionMode) {
            cardRef.selected = false
          }
        }
      })
    },
    selectAllEntities() {
      this.filteredLibraryItems.forEach((entity) => {
        if (!entity) return
        const isAlreadySelected = this.selectedMediaItems.some((item) => item.id === entity.id)
        if (!isAlreadySelected) {
          this.$store.commit('globals/setMediaItemSelected', { item: this.getMediaItemFromEntity(entity), selected: true })
        }
        const cardRef = this.getBookCardRef(entity.id)
        if (cardRef) {
          cardRef.selected = true
        }
      })

      if (!this.isSelectionMode && this.selectedMediaItems.length) {
        this.isSelectionMode = true
        this.updateBookSelectionMode(true)
      }
    },
    showOpenSeriesRSSFeed() {
      this.$store.commit('globals/setRSSFeedOpenCloseModal', {
        id: this.series.id,
        name: this.series.name,
        type: 'series',
        feed: this.seriesRssFeed
      })
    },
    contextMenuAction({ action }) {
      if (action === 'open-rss-feed') {
        this.showOpenSeriesRSSFeed()
      } else if (action === 're-add-to-continue-listening') {
        this.reAddSeriesToContinueListening()
      } else if (action === 'mark-series-finished') {
        this.markSeriesFinished()
      }
    },
    reAddSeriesToContinueListening() {
      this.$axios
        .$get(`/api/me/series/${this.seriesId}/readd-to-continue-listening`)
        .then(() => {
          this.$toast.success(this.$strings.ToastItemUpdateSuccess)
        })
        .catch((error) => {
          console.error('Failed to re-add series to continue listening', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
        })
    },
    markSeriesFinished() {
      const newIsFinished = !this.isSeriesFinished

      const payload = {
        message: newIsFinished ? this.$strings.MessageConfirmMarkSeriesFinished : this.$strings.MessageConfirmMarkSeriesNotFinished,
        callback: (confirmed) => {
          if (confirmed) {
            const updateProgressPayloads = this.seriesProgress.libraryItemIds.map((lid) => {
              return {
                libraryItemId: lid,
                isFinished: newIsFinished
              }
            })
            this.$axios
              .patch(`/api/me/progress/batch/update`, updateProgressPayloads)
              .then(() => {
                this.$toast.success(this.$strings.ToastSeriesUpdateSuccess)
                this.series.progress.isFinished = newIsFinished
              })
              .catch((error) => {
                this.$toast.error(this.$strings.ToastSeriesUpdateFailed)
                console.error('Failed to batch update read/not read', error)
              })
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    deleteSeries() {
      const payload = {
        message: this.$strings.MessageConfirmRemoveSeries.replace('{0}', this.series.name),
        callback: (confirmed) => {
          if (confirmed) {
            this.$axios
              .$delete(`/api/series/${this.seriesId}`)
              .then(() => {
                this.$toast.success(this.$strings.ToastSeriesRemoveSuccess)
                // Redirect to library page
                this.$router.push(`/library/${this.currentLibraryId}`)
              })
              .catch((error) => {
                console.error('Failed to delete series', error)
                this.$toast.error(this.$strings.ToastSeriesRemoveFailed)
              })
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    seriesUpdated(series) {
      if (series.id === this.seriesId) {
        // Refresh to get updated items
        this.fetchSeriesData()
      }
    },
    seriesRemoved(series) {
      if (series.id === this.seriesId) {
        // Series was deleted, redirect to library
        this.$toast.info(this.$strings.ToastSeriesRemoveSuccess)
        this.$router.push(`/library/${this.currentLibraryId}`)
      }
    },
    rssFeedOpen(data) {
      if (data.entityId === this.seriesId) {
        this.series.rssFeed = data
      }
    },
    rssFeedClosed(data) {
      if (data.entityId === this.seriesId) {
        this.series.rssFeed = null
      }
    }
  },
  mounted() {
    // Initialize from URL or asyncData
    this.searchQuery = this.$route.query.search || ''
    this.filterBy = this.$route.query.filter || 'all'
    this.sortBy = this.$route.query.sort || 'sequence'
    this.sortDesc = this.$route.query.desc === '1' ? true : false

    this.$root.socket.on('series_updated', this.seriesUpdated)
    this.$root.socket.on('series_removed', this.seriesRemoved)
    this.$root.socket.on('rss_feed_open', this.rssFeedOpen)
    this.$root.socket.on('rss_feed_closed', this.rssFeedClosed)
    this.$eventBus.$on('bookshelf_clear_selection', this.clearSelectedEntities)
    this.$eventBus.$on('bookshelf_select_all', this.selectAllEntities)
  },
  beforeDestroy() {
    this.$root.socket.off('series_updated', this.seriesUpdated)
    this.$root.socket.off('series_removed', this.seriesRemoved)
    this.$root.socket.off('rss_feed_open', this.rssFeedOpen)
    this.$root.socket.off('rss_feed_closed', this.rssFeedClosed)
    this.$eventBus.$off('bookshelf_clear_selection', this.clearSelectedEntities)
    this.$eventBus.$off('bookshelf_select_all', this.selectAllEntities)
  }
}
</script>

<style scoped>
#page-wrapper {
  max-height: calc(100vh - 64px);
}
#page-wrapper.streaming {
  max-height: calc(100vh - 64px - 165px);
}
</style>
