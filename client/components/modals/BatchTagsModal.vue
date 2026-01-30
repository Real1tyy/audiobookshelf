<template>
  <modals-modal v-model="show" name="batch-tags" :processing="processing" :width="500" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden pointer-events-none">
        <p class="text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>

    <div ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <div v-if="show" class="w-full h-full">
        <div class="py-4 px-4">
          <h1 class="text-2xl">{{ $getString('LabelAddTagsBatch', [selectedBookIds.length]) }}</h1>
        </div>

        <div class="px-4 py-2">
          <ui-multi-select ref="tagsSelect" v-model="selectedTags" :label="$strings.LabelTags" :items="tagItems" @newItem="newTagItem" />
        </div>

        <div v-if="!tagsList.length && !selectedTags.length" class="flex h-24 items-center justify-center text-center px-2">
          <p class="text-lg text-gray-400">{{ $strings.MessageNoTags }}</p>
        </div>

        <div class="w-full h-px bg-white/10 mt-2" />

        <div class="flex px-4 py-4 items-center justify-end">
          <ui-btn :disabled="!selectedTags.length" color="bg-success" :padding-x="6" class="h-10" :loading="processing" @click="applyTags">{{ $strings.ButtonApply }}</ui-btn>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      selectedTags: [],
      newTagItems: [],
      processing: false
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.selectedTags = []
        this.newTagItems = []
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showBatchTagsModal
      },
      set(val) {
        this.$store.commit('globals/setShowBatchTagsModal', val)
      }
    },
    title() {
      return this.$getString('MessageItemsSelected', [this.selectedBookIds.length])
    },
    filterData() {
      return this.$store.state.libraries.filterData || {}
    },
    tagsList() {
      return this.filterData.tags || []
    },
    tagItems() {
      return [...this.tagsList, ...this.newTagItems]
    },
    selectedBookIds() {
      return (this.$store.state.globals.selectedMediaItems || []).map((i) => i.id)
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    }
  },
  methods: {
    newTagItem(item) {
      if (!this.newTagItems.includes(item)) {
        this.newTagItems.push(item)
      }
    },
    async applyTags() {
      if (!this.selectedBookIds.length || !this.selectedTags.length) return
      this.processing = true

      // Fetch full library items to get their current tags
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

      // Build update payloads - add tags to each item's existing tags
      const updates = libraryItems
        .map((li) => {
          const existingTags = li.media.tags || []
          // Add new tags that don't already exist
          const newTags = this.selectedTags.filter((tag) => !existingTags.includes(tag))
          if (!newTags.length) {
            return null
          }
          return {
            id: li.id,
            mediaPayload: {
              tags: [...existingTags, ...newTags]
            }
          }
        })
        .filter(Boolean)

      if (!updates.length) {
        this.$toast.info(this.$strings.MessageAllItemsAlreadyHaveTags)
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
          console.error('Failed to add tags to items', error)
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
