<template>
  <div class="w-full bg-bg border-b border-white/10 relative z-30">
    <div class="flex items-center justify-between px-4 md:px-8 py-3 gap-4">
      <!-- Left side: Book count -->
      <div class="flex items-center gap-4">
        <p class="text-base md:text-lg font-semibold">{{ totalBooks }} {{ $strings.LabelBooks }}</p>
      </div>

      <!-- Right side: Search, Filter, Sort -->
      <div class="flex items-center gap-2 flex-grow justify-end max-w-3xl">
        <!-- Search input -->
        <div class="flex-grow max-w-md">
          <ui-text-input v-model="searchQuery" :placeholder="$strings.PlaceholderSearch || 'Search books...'" class="w-full" @input="onSearchInput" @keydown.enter="onSearchEnter" @blur="onSearchBlur" />
        </div>

        <!-- Filter select -->
        <controls-author-books-filter-select v-if="!isBatchSelecting" v-model="filterBy" class="w-36 sm:w-44 md:w-48 h-7.5" @change="updateFilter" />

        <!-- Sort select -->
        <controls-author-books-sort-select v-if="!isBatchSelecting" v-model="sortBy" :descending.sync="sortDesc" class="w-36 sm:w-44 md:w-48 h-7.5" @change="updateSort" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
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
      default: 'addedAt'
    },
    initialSortDesc: {
      type: Boolean,
      default: true
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
