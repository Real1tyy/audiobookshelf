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

            <!-- Play All Button -->
            <button v-if="hasPlayableBooks" class="flex items-center px-3 py-1.5 rounded-full bg-success hover:bg-success/80 text-white transition-colors" @click="playAll">
              <span class="material-symbols text-lg mr-1">play_arrow</span>
              <span class="text-sm font-medium">{{ $strings.LabelPlayAll || 'Play All' }}</span>
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
                <div v-for="session in authorStats.recentSessions.slice(0, 5)" :key="session.id" class="flex items-center bg-primary/50 hover:bg-primary/70 rounded-lg p-3 transition-colors">
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

            <div v-if="authorStats.global" class="mt-6">
              <div class="flex items-center cursor-pointer mb-3" @click="showGlobalStats = !showGlobalStats">
                <p class="text-sm text-white/60">{{ $strings.HeaderLibraryStats || 'Library Stats (All Users)' }}</p>
                <span class="material-symbols text-xl text-white/60 ml-2">{{ showGlobalStats ? 'expand_less' : 'expand_more' }}</span>
              </div>

              <transition name="slide" mode="out-in">
                <div v-if="showGlobalStats">
                  <div class="flex flex-wrap justify-center gap-6 mb-4">
                    <div class="flex items-center">
                      <span class="material-symbols text-3xl text-white/60 mr-2">done_all</span>
                      <div>
                        <p class="text-2xl font-bold">{{ $formatNumber(authorStats.global.totalBooksDone || 0) }}</p>
                        <p class="text-xs text-white/60">{{ $strings.LabelStatsItemsFinished || 'Books marked done' }}</p>
                      </div>
                    </div>
                    <div class="flex items-center">
                      <span class="material-symbols text-3xl text-white/60 mr-2">visibility</span>
                      <div>
                        <p class="text-2xl font-bold">{{ $formatNumber(authorStats.global.totalViewedCount || 0) }}</p>
                        <p class="text-xs text-white/60">{{ $strings.LabelStatsViews || 'Total viewed count' }}</p>
                      </div>
                    </div>
                    <div class="flex items-center">
                      <span class="material-symbols text-3xl text-white/60 mr-2">watch_later</span>
                      <div>
                        <p class="text-2xl font-bold">{{ $elapsedPretty(authorStats.global.listeningStats?.totalTime || 0) }}</p>
                        <p class="text-xs text-white/60">{{ $strings.LabelTimeListened || 'Time listened' }}</p>
                      </div>
                    </div>
                    <div class="flex items-center">
                      <span class="material-symbols text-3xl text-white/60 mr-2">star</span>
                      <div>
                        <p class="text-2xl font-bold">{{ averageRatingDisplay }}</p>
                        <p class="text-xs text-white/60">{{ $strings.LabelAverageRating || 'Average rating' }}</p>
                      </div>
                    </div>
                  </div>

                  <div v-if="authorStats.global.listeningStats" class="mb-4">
                    <div class="max-w-full overflow-x-auto">
                      <stats-daily-listening-chart :listening-stats="authorStats.global.listeningStats" />
                    </div>
                  </div>

                  <div class="flex flex-col xl:flex-row flex-wrap justify-between gap-4 mt-4">
                    <div class="flex-1 min-w-[200px]">
                      <h1 class="text-xl mb-3">{{ $strings.HeaderTopTags || 'Top 5 Tags' }}</h1>
                      <p v-if="!topTags.length" class="text-sm text-white/60">{{ $strings.MessageNoTags || 'No tags' }}</p>
                      <div v-for="tag in topTags.slice(0, 5)" :key="tag.tag" class="w-full py-1.5">
                        <div class="flex items-end mb-1">
                          <p class="text-lg font-bold">{{ Math.round((100 * tag.count) / Math.max(1, authorStats.totalBooks)) }}%</p>
                          <div class="grow" />
                          <nuxt-link :to="`/library/${currentLibraryId}/bookshelf?filter=tags.${$encode(tag.tag)}`" class="text-sm text-white/70 hover:underline truncate max-w-[120px]">
                            {{ tag.tag }}
                          </nuxt-link>
                        </div>
                        <div class="w-full rounded-full h-2 bg-primary/50 overflow-hidden">
                          <div class="bg-yellow-400 h-full rounded-full" :style="{ width: Math.round((100 * tag.count) / Math.max(1, authorStats.totalBooks)) + '%' }" />
                        </div>
                      </div>
                    </div>

                    <div class="flex-1 min-w-[200px]">
                      <h1 class="text-xl mb-3">{{ $strings.HeaderStatsTop5Genres || 'Top 5 Genres' }}</h1>
                      <p v-if="!topGenres.length" class="text-sm text-white/60">{{ $strings.MessageNoGenres || 'No genres' }}</p>
                      <div v-for="genre in topGenres.slice(0, 5)" :key="genre.genre" class="w-full py-1.5">
                        <div class="flex items-end mb-1">
                          <p class="text-lg font-bold">{{ Math.round((100 * genre.count) / Math.max(1, authorStats.totalBooks)) }}%</p>
                          <div class="grow" />
                          <nuxt-link :to="`/library/${currentLibraryId}/bookshelf?filter=genres.${$encode(genre.genre)}`" class="text-sm text-white/70 hover:underline truncate max-w-[120px]">
                            {{ genre.genre }}
                          </nuxt-link>
                        </div>
                        <div class="w-full rounded-full h-2 bg-primary/50 overflow-hidden">
                          <div class="bg-yellow-400 h-full rounded-full" :style="{ width: Math.round((100 * genre.count) / Math.max(1, authorStats.totalBooks)) + '%' }" />
                        </div>
                      </div>
                    </div>

                    <div class="flex-1 min-w-[200px]">
                      <h1 class="text-xl mb-3">{{ $strings.HeaderTopRatedBooks || 'Top 5 Rated' }}</h1>
                      <p v-if="!topRatedBooks.length" class="text-sm text-white/60">{{ $strings.MessageNoItems || 'No items' }}</p>
                      <div v-for="(b, index) in topRatedBooks.slice(0, 5)" :key="b.id" class="w-full py-1.5">
                        <div class="flex items-center">
                          <p class="text-xs text-white/70 flex-1 pr-2 truncate">
                            {{ index + 1 }}.&nbsp;<nuxt-link :to="`/item/${b.id}`" class="hover:underline">{{ b.title }}</nuxt-link>
                          </p>
                          <div class="w-8 text-right">
                            <p class="text-xs font-bold">{{ b.rating == null ? '-' : Number(b.rating).toFixed(1) }}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="flex-1 min-w-[200px]">
                      <h1 class="text-xl mb-3">{{ $strings.HeaderStatsLongestItems || 'Longest (hrs)' }}</h1>
                      <p v-if="!longestBooks.length" class="text-sm text-white/60">{{ $strings.MessageNoItems || 'No items' }}</p>
                      <div v-for="(b, index) in longestBooks.slice(0, 5)" :key="b.id" class="w-full py-1.5">
                        <div class="flex items-center">
                          <p class="text-xs text-white/70 flex-1 pr-2 truncate">
                            {{ index + 1 }}.&nbsp;<nuxt-link :to="`/item/${b.id}`" class="hover:underline">{{ b.title }}</nuxt-link>
                          </p>
                          <div class="grow rounded-full h-1.5 bg-primary/0 overflow-hidden mx-2 max-w-[60px]">
                            <div class="bg-yellow-400 h-full rounded-full" :style="{ width: longestBookDuration > 0 ? Math.round((100 * b.duration) / longestBookDuration) + '%' : '0%' }" />
                          </div>
                          <div class="w-8 text-right">
                            <p class="text-xs font-bold">{{ (b.duration / 3600).toFixed(1) }}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="flex-1 min-w-[200px]">
                      <h1 class="text-xl mb-3">{{ $strings.HeaderStatsLargestItems || 'Largest' }}</h1>
                      <p v-if="!largestBooks.length" class="text-sm text-white/60">{{ $strings.MessageNoItems || 'No items' }}</p>
                      <div v-for="(b, index) in largestBooks.slice(0, 5)" :key="b.id" class="w-full py-1.5">
                        <div class="flex items-center">
                          <p class="text-xs text-white/70 flex-1 pr-2 truncate">
                            {{ index + 1 }}.&nbsp;<nuxt-link :to="`/item/${b.id}`" class="hover:underline">{{ b.title }}</nuxt-link>
                          </p>
                          <div class="grow rounded-full h-1.5 bg-primary/0 overflow-hidden mx-2 max-w-[60px]">
                            <div class="bg-yellow-400 h-full rounded-full" :style="{ width: largestBookSize > 0 ? Math.round((100 * b.size) / largestBookSize) + '%' : '0%' }" />
                          </div>
                          <div class="w-10 text-right">
                            <p class="text-xs font-bold whitespace-nowrap">{{ $bytesPretty(b.size) }}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="mt-4">
                    <h1 class="text-2xl mb-4">{{ $strings.HeaderListeningIntervals || 'Listening intervals' }}</h1>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p class="text-sm text-white/60 mb-2">{{ $strings.LabelWeekly || 'Weekly' }}</p>
                        <div v-if="authorStats.global.listeningStats?.weekly?.length" class="space-y-1">
                          <div v-for="w in authorStats.global.listeningStats.weekly.slice(-8)" :key="w.bucket" class="flex justify-between text-sm">
                            <span class="text-white/70">{{ w.bucket }}</span>
                            <span class="font-semibold">{{ $elapsedPretty(w.timeListening) }}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p class="text-sm text-white/60 mb-2">{{ $strings.LabelMonthly || 'Monthly' }}</p>
                        <div v-if="authorStats.global.listeningStats?.monthly?.length" class="space-y-1">
                          <div v-for="m in authorStats.global.listeningStats.monthly.slice(-8)" :key="m.bucket" class="flex justify-between text-sm">
                            <span class="text-white/70">{{ m.bucket }}</span>
                            <span class="font-semibold">{{ $elapsedPretty(m.timeListening) }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </transition>
      </div>

      <!-- Books Gallery -->
      <div class="py-4">
        <app-books-toolbar :total-books="filteredLibraryItems.length" :initial-search="searchQuery" :initial-filter="filterBy" :initial-sort="sortBy" :initial-sort-desc="sortDesc" @change="onToolbarChange" />

        <!-- Book Size Slider - Separate Row -->
        <div class="flex items-center justify-between px-4 md:px-8 py-3 bg-primary/20 border-b border-white/10">
          <span class="text-sm text-white/80 font-medium">{{ $strings.LabelBookSize || 'Book Size' }}</span>
          <div class="flex items-center gap-3">
            <span class="material-symbols text-lg text-white/60">photo_size_select_small</span>
            <input type="range" :min="minBookWidth" :max="maxBookWidth" :value="bookWidth" @input="updateBookWidth(Number($event.target.value))" class="w-32 sm:w-48 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider" :title="`Book width: ${bookWidth}px`" />
            <span class="material-symbols text-2xl text-white/60">photo_size_select_large</span>
            <span class="text-sm text-white/60 ml-2 min-w-12 text-right">{{ bookWidth }}px</span>
          </div>
        </div>

        <div class="flex flex-wrap mt-4">
          <div v-for="item in filteredLibraryItems" :key="item.id" class="p-2 relative" :style="{ width: cardWidth + 'px', height: cardHeight + 'px' }">
            <cards-lazy-book-card :ref="`book-card-${item.id}`" :book-mount="item" :bookshelf-view="$constants.BookshelfView.AUTHOR" :height="bookCoverHeight" @edit="editItem" @select="selectItem" />
          </div>
        </div>
      </div>

      <!-- Series Galleries (Collapsible) -->
      <div v-for="series in authorSeries" :key="series.id" class="py-4 bg-primary/20 rounded-lg overflow-hidden mb-2">
        <button class="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/30 transition-colors" @click="toggleSeries(series.id)">
          <div class="flex items-center">
            <h2 class="text-lg">{{ series.name }}</h2>
            <p class="text-white/40 text-base px-2">{{ $strings.LabelSeries }} ({{ series.items.length }})</p>
          </div>
          <div class="flex items-center">
            <nuxt-link :to="`/library/${currentLibraryId}/series/${series.id}`" class="text-sm text-white/60 hover:text-white hover:underline mr-3" @click.native.stop>
              {{ $strings.ButtonViewAll || 'View All' }}
            </nuxt-link>
            <span class="material-symbols text-2xl text-white/60 transition-transform" :class="{ 'rotate-180': expandedSeries[series.id] }">expand_more</span>
          </div>
        </button>
        <transition name="slide">
          <div v-show="expandedSeries[series.id]" class="px-2 pb-2">
            <div class="flex flex-wrap">
              <div v-for="item in series.items" :key="item.id" class="p-2 relative" :style="{ width: cardWidth + 'px', height: cardHeight + 'px' }">
                <cards-lazy-book-card :ref="`book-card-${item.id}`" :book-mount="item" :bookshelf-view="$constants.BookshelfView.AUTHOR" :height="bookCoverHeight" @edit="editItem" @select="selectItem" />
              </div>
            </div>
          </div>
        </transition>
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
      showAuthorStats: false,
      showGlobalStats: false,
      expandedSeries: {},
      bookWidth: 196, // Default book width in pixels
      windowWidth: 0
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
      // Calculate height based on configurable width and aspect ratio
      return this.bookWidth * this.bookCoverAspectRatio
    },
    coverHeight() {
      return this.bookCoverHeight * this.sizeMultiplier
    },
    cardWidth() {
      return this.bookWidth * this.sizeMultiplier
    },
    cardHeight() {
      // Cover height + space for title/author text below (approximately 4em = 64px)
      return this.coverHeight + 64
    },
    minBookWidth() {
      // Minimum width based on viewport
      if (this.windowWidth < 640) return 80 // mobile
      if (this.windowWidth < 1024) return 100 // tablet
      return 120 // desktop
    },
    maxBookWidth() {
      // Maximum width based on viewport
      if (this.windowWidth < 640) return 150 // mobile
      if (this.windowWidth < 1024) return 200 // tablet
      return 300 // desktop
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
    },
    topTags() {
      return this.authorStats?.global?.topTags || []
    },
    topRatedBooks() {
      return this.authorStats?.global?.topRatedBooks || []
    },
    averageRatingDisplay() {
      const avg = this.authorStats?.global?.averageRating
      if (avg === null || avg === undefined) return '-'
      const n = Number(avg)
      if (Number.isNaN(n)) return '-'
      return n.toFixed(2)
    },
    topGenres() {
      return this.authorStats?.global?.topGenres || []
    },
    longestBooks() {
      return this.authorStats?.global?.longestBooks || []
    },
    longestBookDuration() {
      if (!this.longestBooks.length) return 0
      return Math.max(...this.longestBooks.map((b) => b.duration || 0))
    },
    largestBooks() {
      return this.authorStats?.global?.largestBooks || []
    },
    largestBookSize() {
      if (!this.largestBooks.length) return 0
      return Math.max(...this.largestBooks.map((b) => b.size || 0))
    },
    playableBooks() {
      // Get all playable books from both main items and series
      const allBooks = [...this.filteredLibraryItems]
      this.authorSeries.forEach((series) => {
        series.items.forEach((item) => {
          if (!allBooks.find((b) => b.id === item.id)) {
            allBooks.push(item)
          }
        })
      })

      // Filter to only books with audio tracks
      return allBooks.filter((item) => {
        const numTracks = item.media?.numTracks || 0
        return numTracks > 0
      })
    },
    hasPlayableBooks() {
      return this.playableBooks.length > 0
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
    },
    toggleSeries(seriesId) {
      this.$set(this.expandedSeries, seriesId, !this.expandedSeries[seriesId])
    },
    playAll() {
      if (!this.playableBooks.length) return

      // Build queue items from all playable books
      const queueItems = this.playableBooks.map((item) => {
        const authorName = item.media?.metadata?.authorName || ''
        return {
          libraryItemId: item.id,
          libraryId: item.libraryId || this.currentLibraryId,
          episodeId: null,
          title: item.media?.metadata?.title || 'Unknown',
          subtitle: authorName,
          caption: this.author.name,
          duration: item.media?.duration || null,
          coverPath: item.media?.coverPath || null
        }
      })

      // Play the first item with the full queue
      this.$eventBus.$emit('play-item', {
        libraryItemId: queueItems[0].libraryItemId,
        episodeId: null,
        queueItems
      })

      this.$toast.success(this.$getString('MessageItemsAddedToQueue', [queueItems.length]) || `${queueItems.length} items added to queue`)
    },
    handleResize() {
      this.windowWidth = window.innerWidth
      // Clamp bookWidth to new min/max if needed
      if (this.bookWidth < this.minBookWidth) {
        this.bookWidth = this.minBookWidth
      } else if (this.bookWidth > this.maxBookWidth) {
        this.bookWidth = this.maxBookWidth
      }
    },
    updateBookWidth(width) {
      this.bookWidth = width
      // Save preference
      this.$store.dispatch('user/updateUserSettings', { authorPageBookWidth: width })
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

    // Load saved book width preference
    const savedWidth = this.$store.getters['user/getUserSetting']('authorPageBookWidth')
    if (savedWidth) {
      this.bookWidth = savedWidth
    }

    // Set initial window width
    this.windowWidth = window.innerWidth

    // Add resize listener
    window.addEventListener('resize', this.handleResize)

    // Fetch author-specific listening stats
    this.fetchAuthorStats()

    this.$root.socket.on('author_updated', this.authorUpdated)
    this.$root.socket.on('author_removed', this.authorRemoved)
    this.$eventBus.$on('bookshelf_clear_selection', this.clearSelectedEntities)
    this.$eventBus.$on('bookshelf_select_all', this.selectAllEntities)
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.handleResize)
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
  line-clamp: 4;
  max-height: 6.25rem;
  transition: all 0.3s ease-in-out;
}
#author-description.show-full {
  -webkit-line-clamp: unset;
  line-clamp: unset;
  max-height: 999rem;
}

/* Range slider styling */
.slider {
  background: linear-gradient(to right, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.5) 100%);
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.slider::-webkit-slider-thumb:hover {
  background: #4ade80;
  transform: scale(1.2);
  box-shadow: 0 4px 8px rgba(74, 222, 128, 0.4);
}

.slider::-webkit-slider-thumb:active {
  transform: scale(1.1);
}

.slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease-in-out;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.slider::-moz-range-thumb:hover {
  background: #4ade80;
  transform: scale(1.2);
  box-shadow: 0 4px 8px rgba(74, 222, 128, 0.4);
}

.slider::-moz-range-thumb:active {
  transform: scale(1.1);
}
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  max-height: 3000px;
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
