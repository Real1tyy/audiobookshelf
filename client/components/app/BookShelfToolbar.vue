<template>
  <div class="w-full h-20 md:h-10 relative">
    <div class="flex md:hidden h-10 items-center">
      <nuxt-link :to="`/library/${currentLibraryId}`" class="grow h-full flex justify-center items-center" :class="isHomePage ? 'bg-primary/80' : 'bg-primary/40'">
        <p v-if="isHomePage || isPodcastLibrary" class="text-sm">{{ $strings.ButtonHome }}</p>
        <span v-else class="material-symbols text-lg">home</span>
      </nuxt-link>
      <nuxt-link :to="`/library/${currentLibraryId}/bookshelf`" class="grow h-full flex justify-center items-center" :class="isLibraryPage ? 'bg-primary/80' : 'bg-primary/40'">
        <p v-if="isLibraryPage || isPodcastLibrary" class="text-sm">{{ $strings.ButtonLibrary }}</p>
        <span v-else class="material-symbols text-lg">import_contacts</span>
      </nuxt-link>
      <nuxt-link v-if="isPodcastLibrary" :to="`/library/${currentLibraryId}/podcast/latest`" class="grow h-full flex justify-center items-center" :class="isPodcastLatestPage ? 'bg-primary/80' : 'bg-primary/40'">
        <p class="text-sm">{{ $strings.ButtonLatest }}</p>
      </nuxt-link>
      <nuxt-link v-if="isBookLibrary" :to="`/library/${currentLibraryId}/bookshelf/series`" class="grow h-full flex justify-center items-center" :class="isSeriesPage ? 'bg-primary/80' : 'bg-primary/40'">
        <p v-if="isSeriesPage" class="text-sm">{{ $strings.ButtonSeries }}</p>
        <span v-else class="material-symbols text-lg">view_column</span>
      </nuxt-link>
      <nuxt-link v-if="showPlaylists" :to="`/library/${currentLibraryId}/bookshelf/playlists`" class="grow h-full flex justify-center items-center" :class="isPlaylistsPage ? 'bg-primary/80' : 'bg-primary/40'">
        <p v-if="isPlaylistsPage || isPodcastLibrary" class="text-sm">{{ $strings.ButtonPlaylists }}</p>
        <span v-else class="material-symbols text-lg">&#xe03d;</span>
      </nuxt-link>
      <nuxt-link v-if="isBookLibrary" :to="`/library/${currentLibraryId}/bookshelf/authors`" class="grow h-full flex justify-center items-center" :class="isAuthorsPage ? 'bg-primary/80' : 'bg-primary/40'">
        <p v-if="isAuthorsPage" class="text-sm">{{ $strings.ButtonAuthors }}</p>
        <span v-else class="material-symbols text-lg">groups</span>
      </nuxt-link>
      <nuxt-link v-if="isBookLibrary" :to="`/library/${currentLibraryId}/tags`" class="grow h-full flex justify-center items-center" :class="isTagsPage ? 'bg-primary/80' : 'bg-primary/40'">
        <p v-if="isTagsPage" class="text-sm">{{ $strings.LabelTags }}</p>
        <span v-else class="material-symbols text-lg">label</span>
      </nuxt-link>
      <nuxt-link v-if="isPodcastLibrary && userIsAdminOrUp" :to="`/library/${currentLibraryId}/podcast/search`" class="grow h-full flex justify-center items-center" :class="isPodcastSearchPage ? 'bg-primary/80' : 'bg-primary/40'">
        <p class="text-sm">{{ $strings.ButtonAdd }}</p>
      </nuxt-link>
      <nuxt-link v-if="isPodcastLibrary && userIsAdminOrUp" :to="`/library/${currentLibraryId}/podcast/download-queue`" class="grow h-full flex justify-center items-center" :class="isPodcastDownloadQueuePage ? 'bg-primary/80' : 'bg-primary/40'">
        <p class="text-sm">{{ $strings.ButtonDownloadQueue }}</p>
      </nuxt-link>
      <nuxt-link to="/downloads" class="grow h-full flex justify-center items-center relative" :class="isDownloadsPage ? 'bg-primary/80' : 'bg-primary/40'">
        <span class="material-symbols text-lg">cloud_download</span>
        <div v-if="numOfflineDownloads" class="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-success/80 flex items-center justify-center">
          <p class="text-xxs font-mono">{{ numOfflineDownloads }}</p>
        </div>
      </nuxt-link>
      <nuxt-link v-if="userIsAdminOrUp" to="/shared" class="grow h-full flex justify-center items-center relative" :class="isSharedPage ? 'bg-primary/80' : 'bg-primary/40'">
        <span class="material-symbols text-lg">share</span>
      </nuxt-link>
    </div>
    <div id="toolbar" role="toolbar" aria-label="Library Toolbar" class="absolute top-10 md:top-0 left-0 w-full h-10 md:h-full z-40 flex items-center justify-end md:justify-start px-2 md:px-8">
      <!-- Series books page -->
      <template v-if="selectedSeries">
        <p class="pl-2 text-base md:text-lg">
          {{ seriesName }}
        </p>
        <div class="w-6 h-6 rounded-full bg-black/30 flex items-center justify-center ml-3">
          <span class="font-mono">{{ $formatNumber(numShowing) }}</span>
        </div>
        <div class="grow" />

        <!-- RSS feed -->
        <ui-tooltip v-if="seriesRssFeed" :text="$strings.LabelOpenRSSFeed" direction="top">
          <ui-icon-btn icon="rss_feed" class="mx-0.5" :size="7" icon-font-size="1.2rem" bg-color="bg-success" outlined @click="showOpenSeriesRSSFeed" />
        </ui-tooltip>

        <widgets-cover-size-widget setting-key="seriesDetailCoverSize" class="ml-2" />

        <ui-context-menu-dropdown v-if="!isBatchSelecting && seriesContextMenuItems.length" :items="seriesContextMenuItems" class="mx-px" @action="seriesContextMenuAction" />
      </template>
      <!-- library & collections page -->
      <template v-else-if="page !== 'search' && page !== 'podcast-search' && page !== 'recent-episodes' && !isHome && !isAuthorsPage && !isContinueListeningPage && !isRecentlyAddedPage">
        <p class="hidden md:block">{{ $formatNumber(numShowing) }} {{ entityName }}</p>

        <div class="grow hidden sm:inline-block" />

        <!-- library search input -->
        <div v-if="isLibraryPage && !isBatchSelecting" class="w-36 sm:w-44 md:w-48 ml-1 sm:ml-4">
          <ui-text-input v-model="searchQuery" :placeholder="$strings.PlaceholderSearch || 'Search...'" class="w-full h-7.5" @input="onSearchInput" @keydown.enter="onSearchEnter" @blur="onSearchBlur" />
        </div>

        <!-- library filter select (multi-filter AND support) -->
        <controls-library-filter-multi-select v-if="isLibraryPage && !isBatchSelecting" v-model="settings.filterBy" class="ml-1 sm:ml-4" @change="updateFilter" />

        <!-- library sort select -->
        <controls-library-sort-select v-if="isLibraryPage && !isBatchSelecting" v-model="settings.orderBy" :descending.sync="settings.orderDesc" class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateOrder" />

        <!-- series filter select -->
        <controls-library-filter-select v-if="isSeriesPage && !isBatchSelecting" v-model="settings.seriesFilterBy" is-series class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateSeriesFilter" />

        <!-- series sort select -->
        <controls-sort-select v-if="isSeriesPage && !isBatchSelecting" v-model="settings.seriesSortBy" :descending.sync="settings.seriesSortDesc" :items="seriesSortItems" class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateSeriesSort" />

        <!-- Play All button for book library -->
        <button v-if="isBookLibrary && isLibraryPage && !isBatchSelecting" class="flex items-center px-2 sm:px-3 py-1 ml-2 sm:ml-4 rounded-full bg-success hover:bg-success/80 text-white text-sm transition-colors" :disabled="playingAll" @click="playAll">
          <span class="material-symbols text-lg mr-0 sm:mr-1">play_arrow</span>
          <span class="hidden sm:inline">{{ $strings.LabelPlayAll || 'Play All' }}</span>
        </button>

        <!-- issues page remove all button -->
        <ui-btn v-if="isIssuesFilter && userCanDelete && !isBatchSelecting" :loading="processingIssues" color="bg-error" small class="ml-4" @click="removeAllIssues">{{ $strings.ButtonRemoveAll }} {{ $formatNumber(numShowing) }} {{ entityName }}</ui-btn>

        <!-- Batch download offline button -->
        <ui-btn v-if="isBatchSelecting && selectedMediaItems.length" color="bg-success" small class="ml-2" @click="batchDownloadOffline">
          <span class="material-symbols text-lg mr-1">cloud_download</span>
          Download {{ selectedMediaItems.length }} offline
        </ui-btn>

        <widgets-cover-size-widget :setting-key="currentPageCoverSizeKey" class="ml-2" />

        <ui-context-menu-dropdown v-if="contextMenuItems.length" :items="contextMenuItems" :menu-width="110" class="ml-2" @action="contextMenuAction" />
      </template>
      <!-- search page -->
      <template v-else-if="page === 'search'">
        <div class="grow" />
        <p>{{ $strings.MessageSearchResultsFor }} "{{ searchQueryText }}"</p>
        <div class="grow" />
        <widgets-cover-size-widget setting-key="libraryCoverSize" class="ml-2" />
        <ui-context-menu-dropdown v-if="contextMenuItems.length" :items="contextMenuItems" :menu-width="110" class="ml-2" @action="contextMenuAction" />
      </template>
      <!-- authors page -->
      <template v-else-if="isAuthorsPage">
        <p class="hidden md:block">{{ $formatNumber(numShowing) }} {{ entityName }}</p>

        <div class="grow hidden sm:inline-block" />
        <ui-btn v-if="userCanUpdate && !isBatchSelecting" :loading="processingAuthors" color="bg-primary" small @click="matchAllAuthors">{{ $strings.ButtonMatchAllAuthors }}</ui-btn>

        <!-- author sort select -->
        <controls-sort-select v-model="settings.authorSortBy" :descending.sync="settings.authorSortDesc" :items="authorSortItems" class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateAuthorSort" />

        <widgets-cover-size-widget setting-key="authorsCoverSize" class="ml-2" />
      </template>
      <!-- continue listening page -->
      <template v-else-if="isContinueListeningPage">
        <p class="hidden md:block">{{ $formatNumber(numShowing) }} {{ entityName }}</p>
        <div class="grow hidden sm:inline-block" />
        <controls-sort-select v-model="settings.continueListeningSortBy" :descending.sync="settings.continueListeningSortDesc" :items="continueListeningSortItems" class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateContinueListeningSort" />

        <widgets-cover-size-widget setting-key="continueListeningCoverSize" class="ml-2" />
      </template>
      <!-- recently added page -->
      <template v-else-if="isRecentlyAddedPage">
        <p class="hidden md:block">{{ $formatNumber(numShowing) }} {{ entityName }}</p>
        <div class="grow hidden sm:inline-block" />
        <controls-library-filter-select v-model="settings.recentlyAddedFilterBy" class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateRecentlyAddedFilter" />
        <controls-sort-select v-model="settings.recentlyAddedSortBy" :descending.sync="settings.recentlyAddedSortDesc" :items="recentlyAddedSortItems" class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateRecentlyAddedSort" />

        <widgets-cover-size-widget setting-key="recentlyAddedCoverSize" class="ml-2" />
      </template>
      <!-- home page -->
      <template v-else-if="isHome">
        <div class="grow" />
        <widgets-cover-size-widget setting-key="homeCoverSize" class="ml-2" />
        <ui-context-menu-dropdown v-if="contextMenuItems.length" :items="contextMenuItems" :menu-width="110" class="ml-2" @action="contextMenuAction" />
      </template>
    </div>

    <!-- Mobile batch action bar -->
    <div v-if="isBatchSelecting && selectedMediaItems.length" class="fixed left-0 right-0 z-50 flex md:hidden items-center justify-between px-4 py-3 bg-bg border-t border-white/10" :class="streamLibraryItem ? 'bottom-20' : 'bottom-0'">
      <p class="text-sm font-semibold">{{ selectedMediaItems.length }} selected</p>
      <div class="flex items-center gap-2">
        <button class="flex items-center gap-1 px-3 py-1.5 rounded-full bg-success text-white text-sm" @click="batchDownloadOffline">
          <span class="material-symbols text-lg">cloud_download</span>
          Download
        </button>
        <button class="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-gray-300" @click="clearBatchSelection">
          <span class="material-symbols text-lg">close</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    page: String,
    isHome: Boolean,
    selectedSeries: {
      type: Object,
      default: () => null
    },
    searchQueryText: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      settings: {},
      hasInit: false,
      totalEntities: 0,
      processingSeries: false,
      processingIssues: false,
      processingAuthors: false,
      playingAll: false,
      searchQuery: '',
      searchDebounceTimeout: null
    }
  },
  computed: {
    seriesContextMenuItems() {
      if (!this.selectedSeries) return []

      const items = [
        {
          text: this.isSeriesFinished ? this.$strings.MessageMarkAsNotFinished : this.$strings.MessageMarkAsFinished,
          action: 'mark-series-finished'
        }
      ]

      if (this.userIsAdminOrUp || this.selectedSeries.rssFeed) {
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

      this.addSubtitlesMenuItem(items)
      this.addCollapseSubSeriesMenuItem(items)

      return items
    },
    seriesSortItems() {
      return [
        {
          text: this.$strings.LabelName,
          value: 'name'
        },
        {
          text: this.$strings.LabelNumberOfBooks,
          value: 'numBooks'
        },
        {
          text: this.$strings.LabelAddedAt,
          value: 'addedAt'
        },
        {
          text: this.$strings.LabelLastBookAdded,
          value: 'lastBookAdded'
        },
        {
          text: this.$strings.LabelLastBookUpdated,
          value: 'lastBookUpdated'
        },
        {
          text: this.$strings.LabelTotalDuration,
          value: 'totalDuration'
        },
        {
          text: this.$strings.LabelRandomly,
          value: 'random'
        }
      ]
    },
    authorSortItems() {
      return [
        {
          text: this.$strings.LabelAuthorFirstLast,
          value: 'name'
        },
        {
          text: this.$strings.LabelAuthorLastFirst,
          value: 'lastFirst'
        },
        {
          text: this.$strings.LabelNumberOfBooks,
          value: 'numBooks'
        },
        {
          text: this.$strings.LabelAddedAt,
          value: 'addedAt'
        },
        {
          text: this.$strings.LabelUpdatedAt,
          value: 'updatedAt'
        }
      ]
    },
    continueListeningSortItems() {
      return [
        {
          text: 'Last Listened',
          value: 'progress'
        },
        {
          text: this.$strings.LabelTitle || 'Title',
          value: 'media.metadata.title'
        },
        {
          text: this.$strings.LabelAuthor || 'Author',
          value: 'media.metadata.authorName'
        },
        {
          text: this.$strings.LabelDuration || 'Duration',
          value: 'media.duration'
        }
      ]
    },
    recentlyAddedSortItems() {
      return [
        {
          text: this.$strings.LabelAddedAt || 'Added At',
          value: 'addedAt'
        },
        {
          text: this.$strings.LabelTitle || 'Title',
          value: 'media.metadata.title'
        },
        {
          text: this.$strings.LabelAuthor || 'Author',
          value: 'media.metadata.authorName'
        },
        {
          text: this.$strings.LabelDuration || 'Duration',
          value: 'media.duration'
        },
        {
          text: this.$strings.LabelPublishedYear || 'Published Year',
          value: 'media.metadata.publishedYear'
        }
      ]
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDownload() {
      return this.$store.getters['user/getUserCanDownload']
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    libraryProvider() {
      return this.$store.getters['libraries/getLibraryProvider'](this.currentLibraryId) || 'google'
    },
    currentLibraryMediaType() {
      return this.$store.getters['libraries/getCurrentLibraryMediaType']
    },
    isBookLibrary() {
      return this.currentLibraryMediaType === 'book'
    },
    isPodcastLibrary() {
      return this.currentLibraryMediaType === 'podcast'
    },
    isLibraryPage() {
      return this.page === ''
    },
    isSeriesPage() {
      return this.page === 'series'
    },
    isCollectionsPage() {
      return this.page === 'collections'
    },
    isPlaylistsPage() {
      return this.page === 'playlists'
    },
    isHomePage() {
      return this.$route.name === 'library-library'
    },
    isPodcastSearchPage() {
      return this.$route.name === 'library-library-podcast-search'
    },
    isPodcastLatestPage() {
      return this.$route.name === 'library-library-podcast-latest'
    },
    isPodcastDownloadQueuePage() {
      return this.$route.name === 'library-library-podcast-download-queue'
    },
    isAuthorsPage() {
      return this.page === 'authors'
    },
    isContinueListeningPage() {
      return this.page === 'continue-listening'
    },
    isRecentlyAddedPage() {
      return this.page === 'recently-added'
    },
    isTagsPage() {
      return this.page === 'tags'
    },
    numShowing() {
      return this.totalEntities
    },
    entityName() {
      if (this.isPodcastLibrary) return this.$strings.LabelPodcasts
      if (!this.page) return this.$strings.LabelBooks
      if (this.isSeriesPage) return this.$strings.LabelSeries
      if (this.isCollectionsPage) return this.$strings.LabelCollections
      if (this.isPlaylistsPage) return this.$strings.LabelPlaylists
      if (this.isAuthorsPage) return this.$strings.LabelAuthors
      if (this.isTagsPage) return this.$strings.LabelTags
      if (this.isContinueListeningPage) return 'Continue Listening'
      if (this.isRecentlyAddedPage) return 'Recently Added'
      return ''
    },
    seriesId() {
      return this.selectedSeries ? this.selectedSeries.id : null
    },
    seriesName() {
      return this.selectedSeries ? this.selectedSeries.name : null
    },
    seriesProgress() {
      return this.selectedSeries ? this.selectedSeries.progress : null
    },
    seriesRssFeed() {
      return this.selectedSeries ? this.selectedSeries.rssFeed : null
    },
    seriesLibraryItemIds() {
      if (!this.seriesProgress) return []
      return this.seriesProgress.libraryItemIds || []
    },
    isBatchSelecting() {
      return this.$store.getters['globals/getIsBatchSelectingMediaItems']
    },
    selectedMediaItems() {
      return this.$store.state.globals.selectedMediaItems
    },
    isSeriesFinished() {
      return this.seriesProgress && !!this.seriesProgress.isFinished
    },
    isSeriesRemovedFromContinueListening() {
      if (!this.seriesId) return false
      return this.$store.getters['user/getIsSeriesRemovedFromContinueListening'](this.seriesId)
    },
    filterBy() {
      return this.$store.getters['user/getUserSetting']('filterBy')
    },
    isIssuesFilter() {
      return this.filterBy === 'issues' && this.$route.query.filter === 'issues'
    },
    contextMenuItems() {
      const items = []

      if (this.isPodcastLibrary && this.isLibraryPage && this.userCanDownload) {
        items.push({
          text: this.$strings.LabelExportOPML,
          action: 'export-opml'
        })
      }

      this.addSubtitlesMenuItem(items)
      this.addCollapseSeriesMenuItem(items)

      return items
    },
    showPlaylists() {
      return this.$store.state.libraries.numUserPlaylists > 0
    },
    isDownloadsPage() {
      return this.$route.name === 'downloads'
    },
    isSharedPage() {
      return this.$route.name === 'shared'
    },
    numOfflineDownloads() {
      return this.$store.getters['offline/downloadedItemsList'].length
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    currentPageCoverSizeKey() {
      if (this.isLibraryPage) return 'libraryCoverSize'
      if (this.isSeriesPage) return 'seriesCoverSize'
      if (this.isPlaylistsPage) return 'playlistsCoverSize'
      if (this.isCollectionsPage) return 'libraryCoverSize'
      return 'libraryCoverSize'
    }
  },
  methods: {
    batchDownloadOffline() {
      const token = this.$store.getters['user/getToken']
      this.$store.dispatch('offline/enqueue', { libraryItems: this.selectedMediaItems, token })
      this.$toast.success(`Queued ${this.selectedMediaItems.length} items for download`)
    },
    clearBatchSelection() {
      this.$store.commit('globals/resetSelectedMediaItems')
    },
    addSubtitlesMenuItem(items) {
      if (this.isBookLibrary && (!this.page || this.page === 'search')) {
        if (this.settings.showSubtitles) {
          items.push({
            text: this.$strings.LabelHideSubtitles,
            action: 'hide-subtitles'
          })
        } else {
          items.push({
            text: this.$strings.LabelShowSubtitles,
            action: 'show-subtitles'
          })
        }
      }
    },
    addCollapseSeriesMenuItem(items) {
      if (this.isLibraryPage && this.isBookLibrary && !this.isBatchSelecting) {
        if (this.settings.collapseSeries) {
          items.push({
            text: this.$strings.LabelExpandSeries,
            action: 'expand-series'
          })
        } else {
          items.push({
            text: this.$strings.LabelCollapseSeries,
            action: 'collapse-series'
          })
        }
      }
    },
    addCollapseSubSeriesMenuItem(items) {
      if (this.selectedSeries && this.isBookLibrary && !this.isBatchSelecting) {
        if (this.settings.collapseBookSeries) {
          items.push({
            text: this.$strings.LabelExpandSubSeries,
            action: 'expand-sub-series'
          })
        } else {
          items.push({
            text: this.$strings.LabelCollapseSubSeries,
            action: 'collapse-sub-series'
          })
        }
      }
    },
    handleSubtitlesAction(action) {
      if (action === 'show-subtitles') {
        this.settings.showSubtitles = true
        this.updateShowSubtitles()
        return true
      }
      if (action === 'hide-subtitles') {
        this.settings.showSubtitles = false
        this.updateShowSubtitles()
        return true
      }
      return false
    },
    handleCollapseSeriesAction(action) {
      if (action === 'collapse-series') {
        this.settings.collapseSeries = true
        this.updateCollapseSeries()
        return true
      }
      if (action === 'expand-series') {
        this.settings.collapseSeries = false
        this.updateCollapseSeries()
        return true
      }
      return false
    },
    handleCollapseSubSeriesAction(action) {
      if (action === 'collapse-sub-series') {
        this.settings.collapseBookSeries = true
        this.updateCollapseSubSeries()
        return true
      }
      if (action === 'expand-sub-series') {
        this.settings.collapseBookSeries = false
        this.updateCollapseSubSeries()
        return true
      }
      return false
    },
    contextMenuAction({ action }) {
      if (action === 'export-opml') {
        this.exportOPML()
        return
      } else if (this.handleSubtitlesAction(action)) {
        return
      } else if (this.handleCollapseSeriesAction(action)) {
        return
      }
    },
    exportOPML() {
      this.$downloadFile(`/api/libraries/${this.currentLibraryId}/opml?token=${this.$store.getters['user/getToken']}`, null, true)
    },
    async playAll() {
      if (this.playingAll) return
      this.playingAll = true

      try {
        // Build query string for current filter/sort settings
        let searchParams = new URLSearchParams()
        if (this.settings.librarySearchQuery) {
          searchParams.set('q', this.settings.librarySearchQuery)
        }
        if (this.settings.filterBy && this.settings.filterBy !== 'all') {
          searchParams.set('filter', this.settings.filterBy)
        }
        if (this.settings.orderBy) {
          searchParams.set('sort', this.settings.orderBy)
          searchParams.set('desc', this.settings.orderDesc ? 1 : 0)
        }
        const sfQueryString = searchParams.toString() ? searchParams.toString() + '&' : ''

        // Fetch all items matching current filter (limit=0 means all)
        const payload = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/items?${sfQueryString}limit=0&minified=1`).catch((error) => {
          console.error('Failed to fetch items for play all', error)
          return null
        })

        if (!payload || !payload.results || !payload.results.length) {
          this.$toast.warning(this.$strings.MessageNoItemsFound || 'No items found')
          return
        }

        // Filter to only playable books (those with audio tracks)
        const playableItems = payload.results.filter((item) => {
          if (item.collapsedSeries) return false
          const numTracks = item.media?.numTracks || 0
          return numTracks > 0
        })

        if (!playableItems.length) {
          this.$toast.warning(this.$strings.MessageNoPlayableItems || 'No playable items found')
          return
        }

        // Build queue items
        const queueItems = playableItems.map((item) => {
          const authorName = item.media?.metadata?.authorName || ''
          return {
            libraryItemId: item.id,
            libraryId: item.libraryId || this.currentLibraryId,
            episodeId: null,
            title: item.media?.metadata?.title || 'Unknown',
            subtitle: authorName,
            caption: '',
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
      } finally {
        this.playingAll = false
      }
    },
    seriesContextMenuAction({ action }) {
      if (action === 'open-rss-feed') {
        this.showOpenSeriesRSSFeed()
      } else if (action === 're-add-to-continue-listening') {
        if (this.processingSeries) {
          console.warn('Already processing series')
          return
        }
        this.reAddSeriesToContinueListening()
      } else if (action === 'mark-series-finished') {
        if (this.processingSeries) {
          console.warn('Already processing series')
          return
        }
        this.markSeriesFinished()
      } else if (this.handleSubtitlesAction(action)) {
        return
      } else if (this.handleCollapseSubSeriesAction(action)) {
        return
      }
    },
    showOpenSeriesRSSFeed() {
      this.$store.commit('globals/setRSSFeedOpenCloseModal', {
        id: this.selectedSeries.id,
        name: this.selectedSeries.name,
        type: 'series',
        feed: this.selectedSeries.rssFeed
      })
    },
    reAddSeriesToContinueListening() {
      this.processingSeries = true
      this.$axios
        .$get(`/api/me/series/${this.seriesId}/readd-to-continue-listening`)
        .then(() => {
          this.$toast.success(this.$strings.ToastItemUpdateSuccess)
        })
        .catch((error) => {
          console.error('Failed to re-add series to continue listening', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
        })
        .finally(() => {
          this.processingSeries = false
        })
    },
    async fetchAllAuthors() {
      // fetch all authors from the server, in the order that they are currently displayed
      const response = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/authors?sort=${this.settings.authorSortBy}&desc=${this.settings.authorSortDesc}`)
      return response.authors
    },
    async matchAllAuthors() {
      this.processingAuthors = true

      try {
        const authors = await this.fetchAllAuthors()

        for (const author of authors) {
          const payload = {}
          if (author.asin) payload.asin = author.asin
          else payload.q = author.name

          payload.region = 'us'
          if (this.libraryProvider.startsWith('audible.')) {
            payload.region = this.libraryProvider.split('.').pop() || 'us'
          }

          this.$eventBus.$emit(`searching-author-${author.id}`, true)

          var response = await this.$axios.$post(`/api/authors/${author.id}/match`, payload).catch((error) => {
            console.error('Failed', error)
            return null
          })
          if (!response) {
            console.error(`Author ${author.name} not found`)
            this.$toast.error(this.$getString('ToastAuthorNotFound', [author.name]))
          } else if (response.updated) {
            if (response.author.imagePath) console.log(`Author ${response.author.name} was updated`)
            else console.log(`Author ${response.author.name} was updated (no image found)`)
          } else {
            console.log(`No updates were made for Author ${response.author.name}`)
          }

          this.$eventBus.$emit(`searching-author-${author.id}`, false)
        }
      } catch (error) {
        console.error('Failed to match all authors', error)
        this.$toast.error(this.$strings.ToastMatchAllAuthorsFailed)
      }
      this.processingAuthors = false
    },
    removeAllIssues() {
      if (confirm(`Are you sure you want to remove all library items with issues?\n\nNote: This will not delete any files`)) {
        this.processingIssues = true
        this.$axios
          .$delete(`/api/libraries/${this.currentLibraryId}/issues`)
          .then(() => {
            this.$toast.success(this.$strings.ToastRemoveItemsWithIssuesSuccess)
            this.$router.push(`/library/${this.currentLibraryId}/bookshelf`)
            this.$store.dispatch('libraries/fetch', this.currentLibraryId)
          })
          .catch((error) => {
            console.error('Failed to remove library items with issues', error)
            this.$toast.error(this.$strings.ToastRemoveItemsWithIssuesFailed)
          })
          .finally(() => {
            this.processingIssues = false
          })
      }
    },
    markSeriesFinished() {
      const newIsFinished = !this.isSeriesFinished

      const payload = {
        message: newIsFinished ? this.$strings.MessageConfirmMarkSeriesFinished : this.$strings.MessageConfirmMarkSeriesNotFinished,
        callback: (confirmed) => {
          if (confirmed) {
            this.processingSeries = true
            const updateProgressPayloads = this.seriesLibraryItemIds.map((lid) => {
              return {
                libraryItemId: lid,
                isFinished: newIsFinished
              }
            })
            console.log('Progress payloads', updateProgressPayloads)
            this.$axios
              .patch(`/api/me/progress/batch/update`, updateProgressPayloads)
              .then(() => {
                this.$toast.success(this.$strings.ToastSeriesUpdateSuccess)
                this.selectedSeries.progress.isFinished = newIsFinished
              })
              .catch((error) => {
                this.$toast.error(this.$strings.ToastSeriesUpdateFailed)
                console.error('Failed to batch update read/not read', error)
              })
              .finally(() => {
                this.processingSeries = false
              })
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    updateOrder() {
      this.saveSettings()
    },
    updateFilter() {
      this.saveSettings()
    },
    updateSeriesSort() {
      this.saveSettings()
    },
    updateSeriesFilter() {
      this.saveSettings()
    },
    updateCollapseSeries() {
      this.saveSettings()
    },
    updateCollapseSubSeries() {
      this.saveSettings()
    },
    updateShowSubtitles() {
      this.saveSettings()
    },
    updateAuthorSort() {
      this.saveSettings()
    },
    updateContinueListeningSort() {
      this.saveSettings()
    },
    updateRecentlyAddedSort() {
      this.saveSettings()
    },
    updateRecentlyAddedFilter() {
      this.saveSettings()
    },
    onSearchInput() {
      // Clear existing timeout
      if (this.searchDebounceTimeout) {
        clearTimeout(this.searchDebounceTimeout)
      }
      // Set new timeout for debounced search
      this.searchDebounceTimeout = setTimeout(() => {
        this.updateSearch()
      }, 500)
    },
    onSearchEnter() {
      // Clear timeout and perform search immediately
      if (this.searchDebounceTimeout) {
        clearTimeout(this.searchDebounceTimeout)
      }
      this.updateSearch()
    },
    onSearchBlur() {
      // Perform search on blur if there's a pending change
      if (this.searchDebounceTimeout) {
        clearTimeout(this.searchDebounceTimeout)
        this.updateSearch()
      }
    },
    updateSearch() {
      this.settings.librarySearchQuery = this.searchQuery.trim()
      this.saveSettings()
    },
    saveSettings() {
      this.$store.dispatch('user/updateUserSettings', this.settings)
    },
    init() {
      this.settings = { ...this.$store.state.user.settings }
      // Initialize search query from settings (which are synced with URL)
      this.searchQuery = this.settings.librarySearchQuery || ''
    },
    settingsUpdated(settings) {
      for (const key in settings) {
        this.settings[key] = settings[key]
      }
      // Update search query if it changed
      if (settings.librarySearchQuery !== undefined && settings.librarySearchQuery !== this.searchQuery) {
        this.searchQuery = settings.librarySearchQuery || ''
      }
    },
    setBookshelfTotalEntities(totalEntities) {
      this.totalEntities = totalEntities
    },
    rssFeedOpen(data) {
      if (data.entityId === this.seriesId) {
        console.log('RSS Feed Opened', data)
        this.selectedSeries.rssFeed = data
      }
    },
    rssFeedClosed(data) {
      if (data.entityId === this.seriesId) {
        console.log('RSS Feed Closed', data)
        this.selectedSeries.rssFeed = null
      }
    }
  },
  mounted() {
    this.init()
    this.$eventBus.$on('user-settings', this.settingsUpdated)
    this.$eventBus.$on('bookshelf-total-entities', this.setBookshelfTotalEntities)
    this.$root.socket.on('rss_feed_open', this.rssFeedOpen)
    this.$root.socket.on('rss_feed_closed', this.rssFeedClosed)
  },
  beforeDestroy() {
    this.$eventBus.$off('user-settings', this.settingsUpdated)
    this.$eventBus.$off('bookshelf-total-entities', this.setBookshelfTotalEntities)
    this.$root.socket.off('rss_feed_open', this.rssFeedOpen)
    this.$root.socket.off('rss_feed_closed', this.rssFeedClosed)
    // Clear any pending search timeout
    if (this.searchDebounceTimeout) {
      clearTimeout(this.searchDebounceTimeout)
    }
  }
}
</script>


<style>
#toolbar {
  box-shadow: 0px 8px 6px #111111aa;
}
</style>
