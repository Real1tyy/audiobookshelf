<template>
  <modals-modal v-model="show" name="edit-series" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div v-if="series" class="p-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden" style="min-height: 400px; max-height: 80vh">
      <!-- Tabs -->
      <div class="flex border-b border-gray-600 mb-4">
        <button class="px-4 py-2 -mb-px" :class="activeTab === 'details' ? 'border-b-2 border-yellow-400 text-yellow-400' : 'text-gray-400 hover:text-white'" @click="activeTab = 'details'">
          {{ $strings.LabelDetails }}
        </button>
        <button class="px-4 py-2 -mb-px" :class="activeTab === 'books' ? 'border-b-2 border-yellow-400 text-yellow-400' : 'text-gray-400 hover:text-white'" @click="activeTab = 'books'; loadBooks()">
          {{ $strings.LabelBooks }} ({{ bookCount }})
        </button>
      </div>

      <!-- Details Tab -->
      <div v-show="activeTab === 'details'" class="flex">
        <div class="w-40 p-2">
          <div class="w-full h-45 relative">
            <covers-preview-cover :src="coverSrc" :width="128" :book-cover-aspect-ratio="bookCoverAspectRatio" />
            <div v-if="userCanDelete && !processing && seriesCopy.coverPath" class="absolute top-0 left-0 w-full h-full opacity-0 hover:opacity-100">
              <span class="absolute top-2 right-2 material-symbols text-error transform hover:scale-125 transition-transform cursor-pointer text-lg" @click="removeCover">delete</span>
            </div>
          </div>
        </div>
        <div class="grow">
          <form @submit.prevent="submitUploadCover" class="flex grow mb-2 p-2">
            <ui-text-input v-model="imageUrl" :placeholder="$strings.LabelImageURLFromTheWeb" class="h-9 w-full" />
            <ui-btn color="bg-success" type="submit" :padding-x="4" :disabled="!imageUrl" class="ml-2 sm:ml-3 w-24 h-9">{{ $strings.ButtonSubmit }}</ui-btn>
          </form>

          <div class="flex items-center mb-2 p-2">
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileSelect" />
            <ui-btn :disabled="processing" small @click="$refs.fileInput.click()">{{ $strings.ButtonUpload }}</ui-btn>
            <span v-if="selectedFile" class="ml-2 text-sm text-gray-300 truncate">{{ selectedFile.name }}</span>
          </div>

          <form v-if="series" @submit.prevent="submitForm">
            <div class="p-2">
              <ui-text-input-with-label v-model="seriesCopy.name" :disabled="processing" :label="$strings.LabelName" />
            </div>
            <div class="p-2">
              <ui-textarea-with-label v-model="seriesCopy.description" :disabled="processing" :label="$strings.LabelDescription" :rows="8" />
            </div>

            <div class="flex pt-2 px-2">
              <div class="grow" />
              <ui-btn type="submit">{{ $strings.ButtonSave }}</ui-btn>
            </div>
          </form>
        </div>
      </div>

      <!-- Books Order Tab -->
      <div v-show="activeTab === 'books'" class="overflow-y-auto" style="max-height: 60vh">
        <div v-if="loadingBooks" class="flex items-center justify-center py-8">
          <widgets-loading-spinner />
        </div>
        <div v-else-if="!seriesBooks.length" class="text-center py-8 text-gray-400">
          {{ $strings.MessageNoBooks }}
        </div>
        <div v-else>
          <p class="text-gray-400 text-xs mb-3 px-2">{{ $strings.MessageDragToReorder }}</p>
          <draggable v-model="seriesBooks" handle=".drag-handle" class="space-y-2" @end="onDragEnd">
            <div v-for="(book, index) in seriesBooks" :key="book.id" class="flex items-center bg-primary rounded-md p-2 group">
              <span class="drag-handle cursor-grab mr-2 text-gray-500 hover:text-white">
                <span class="material-symbols">drag_indicator</span>
              </span>
              <div class="w-10 h-14 mr-3 flex-shrink-0">
                <covers-preview-cover :src="getBookCoverSrc(book)" :width="40" :book-cover-aspect-ratio="bookCoverAspectRatio" />
              </div>
              <div class="grow min-w-0">
                <p class="truncate font-medium">{{ book.title }}</p>
                <p class="truncate text-gray-400 text-xs">{{ book.authorName }}</p>
              </div>
              <div class="flex items-center ml-2">
                <span class="text-gray-400 mr-2 text-sm">#</span>
                <input
                  v-model="book.sequence"
                  type="text"
                  class="w-16 bg-bg border border-gray-600 rounded px-2 py-1 text-center text-sm focus:border-yellow-400 focus:outline-none"
                  :placeholder="String(index + 1)"
                  @blur="markBookChanged(book)"
                />
              </div>
            </div>
          </draggable>

          <div class="flex pt-4 px-2">
            <div class="grow" />
            <ui-btn :disabled="!hasBookChanges || processing" @click="saveBookOrder">{{ $strings.ButtonSave }}</ui-btn>
          </div>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
