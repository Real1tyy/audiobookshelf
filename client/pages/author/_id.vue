<template>
  <div id="page-wrapper" class="bg-bg page overflow-y-auto p-4 md:p-8" :class="streamLibraryItem ? 'streaming' : ''">
    <div>
      <!-- Author Header -->
      <div class="flex flex-wrap sm:flex-nowrap justify-center sm:justify-start mb-6">
        <div class="w-32 min-w-32">
          <div class="w-full h-40">
            <covers-author-image :author="author" rounded-sm="0" />
          </div>
        </div>
        <div class="grow py-4 sm:py-0 px-4 md:px-8">
          <div class="flex items-center mb-8">
            <h1 class="text-2xl">{{ author.name }}</h1>

            <button v-if="userCanUpdate" class="w-8 h-8 rounded-full flex items-center justify-center mx-4 cursor-pointer text-gray-300 hover:text-warning transform hover:scale-125 duration-100" @click="editAuthor">
              <span class="material-symbols text-base">edit</span>
            </button>
          </div>

          <p v-if="author.description" class="text-white/60 uppercase text-xs mb-2">{{ $strings.LabelDescription }}</p>
          <p ref="description" id="author-description" class="text-white max-w-3xl text-base whitespace-pre-wrap" :class="{ 'show-full': showFullDescription }">{{ author.description }}</p>
          <button v-if="isDescriptionClamped" class="py-0.5 flex items-center text-slate-300 hover:text-white" @click="showFullDescription = !showFullDescription">
            {{ showFullDescription ? $strings.ButtonReadLess : $strings.ButtonReadMore }} <span class="material-symbols text-xl pl-1">{{ showFullDescription ? 'expand_less' : 'expand_more' }}</span>
          </button>
        </div>
      </div>

      <!-- Author Stats Section (Collapsible) -->
      <div v-if="authorStats" class="mb-6 bg-primary/30 rounded-lg overflow-hidden">
        <button class="w-full flex items-center justify-between p-4 hover:bg-primary/40 transition-colors" @click="showAuthorStats = !showAuthorStats">
          <h2 class="text-lg text-white/80">{{ $strings.HeaderYourStats }}</h2>
          <span class="material-symbols text-2xl text-white/60 transition-transform" :class="{ 'rotate-180': showAuthorStats }">expand_more</span>
        </button>
        <transition name="slide">
          <div v-show="showAuthorStats" class="px-4 pb-4">
            <div class="flex flex-wrap justify-center sm:justify-start gap-6 mb-4">
              <div class="flex items-center">
                <span class="material-symbols text-3xl text-white/60 mr-2">auto_stories</span>
                <div>
                  <p class="text-2xl font-bold">{{ authorStats.booksFinished }} / {{ authorStats.totalBooks }}</p>
                  <p class="text-xs text-white/60">{{ $strings.LabelStatsItemsFinished }}</p>
                </div>
              </div>
              <div class="flex items-center">
                <span class="material-symbols text-3xl text-white/60 mr-2">watch_later</span>
                <div>
                  <p class="text-2xl font-bold">{{ $elapsedPretty(authorStats.totalTime) }}</p>
                  <p class="text-xs text-white/60">{{ $strings.LabelTimeListened }}</p>
                </div>
              </div>
              <div class="flex items-center">
                <span class="material-symbols text-3xl text-white/60 mr-2">event</span>
                <div>
                  <p class="text-2xl font-bold">{{ totalDaysListened }}</p>
                  <p class="text-xs text-white/60">{{ $strings.LabelStatsDaysListened }}</p>
                </div>
              </div>
            </div>
            <div v-if="authorStats.recentSessions && authorStats.recentSessions.length">
              <p class="text-sm text-white/60 mb-3">{{ $strings.HeaderStatsRecentSessions }}</p>
              <div class="space-y-2">
                <div
                  v-for="session in authorStats.recentSessions.slice(0, 5)"
                  :key="session.id"
                  class="flex items-center bg-primary/50 hover:bg-primary/70 rounded-lg p-3 transition-colors"
                >
                  <button class="w-10 h-10 flex items-center justify-center bg-success hover:bg-success/80 rounded-full mr-3 flex-shrink-0 transition-colors" @click="playSession(session)">
                    <span class="material-symbols text-white text-xl">play_arrow</span>
                  </button>
                  <nuxt-link :to="`/item/${session.libraryItemId}`" class="flex-grow min-w-0 mr-3 hover:underline">
                    <p class="text-sm text-white truncate">{{ session.displayTitle }}</p>
                    <p class="text-xs text-white/50">{{ $dateDistanceFromNow(session.updatedAt) }}</p>
                  </nuxt-link>
                  <div class="flex-shrink-0 text-right">
                    <p class="text-sm font-semibold text-white">{{ $elapsedPretty(session.timeListening) }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- Books Gallery -->
      <div class="py-4">
        <app-books-toolbar :total-books="filteredLibraryItems.length" :initial-search="searchQuery" :initial-filter="filterBy" :initial-sort="sortBy" :initial-sort-desc="sortDesc" @change="onToolbarChange" />
        <div class="flex flex-wrap mt-4">
          <div v-for="item in filteredLibraryItems" :key="item.id" class="p-2 relative" :style="{ width: cardWidth + 'px', height: cardHeight + 'px' }">
            <cards-lazy-book-card :ref="`book-card-${item.id}`" :book-mount="item" :bookshelf-view="$constants.BookshelfView.AUTHOR" :height="bookCoverHeight" @edit="editItem" @select="selectItem" />
          </div>
        </div>
      </div>

      <!-- Series Galleries -->
      <div v-for="series in authorSeries" :key="series.id" class="py-4">
        <div class="flex items-center mb-4">
          <nuxt-link :to="`/library/${currentLibraryId}/series/${series.id}`" class="hover:underline">
            <h2 class="text-lg">{{ series.name }}</h2>
          </nuxt-link>
          <p class="text-white/40 text-base px-2">{{ $strings.LabelSeries }}</p>
        </div>
        <div class="flex flex-wrap">
          <div v-for="item in series.items" :key="item.id" class="p-2 relative" :style="{ width: cardWidth + 'px', height: cardHeight + 'px' }">
            <cards-lazy-book-card :ref="`book-card-${item.id}`" :book-mount="item" :bookshelf-view="$constants.BookshelfView.AUTHOR" :height="bookCoverHeight" @edit="editItem" @select="selectItem" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, app, params, redirect, query }) {
    const searchQuery = query.search || ''
    const filterBy = query.filter || 'all'
    const sortBy = query.sort || 'addedAt'
    const sortDesc = query.desc === '0' ? false : true

    // Build query params
    const queryParams = new URLSearchParams()
    queryParams.append('include', 'items,series')
    if (searchQuery) queryParams.append('search', searchQuery)
    if (filterBy !== 'all') queryParams.append('filter', filterBy)
    if (sortBy !== 'addedAt') queryParams.append('sort', sortBy)
    queryParams.append('desc', sortDesc ? '1' : '0')

    const author = await app.$axios.$get(`/api/authors/${params.id}?${queryParams.toString()}`).catch((error) => {
      console.error('Failed to get author', error)
      return null
    })

    if (!author) {
      return redirect(`/library/${store.state.libraries.currentLibraryId}/bookshelf/authors`)
    }

    if (store.state.libraries.currentLibraryId !== author.libraryId || !store.state.libraries.filterData) {
      await store.dispatch('libraries/fetch', author.libraryId)
    }

    return {
      author,
      searchQuery,
      filterBy,
      sortBy,
      sortDesc
    }
  },
  data() {
    return {
      isDescriptionClamped: false,
      showFullDescription: false,
      isSelectionMode: false,
      searchQuery: '',
      filterBy: 'all',
      sortBy: 'addedAt',
      sortDesc: true,
      isLoadingSearch: false,
      authorStats: null,
      showAuthorStats: false
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
      return this.author.libraryItems || []
    },
    filteredLibraryItems() {
      // Client-side filtering is only used for display
      // The actual data comes from the backend filtered by search query
      return this.libraryItems
    },
    authorSeries() {
      return this.author.series || []
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
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
      // Cover height + space for title/author text below (approximately 4em = 64px)
      return this.coverHeight + 64
    },
    selectedMediaItems() {
      return this.$store.state.globals.selectedMediaItems || []
    },
    allItems() {
      // Flatten all library items and series items for selection
      const items = [...this.filteredLibraryItems]
      this.authorSeries.forEach((series) => {
        series.items.forEach((item) => {
          if (!items.find((i) => i.id === item.id)) {
            items.push(item)
          }
        })
      })
      return items
    },
    totalDaysListened() {
      if (!this.authorStats?.days) return 0
      return Object.keys(this.authorStats.days).length
    }
  },
  methods: {
    checkDescriptionClamped() {
      if (!this.$refs.description) return
      this.isDescriptionClamped = this.$refs.description.scrollHeight > this.$refs.description.clientHeight
    },
    editAuthor() {
      this.$store.commit('globals/showEditAuthorModal', this.author)
    },
    editItem(libraryItem) {
      const itemIds = this.filteredLibraryItems.map((e) => e.id)
      this.$store.commit('setBookshelfBookIds', itemIds)
      this.$store.commit('showEditModalOnTab', { libraryItem, tab: 'details' })
    },
    async onToolbarChange({ search, filter, sort, desc }) {
      const currentQuery = this.$route.query
      const hasChanged = search !== (currentQuery.search || '') || filter !== (currentQuery.filter || 'all') || sort !== (currentQuery.sort || 'addedAt') || desc !== (currentQuery.desc === '0' ? false : true)

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
      if (sort !== 'addedAt') query.sort = sort
      query.desc = desc ? '1' : '0'

      // Update URL without reloading page
      this.$router.replace({ query })

      // Fetch updated author data
      await this.fetchAuthorData()
    },
    async fetchAuthorData() {
      this.isLoadingSearch = true
      try {
        // Build query params
        const queryParams = new URLSearchParams()
        queryParams.append('include', 'items,series')
        if (this.searchQuery) queryParams.append('search', this.searchQuery)
        if (this.filterBy !== 'all') queryParams.append('filter', this.filterBy)
        if (this.sortBy !== 'addedAt') queryParams.append('sort', this.sortBy)
        queryParams.append('desc', this.sortDesc ? '1' : '0')

        const author = await this.$axios.$get(`/api/authors/${this.$route.params.id}?${queryParams.toString()}`)

        if (author) {
          this.author = author
          // Clear selection when filters change
          this.$store.commit('globals/resetSelectedMediaItems')
          this.isSelectionMode = false
          this.updateBookSelectionMode(false)
        }
      } catch (error) {
        console.error('Failed to fetch author data', error)
        this.$toast.error('Failed to update books')
      } finally {
        this.isLoadingSearch = false
      }
    },
    authorUpdated(author) {
      if (author.id === this.author.id) {
        console.log('Author was updated', author)
        this.author = {
          ...author,
          series: this.authorSeries,
          libraryItems: this.libraryItems
        }
        this.$nextTick(this.checkDescriptionClamped)
      }
    },
    authorRemoved(author) {
      if (author.id === this.author.id) {
        console.warn('Author was removed')
        this.$router.replace(`/library/${this.currentLibraryId}/bookshelf/authors`)
      }
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
      this.allItems.forEach((item) => {
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
      this.allItems.forEach((entity) => {
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
    async fetchAuthorStats() {
      try {
        this.authorStats = await this.$axios.$get(`/api/authors/${this.author.id}/listening-stats`)
      } catch (error) {
        console.error('Failed to fetch author stats', error)
        this.authorStats = null
      }
    },
    playSession(session) {
      this.$eventBus.$emit('play-item', {
        libraryItemId: session.libraryItemId,
        episodeId: session.episodeId || null
      })
    }
  },
  mounted() {
    if (!this.author) this.$router.replace('/')
    this.checkDescriptionClamped()

    // Initialize from URL or asyncData
    this.searchQuery = this.$route.query.search || ''
    this.filterBy = this.$route.query.filter || 'all'
    this.sortBy = this.$route.query.sort || 'addedAt'
    this.sortDesc = this.$route.query.desc === '0' ? false : true

    // Fetch author-specific listening stats
    this.fetchAuthorStats()

    this.$root.socket.on('author_updated', this.authorUpdated)
    this.$root.socket.on('author_removed', this.authorRemoved)
    this.$eventBus.$on('bookshelf_clear_selection', this.clearSelectedEntities)
    this.$eventBus.$on('bookshelf_select_all', this.selectAllEntities)
  },
  beforeDestroy() {
    this.$root.socket.off('author_updated', this.authorUpdated)
    this.$root.socket.off('author_removed', this.authorRemoved)
    this.$eventBus.$off('bookshelf_clear_selection', this.clearSelectedEntities)
    this.$eventBus.$off('bookshelf_select_all', this.selectAllEntities)
  }
}
</script>

<style scoped>
#author-description {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  max-height: 6.25rem;
  transition: all 0.3s ease-in-out;
}
#author-description.show-full {
  -webkit-line-clamp: unset;
  max-height: 999rem;
}
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
  overflow: hidden;
}
.slide-enter,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
