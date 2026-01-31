<template>
  <div id="page-wrapper" class="bg-bg page overflow-y-auto p-4 md:p-8" :class="streamLibraryItem ? 'streaming' : ''">
    <div>
      <!-- Series Header -->
      <div class="flex flex-wrap sm:flex-nowrap justify-center sm:justify-start mb-6">
        <div class="w-32 min-w-32">
          <div class="w-full h-40">
            <covers-preview-cover :src="seriesCoverUrl" :width="128" :book-cover-aspect-ratio="bookCoverAspectRatio" />
          </div>
        </div>
        <div class="grow py-4 sm:py-0 px-4 md:px-8">
          <div class="flex items-center mb-4">
            <h1 class="text-2xl">{{ series.name }}</h1>

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
      isLoadingSearch: false
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
      // Use first book's cover
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
    isSeriesRemovedFromContinueListening() {
      return this.$store.getters['user/getIsSeriesRemovedFromContinueListening'](this.seriesId)
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
    seriesUpdated(series) {
      if (series.id === this.seriesId) {
        // Refresh to get updated items
        this.fetchSeriesData()
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
    this.$root.socket.on('rss_feed_open', this.rssFeedOpen)
    this.$root.socket.on('rss_feed_closed', this.rssFeedClosed)
    this.$eventBus.$on('bookshelf_clear_selection', this.clearSelectedEntities)
    this.$eventBus.$on('bookshelf_select_all', this.selectAllEntities)
  },
  beforeDestroy() {
    this.$root.socket.off('series_updated', this.seriesUpdated)
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
