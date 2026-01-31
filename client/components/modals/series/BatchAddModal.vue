<template>
  <modals-modal v-model="show" name="batch-series" :processing="processing" :width="500" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden pointer-events-none">
        <p class="text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>

    <div ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <div v-if="show" class="w-full h-full">
        <div class="py-4 px-4">
          <h1 class="text-2xl">{{ $getString('LabelAddToSeriesBatch', [selectedBookIds.length]) }}</h1>
        </div>

        <div class="px-4 pb-2">
          <ui-text-input v-model="searchQuery" :placeholder="$strings.LabelSearchSeries || 'Search series...'" class="w-full" @input="searchSeries" />
        </div>

        <div class="w-full overflow-y-auto overflow-x-hidden max-h-96">
          <div v-if="loadingSeries" class="flex h-32 items-center justify-center">
            <ui-loading-indicator />
          </div>
          <transition-group v-else name="list-complete" tag="div">
            <series-item v-for="series in displayedSeries" :key="series.id" :series="series" class="list-complete-item" @add="addToSeries" />
          </transition-group>
        </div>

        <div v-if="!loadingSeries && !displayedSeries.length && !searchQuery" class="flex h-32 items-center justify-center text-center px-2">
          <div>
            <p class="text-xl mb-2">{{ $strings.MessageNoSeries }}</p>
          </div>
        </div>

        <div v-if="!loadingSeries && !displayedSeries.length && searchQuery" class="flex h-32 items-center justify-center text-center px-2">
          <div>
            <p class="text-xl mb-2">{{ $strings.MessageNoResults || 'No results found' }}</p>
          </div>
        </div>

        <div v-if="hasMoreSeries && !searchQuery" class="flex justify-center py-2 px-4">
          <ui-btn small @click="loadMoreSeries">{{ $strings.ButtonLoadMore || 'Load More' }}</ui-btn>
        </div>

        <div class="w-full h-px bg-white/10" />
        <form @submit.prevent="submitCreateSeries">
          <div class="flex px-4 py-2 items-center text-center border-b border-white/10 text-white/80">
            <div class="grow px-2">
              <ui-text-input v-model="newSeriesName" :placeholder="$strings.PlaceholderNewSeries" class="w-full" />
            </div>
            <ui-btn type="submit" color="bg-success" :padding-x="4" class="h-10">{{ $strings.ButtonCreate }}</ui-btn>
          </div>
        </form>
      </div>
    </div>
  </modals-modal>
</template>

<script>
import SeriesItem from './SeriesItem.vue'

export default {
  components: {
    SeriesItem
  },
  data() {
    return {
      newSeriesName: '',
      processing: false,
      searchQuery: '',
      searchTimeout: null,
      displayedSeries: [],
      loadingSeries: false,
      currentPage: 0,
      totalSeries: 0,
      seriesPerPage: 5
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.searchQuery = ''
        this.currentPage = 0
        this.loadSeries()
        this.newSeriesName = ''
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showBatchSeriesModal
      },
      set(val) {
        this.$store.commit('globals/setShowBatchSeriesModal', val)
      }
    },
    title() {
      return this.$getString('MessageItemsSelected', [this.selectedBookIds.length])
    },
    selectedBookIds() {
      return (this.$store.state.globals.selectedMediaItems || []).map((i) => i.id)
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    hasMoreSeries() {
      return this.displayedSeries.length < this.totalSeries
    }
  },
  methods: {
    async loadSeries(append = false) {
      this.loadingSeries = true
      try {
        const params = new URLSearchParams()
        params.append('limit', this.seriesPerPage)
        params.append('page', this.currentPage)
        params.append('sort', 'name')
        params.append('desc', '0')
        if (this.searchQuery) {
          params.append('search', this.searchQuery)
        }

        const response = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/series?${params.toString()}`)

        if (append) {
          this.displayedSeries = [...this.displayedSeries, ...response.results]
        } else {
          this.displayedSeries = response.results
        }
        this.totalSeries = response.total
      } catch (error) {
        console.error('Failed to load series', error)
        this.$toast.error(this.$strings.ToastFailedToLoadData)
      } finally {
        this.loadingSeries = false
      }
    },
    loadMoreSeries() {
      this.currentPage++
      this.loadSeries(true)
    },
    searchSeries() {
      clearTimeout(this.searchTimeout)
      this.searchTimeout = setTimeout(() => {
        this.currentPage = 0
        this.loadSeries()
      }, 300)
    },
    async addToSeries(series) {
      if (!this.selectedBookIds.length) return
      this.processing = true

      // Fetch full library items to get their current series
      const libraryItems = await this.$axios
        .$post(`/api/items/batch/get`, { libraryItemIds: this.selectedBookIds })
        .then((res) => res.libraryItems)
        .catch((error) => {
          console.error('Failed to get items', error)
          this.$toast.error(this.$strings.ToastFailedToLoadData)
          return []
        })

      if (!libraryItems.length) {
        this.processing = false
        return
      }

      // Build update payloads - add series to each book's existing series
      const updates = libraryItems
        .map((li) => {
          const existingSeries = li.media.metadata.series || []
          // Check if series already exists on this book
          const alreadyHasSeries = existingSeries.some((s) => s.id === series.id)
          if (alreadyHasSeries) {
            return null
          }
          return {
            id: li.id,
            mediaPayload: {
              metadata: {
                series: [...existingSeries, { id: series.id, name: series.name, sequence: null }]
              }
            }
          }
        })
        .filter(Boolean)

      if (!updates.length) {
        this.$toast.info(this.$strings.MessageAllItemsAlreadyInSeries)
        this.processing = false
        return
      }

      this.$axios
        .$post('/api/items/batch/update', updates)
        .then((data) => {
          if (data.updates) {
            this.$toast.success(this.$getString('MessageItemsUpdated', [data.updates]))
            this.closeAndClearSelection()
          }
          this.processing = false
        })
        .catch((error) => {
          console.error('Failed to add items to series', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
          this.processing = false
        })
    },
    closeAndClearSelection() {
      this.show = false
      this.$store.commit('globals/resetSelectedMediaItems')
      this.$eventBus.$emit('bookshelf_clear_selection')
    },
    async submitCreateSeries() {
      if (!this.newSeriesName || !this.selectedBookIds.length) {
        return
      }
      this.processing = true

      // Fetch full library items
      const libraryItems = await this.$axios
        .$post(`/api/items/batch/get`, { libraryItemIds: this.selectedBookIds })
        .then((res) => res.libraryItems)
        .catch((error) => {
          console.error('Failed to get items', error)
          this.$toast.error(this.$strings.ToastFailedToLoadData)
          return []
        })

      if (!libraryItems.length) {
        this.processing = false
        return
      }

      // Build update payloads with the new series
      const newSeriesId = `new-${Date.now()}`
      const updates = libraryItems.map((li) => {
        const existingSeries = li.media.metadata.series || []
        return {
          id: li.id,
          mediaPayload: {
            metadata: {
              series: [...existingSeries, { id: newSeriesId, name: this.newSeriesName, sequence: null }]
            }
          }
        }
      })

      this.$axios
        .$post('/api/items/batch/update', updates)
        .then((data) => {
          if (data.updates) {
            this.$toast.success(this.$getString('MessageItemsUpdated', [data.updates]))
            this.newSeriesName = ''
            this.closeAndClearSelection()
          }
          this.processing = false
        })
        .catch((error) => {
          console.error('Failed to create series and add items', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
          this.processing = false
        })
    }
  },
  mounted() {}
}
</script>
