<template>
  <div class="">
    <div class="flex items-center">
      <select v-model="searchMode" class="h-8 text-sm bg-fg border border-gray-500 rounded-sm text-gray-200 px-1 mr-1 outline-none cursor-pointer hover:bg-bg/40" style="min-width: 100px">
        <option value="title">Title</option>
        <option value="transcript">Transcript</option>
      </select>
      <div class="w-full relative sm:w-80">
        <form role="search" @submit.prevent="submitSearch">
          <ui-text-input ref="input" v-model="search" :placeholder="searchMode === 'transcript' ? 'Search transcripts...' : $strings.PlaceholderSearch" @input="inputUpdate" @focus="focussed" @blur="blurred" class="w-full h-8 text-sm" />
        </form>
        <button :aria-hidden="!search" class="absolute top-0 right-0 bottom-0 h-full flex items-center px-2 text-gray-400 cursor-pointer" @click="clickClear">
          <span v-if="!search" class="material-symbols" style="font-size: 1.2rem">&#xe8b6;</span>
          <span v-else class="material-symbols" style="font-size: 1.2rem">close</span>
        </button>
      </div>
    </div>
    <div v-show="showMenu && (lastSearch || isTyping)" class="absolute z-40 -mt-px w-full max-w-64 sm:max-w-80 sm:w-80 bg-bg border border-black-200 shadow-lg rounded-md py-1 px-2 text-base ring-1 ring-black/5 overflow-auto focus:outline-hidden sm:text-sm globalSearchMenu" :style="{ left: menuLeftOffset }" @mousedown.stop.prevent>
      <ul class="h-full w-full" role="listbox" aria-labelledby="listbox-label">
        <li v-if="isTyping" class="py-2 px-2">
          <p>{{ $strings.MessageThinking }}</p>
        </li>
        <li v-else-if="isFetching" class="py-2 px-2">
          <p>{{ $strings.MessageFetching }}</p>
        </li>
        <li v-else-if="!totalResults" class="py-2 px-2">
          <p>{{ $strings.MessageNoResults }}</p>
        </li>
        <template v-else-if="searchMode === 'transcript'">
          <p class="uppercase text-xs text-gray-400 my-1 px-1 font-semibold">Transcript Matches</p>
          <template v-for="item in transcriptResults">
            <li :key="'tr-' + item.libraryItemId" class="text-gray-50 select-none relative cursor-pointer hover:bg-black-400 py-2 px-1 rounded" role="option" @click="clickOption">
              <nuxt-link :to="`/item/${item.libraryItemId}`" class="block">
                <p class="text-xs font-semibold text-gray-100 truncate">{{ item.title }}</p>
                <p class="text-xs text-gray-400 mt-1 leading-relaxed transcript-snippet" v-html="item.snippet"></p>
              </nuxt-link>
            </li>
          </template>
        </template>
        <template v-else>
          <p v-if="bookResults.length" class="uppercase text-xs text-gray-400 my-1 px-1 font-semibold">{{ $strings.LabelBooks }}</p>
          <template v-for="item in bookResults">
            <li :key="item.libraryItem.id" class="text-gray-50 select-none relative cursor-pointer hover:bg-black-400 py-1" role="option" @click="clickOption">
              <nuxt-link :to="`/item/${item.libraryItem.id}`">
                <cards-item-search-card :library-item="item.libraryItem" />
              </nuxt-link>
            </li>
          </template>

          <p v-if="authorResults.length" class="uppercase text-xs text-gray-400 mb-1 mt-3 px-1 font-semibold">{{ $strings.LabelAuthors }}</p>
          <template v-for="item in authorResults">
            <li :key="item.id" class="text-gray-50 select-none relative cursor-pointer hover:bg-black-400 py-1" role="option" @click="clickOption">
              <nuxt-link :to="`/author/${item.id}`">
                <cards-author-search-card :author="item" />
              </nuxt-link>
            </li>
          </template>

          <p v-if="seriesResults.length" class="uppercase text-xs text-gray-400 mb-1 mt-3 px-1 font-semibold">{{ $strings.LabelSeries }}</p>
          <template v-for="item in seriesResults">
            <li :key="item.series.id" class="text-gray-50 select-none relative cursor-pointer hover:bg-black-400 py-1" role="option" @click="clickOption">
              <nuxt-link :to="`/library/${currentLibraryId}/series/${item.series.id}`">
                <cards-series-search-card :series="item.series" :book-items="item.books" />
              </nuxt-link>
            </li>
          </template>

          <p v-if="tagResults.length" class="uppercase text-xs text-gray-400 mb-1 mt-3 px-1 font-semibold">{{ $strings.LabelTags }}</p>
          <template v-for="item in tagResults">
            <li :key="`tag.${item.name}`" class="text-gray-50 select-none relative cursor-pointer hover:bg-black-400 py-1" role="option" @click="clickOption">
              <nuxt-link :to="`/library/${currentLibraryId}/bookshelf?filter=tags.${$encode(item.name)}`">
                <cards-tag-search-card :tag="item.name" :num-items="item.numItems" />
              </nuxt-link>
            </li>
          </template>

          <p v-if="genreResults.length" class="uppercase text-xs text-gray-400 mb-1 mt-3 px-1 font-semibold">{{ $strings.LabelGenres }}</p>
          <template v-for="item in genreResults">
            <li :key="`genre.${item.name}`" class="text-gray-50 select-none relative cursor-pointer hover:bg-black-400 py-1" role="option" @click="clickOption">
              <nuxt-link :to="`/library/${currentLibraryId}/bookshelf?filter=genres.${$encode(item.name)}`">
                <cards-genre-search-card :genre="item.name" :num-items="item.numItems" />
              </nuxt-link>
            </li>
          </template>

        </template>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      showMenu: false,
      isFocused: false,
      focusTimeout: null,
      isTyping: false,
      isFetching: false,
      search: null,
      searchMode: 'title',
      bookResults: [],
      authorResults: [],
      seriesResults: [],
      tagResults: [],
      genreResults: [],
      transcriptResults: [],
      searchTimeout: null,
      lastSearch: null
    }
  },
  computed: {
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    menuLeftOffset() {
      return this.searchMode ? '110px' : '0'
    },
    totalResults() {
      if (this.searchMode === 'transcript') {
        return this.transcriptResults.length
      }
      return this.bookResults.length + this.seriesResults.length + this.authorResults.length + this.tagResults.length + this.genreResults.length
    }
  },
  watch: {
    searchMode() {
      if (this.lastSearch) {
        this.runSearch(this.lastSearch)
      }
    }
  },
  methods: {
    clickOption() {
      this.clearResults()
    },
    submitSearch() {
      if (!this.search) return
      var search = this.search
      var mode = this.searchMode
      this.clearResults()
      this.$router.push(`/library/${this.currentLibraryId}/search?q=${encodeURIComponent(search)}&mode=${mode}`)
    },
    clearResults() {
      this.search = null
      this.lastSearch = null
      this.bookResults = []
      this.authorResults = []
      this.seriesResults = []
      this.tagResults = []
      this.genreResults = []
      this.transcriptResults = []
      this.showMenu = false
      this.isFetching = false
      this.isTyping = false
      clearTimeout(this.searchTimeout)
      this.$nextTick(() => {
        if (this.$refs.input) {
          this.$refs.input.blur()
        }
      })
    },
    focussed() {
      this.isFocused = true
      this.showMenu = true
    },
    blurred() {
      this.isFocused = false
      clearTimeout(this.focusTimeout)
      this.focusTimeout = setTimeout(() => {
        this.showMenu = false
      }, 100)
    },
    async runSearch(value) {
      this.lastSearch = value
      if (!this.lastSearch) {
        return
      }
      this.isFetching = true

      if (this.searchMode === 'transcript') {
        const results = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/search-transcripts?q=${encodeURIComponent(value)}&limit=5`).catch((error) => {
          console.error('Transcript search error', error)
          return {}
        })
        if (!this.isFetching) return
        this.transcriptResults = results.transcripts || []
        this.bookResults = []
        this.authorResults = []
        this.seriesResults = []
        this.tagResults = []
        this.genreResults = []
      } else {
        const searchResults = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/search?q=${encodeURIComponent(value)}&limit=3`).catch((error) => {
          console.error('Search error', error)
          return []
        })
        if (!this.isFetching) return
        this.bookResults = searchResults.book || []
        this.authorResults = searchResults.authors || []
        this.seriesResults = searchResults.series || []
        this.tagResults = searchResults.tags || []
        this.genreResults = searchResults.genres || []
        this.transcriptResults = []
      }

      this.isFetching = false
      if (!this.showMenu) {
        return
      }
    },
    inputUpdate(val) {
      clearTimeout(this.searchTimeout)
      if (!val) {
        this.lastSearch = ''
        this.isTyping = false
        return
      }
      this.isTyping = true
      this.searchTimeout = setTimeout(() => {
        // Canceled search
        if (!this.isTyping) return

        this.isTyping = false
        this.runSearch(val)
      }, 750)
    },
    clickClear() {
      this.clearResults()
    }
  },
  mounted() {}
}
</script>

<style scoped>
.globalSearchMenu {
  max-height: calc(100vh - 75px);
}
.transcript-snippet :deep(mark) {
  background-color: rgba(255, 255, 0, 0.3);
  color: inherit;
  padding: 0 2px;
  border-radius: 2px;
}
</style>