import draggable from 'vuedraggable'

export default {
  components: {
    draggable
  },
  data() {
    return {
      seriesCopy: {
        name: '',
        description: '',
        coverPath: null
      },
      imageUrl: '',
      selectedFile: null,
      processing: false,
      activeTab: 'details',
      seriesBooks: [],
      originalBooks: [],
      loadingBooks: false,
      changedBookIds: new Set()
    }
  },
  watch: {
    series: {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.init()
        }
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showEditSeriesModal
      },
      set(val) {
        this.$store.commit('globals/setShowEditSeriesModal', val)
      }
    },
    series() {
      return this.$store.state.globals.selectedSeries
    },
    seriesId() {
      if (!this.series) return ''
      return this.series.id
    },
    title() {
      return this.$strings.HeaderUpdateSeries
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    coverSrc() {
      if (this.seriesCopy.coverPath) {
        return `${this.$config.routerBasePath}/api/series/${this.seriesId}/cover?ts=${this.seriesCopy.updatedAt || Date.now()}`
      }
      return null
    },
    bookCount() {
      return this.series?.libraryItems?.length || this.seriesBooks.length || 0
    },
    hasBookChanges() {
      return this.changedBookIds.size > 0
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    }
  },
  methods: {
    init() {
      this.imageUrl = ''
      this.selectedFile = null
      this.activeTab = 'details'
      this.seriesBooks = []
      this.originalBooks = []
      this.changedBookIds = new Set()
      this.seriesCopy = {
        ...this.series
      }
    },
    async loadBooks() {
      if (this.seriesBooks.length) return // Already loaded

      this.loadingBooks = true
      try {
        const data = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/series/${this.seriesId}?include=items`)
        const libraryItems = data.libraryItems || []

        this.seriesBooks = libraryItems.map((item) => {
          const seriesInfo = item.media?.metadata?.series?.find((s) => s.id === this.seriesId)
          return {
            id: item.id,
            bookId: item.media?.id,
            title: item.media?.metadata?.title || 'Unknown',
            authorName: item.media?.metadata?.authorName || '',
            coverPath: item.media?.coverPath,
            sequence: seriesInfo?.sequence || '',
            originalSequence: seriesInfo?.sequence || ''
          }
        })

        // Sort by sequence
        this.seriesBooks.sort((a, b) => {
          if (!a.sequence && !b.sequence) return 0
          if (!a.sequence) return 1
          if (!b.sequence) return -1
          return String(a.sequence).localeCompare(String(b.sequence), undefined, { numeric: true })
        })

        this.originalBooks = JSON.parse(JSON.stringify(this.seriesBooks))
      } catch (error) {
        console.error('Failed to load series books', error)
        this.$toast.error('Failed to load books')
      } finally {
        this.loadingBooks = false
      }
    },
    getBookCoverSrc(book) {
      if (!book.coverPath) return null
      return this.$store.getters['globals/getLibraryItemCoverSrc']({ id: book.id, media: { coverPath: book.coverPath } })
    },
    markBookChanged(book) {
      const original = this.originalBooks.find((b) => b.id === book.id)
      if (original && original.originalSequence !== book.sequence) {
        this.changedBookIds.add(book.id)
      } else {
        this.changedBookIds.delete(book.id)
      }
    },
    onDragEnd() {
      // Update sequences based on new order
      this.seriesBooks.forEach((book, index) => {
        const newSequence = String(index + 1)
        if (book.sequence !== newSequence) {
          book.sequence = newSequence
          this.changedBookIds.add(book.id)
        }
      })
    },
    async saveBookOrder() {
      if (!this.hasBookChanges) return

      this.processing = true
      try {
        const books = this.seriesBooks
          .filter((b) => this.changedBookIds.has(b.id))
          .map((b) => ({
            bookId: b.bookId,
            sequence: b.sequence || null
          }))

        await this.$axios.$patch(`/api/series/${this.seriesId}/books`, { books })
        this.$toast.success(this.$strings.ToastSeriesUpdateSuccess)

        // Update original sequences
        this.seriesBooks.forEach((book) => {
          book.originalSequence = book.sequence
        })
        this.changedBookIds.clear()
      } catch (error) {
        console.error('Failed to save book order', error)
        this.$toast.error(error.response?.data || this.$strings.ToastFailedToUpdate)
      } finally {
        this.processing = false
      }
    },
    handleFileSelect(event) {
      const file = event.target.files[0]
      if (file) {
        this.selectedFile = file
        this.uploadFilecover()
      }
    },
    async uploadFilecover() {
      if (!this.selectedFile) return

      this.processing = true
      const formData = new FormData()
      formData.append('cover', this.selectedFile)

      try {
        const data = await this.$axios.$post(`/api/series/${this.seriesId}/cover`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
        this.$toast.success(this.$strings.ToastSeriesUpdateSuccess)
        this.seriesCopy.updatedAt = data.series.updatedAt
        this.seriesCopy.coverPath = data.series.coverPath
      } catch (error) {
        console.error('Failed to upload cover', error)
        this.$toast.error(error.response?.data || this.$strings.ToastRemoveFailed)
      } finally {
        this.selectedFile = null
        if (this.$refs.fileInput) {
          this.$refs.fileInput.value = ''
        }
        this.processing = false
      }
    },
    async submitForm() {
      const keysToCheck = ['name', 'description']
      const updatePayload = {}
      keysToCheck.forEach((key) => {
        if (this.seriesCopy[key] !== this.series[key]) {
          updatePayload[key] = this.seriesCopy[key]
        }
      })
      if (!Object.keys(updatePayload).length) {
        this.$toast.info(this.$strings.ToastNoUpdatesNecessary)
        return
      }
      this.processing = true
      const result = await this.$axios.$patch(`/api/series/${this.seriesId}`, updatePayload).catch((error) => {
        console.error('Failed', error)
        const errorMsg = error.response ? error.response.data : null
        this.$toast.error(errorMsg || this.$strings.ToastFailedToUpdate)
        return null
      })
      if (result) {
        this.$toast.success(this.$strings.ToastSeriesUpdateSuccess)
        this.show = false
      }
      this.processing = false
    },
    removeCover() {
      this.processing = true
      this.$axios
        .$delete(`/api/series/${this.seriesId}/cover`)
        .then((data) => {
          this.$toast.success(this.$strings.ToastCoverRemoveSuccess)

          this.seriesCopy.updatedAt = data.series.updatedAt
          this.seriesCopy.coverPath = data.series.coverPath
        })
        .catch((error) => {
          console.error('Failed', error)
          this.$toast.error(this.$strings.ToastRemoveFailed)
        })
        .finally(() => {
          this.processing = false
        })
    },
    submitUploadCover() {
      if (!this.imageUrl?.startsWith('http:') && !this.imageUrl?.startsWith('https:')) {
        this.$toast.error(this.$strings.ToastInvalidImageUrl)
        return
      }

      this.processing = true
      const updatePayload = {
        url: this.imageUrl
      }
      this.$axios
        .$post(`/api/series/${this.seriesId}/cover`, updatePayload)
        .then((data) => {
          this.imageUrl = ''
          this.$toast.success(this.$strings.ToastSeriesUpdateSuccess)

          this.seriesCopy.updatedAt = data.series.updatedAt
          this.seriesCopy.coverPath = data.series.coverPath
        })
        .catch((error) => {
          console.error('Failed', error)
          this.$toast.error(error.response?.data || this.$strings.ToastRemoveFailed)
        })
        .finally(() => {
          this.processing = false
        })
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>
