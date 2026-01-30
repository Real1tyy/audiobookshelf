<template>
  <modals-modal v-model="show" name="batch-genres" :processing="processing" :width="500" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden pointer-events-none">
        <p class="text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>

    <div ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <div v-if="show" class="w-full h-full">
        <div class="py-4 px-4">
          <h1 class="text-2xl">{{ $getString('LabelAddGenresBatch', [selectedBookIds.length]) }}</h1>
        </div>

        <div class="px-4 py-2">
          <ui-multi-select ref="genresSelect" v-model="selectedGenres" :label="$strings.LabelGenres" :items="genreItems" @newItem="newGenreItem" />
        </div>

        <div v-if="!genresList.length && !selectedGenres.length" class="flex h-24 items-center justify-center text-center px-2">
          <p class="text-lg text-gray-400">{{ $strings.MessageNoGenres }}</p>
        </div>

        <div class="w-full h-px bg-white/10 mt-2" />

        <div class="flex px-4 py-4 items-center justify-end">
          <ui-btn :disabled="!selectedGenres.length" color="bg-success" :padding-x="6" class="h-10" :loading="processing" @click="applyGenres">{{ $strings.ButtonApply }}</ui-btn>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      selectedGenres: [],
      newGenreItems: [],
      processing: false
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.selectedGenres = []
        this.newGenreItems = []
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showBatchGenresModal
      },
      set(val) {
        this.$store.commit('globals/setShowBatchGenresModal', val)
      }
    },
    title() {
      return this.$getString('MessageItemsSelected', [this.selectedBookIds.length])
    },
    filterData() {
      return this.$store.state.libraries.filterData || {}
    },
    genresList() {
      return this.filterData.genres || []
    },
    genreItems() {
      return [...this.genresList, ...this.newGenreItems]
    },
    selectedBookIds() {
      return (this.$store.state.globals.selectedMediaItems || []).map((i) => i.id)
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    }
  },
  methods: {
    newGenreItem(item) {
      if (!this.newGenreItems.includes(item)) {
        this.newGenreItems.push(item)
      }
    },
    async applyGenres() {
      if (!this.selectedBookIds.length || !this.selectedGenres.length) return
      this.processing = true

      // Fetch full library items to get their current genres
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

      // Build update payloads - add genres to each item's existing genres
      const updates = libraryItems
        .map((li) => {
          const existingGenres = li.media.metadata.genres || []
          // Add new genres that don't already exist
          const newGenres = this.selectedGenres.filter((genre) => !existingGenres.includes(genre))
          if (!newGenres.length) {
            return null
          }
          return {
            id: li.id,
            mediaPayload: {
              metadata: {
                genres: [...existingGenres, ...newGenres]
              }
            }
          }
        })
        .filter(Boolean)

      if (!updates.length) {
        this.$toast.info(this.$strings.MessageAllItemsAlreadyHaveGenres)
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
          console.error('Failed to add genres to items', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
          this.processing = false
        })
    },
    closeAndClearSelection() {
      this.show = false
      this.$store.commit('globals/resetSelectedMediaItems')
      this.$eventBus.$emit('bookshelf_clear_selection')
    }
  },
  mounted() {}
}
</script>
