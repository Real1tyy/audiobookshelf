<template>
  <div class="w-full bg-bg border-b border-white/10 relative z-30">
    <div class="flex items-center justify-between px-4 md:px-8 py-3 gap-4">
      <!-- Left side: Series name and book count -->
      <div class="flex items-center gap-4">
        <p class="text-base md:text-lg font-semibold">{{ seriesName }}</p>
        <div class="w-6 h-6 rounded-full bg-black/30 flex items-center justify-center">
          <span class="font-mono text-sm">{{ totalBooks }}</span>
        </div>
      </div>

      <!-- Right side: Search, Filter, Sort -->
      <div class="flex items-center gap-2 flex-grow justify-end">
        <!-- Search input -->
        <div class="w-36 sm:w-44 md:w-48">
          <ui-text-input v-model="searchQuery" :placeholder="$strings.PlaceholderSearch || 'Search books...'" class="w-full" @input="onSearchInput" @keydown.enter="onSearchEnter" @blur="onSearchBlur" />
        </div>

        <!-- Filter select -->
        <controls-library-filter-multi-select v-if="!isBatchSelecting" v-model="filterBy" is-series @change="updateFilter" />

        <!-- Sort select -->
        <controls-series-books-sort-select v-if="!isBatchSelecting" v-model="sortBy" :descending.sync="sortDesc" class="w-36 sm:w-44 md:w-48 h-7.5" @change="updateSort" />

        <!-- Batch download offline button -->
        <ui-btn v-if="isBatchSelecting && selectedMediaItems.length" color="bg-success" small class="ml-2" @click="batchDownloadOffline">
          <span class="material-symbols text-lg mr-1">cloud_download</span>
          Download {{ selectedMediaItems.length }} offline
        </ui-btn>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    seriesName: {
      type: String,
      default: ''
    },
    totalBooks: {
      type: Number,
      default: 0
    },
    initialSearch: {
      type: String,
      default: ''
    },
    initialFilter: {
      type: String,
      default: 'all'
    },
    initialSort: {
      type: String,
      default: 'sequence'
    },
    initialSortDesc: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      searchQuery: this.initialSearch,
      filterBy: this.initialFilter,
      sortBy: this.initialSort,
      sortDesc: this.initialSortDesc,
      searchDebounceTimeout: null
    }
  },
  computed: {
    isBatchSelecting() {
      return this.$store.getters['globals/getIsBatchSelectingMediaItems']
    },
    selectedMediaItems() {
      return this.$store.state.globals.selectedMediaItems || []
    }
  },
  watch: {
    initialSearch(newVal) {
      if (newVal !== this.searchQuery) {
        this.searchQuery = newVal
      }
    },
    initialFilter(newVal) {
      if (newVal !== this.filterBy) {
        this.filterBy = newVal
      }
    },
    initialSort(newVal) {
      if (newVal !== this.sortBy) {
        this.sortBy = newVal
      }
    },
    initialSortDesc(newVal) {
      if (newVal !== this.sortDesc) {
        this.sortDesc = newVal
      }
    }
  },
  methods: {
    onSearchInput() {
      // Clear existing timeout
      if (this.searchDebounceTimeout) {
        clearTimeout(this.searchDebounceTimeout)
      }
      // Set new timeout for debounced search
      this.searchDebounceTimeout = setTimeout(() => {
        this.emitChange()
      }, 500)
    },
    onSearchEnter() {
      // Clear timeout and perform search immediately
      if (this.searchDebounceTimeout) {
        clearTimeout(this.searchDebounceTimeout)
      }
      this.emitChange()
    },
    onSearchBlur() {
      // Perform search on blur if there's a pending change
      if (this.searchDebounceTimeout) {
        clearTimeout(this.searchDebounceTimeout)
        this.emitChange()
      }
    },
    updateFilter() {
      this.emitChange()
    },
    updateSort() {
      this.emitChange()
    },
    batchDownloadOffline() {
      const token = this.$store.getters['user/getToken']
      this.$store.dispatch('offline/enqueue', { libraryItems: this.selectedMediaItems, token })
      this.$toast.success(`Queued ${this.selectedMediaItems.length} items for download`)
    },
    emitChange() {
      this.$emit('change', {
        search: this.searchQuery.trim(),
        filter: this.filterBy,
        sort: this.sortBy,
        desc: this.sortDesc
      })
    }
  },
  beforeDestroy() {
    // Clear any pending search timeout
    if (this.searchDebounceTimeout) {
      clearTimeout(this.searchDebounceTimeout)
    }
  }
}
</script>

<style scoped>
/* Add any specific styles here */
</style>
