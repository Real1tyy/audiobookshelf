<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar is-home page="search" :search-query-text="query" />
    <app-book-shelf-categorized v-if="hasResults" ref="bookshelf" search :results="results" />
    <div v-else class="w-full py-16">
      <p class="text-xl text-center">{{ $getString('MessageNoSearchResultsFor', [query]) }}</p>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, redirect, query, app }) {
    const libraryId = params.library
    const library = await store.dispatch('libraries/fetch', libraryId)
    if (!library) {
      return redirect('/oops?message=Library not found')
    }
    const searchMode = query.mode || 'title'
    let results

    if (searchMode === 'transcript') {
      const transcripts = await app.$axios.$get(`/api/libraries/${libraryId}/search-transcripts?q=${encodeURIComponent(query.q)}&limit=50`).catch((error) => {
        console.error('Failed to search transcripts', error)
        return []
      })
      results = {
        podcasts: [],
        episodes: [],
        books: [],
        authors: [],
        series: [],
        tags: [],
        narrators: [],
        transcripts: transcripts || []
      }
    } else {
      const raw = await app.$axios.$get(`/api/libraries/${libraryId}/search?q=${encodeURIComponent(query.q)}`).catch((error) => {
        console.error('Failed to search library', error)
        return null
      })
      results = {
        podcasts: raw?.podcast || [],
        episodes: raw?.episodes || [],
        books: raw?.book || [],
        authors: raw?.authors || [],
        series: raw?.series || [],
        tags: raw?.tags || [],
        narrators: raw?.narrators || [],
        transcripts: raw?.transcripts || []
      }
    }

    return {
      libraryId,
      results,
      searchMode,
      query: query.q
    }
  },
  data() {
    return {}
  },
  watch: {
    '$route.query'(newVal, oldVal) {
      if (newVal && newVal.q && (newVal.q !== this.query || newVal.mode !== this.searchMode)) {
        this.query = newVal.q
        this.searchMode = newVal.mode || 'title'
        this.search()
      }
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    hasResults() {
      return Object.values(this.results).find((r) => !!r && r.length)
    }
  },
  methods: {
    async search() {
      if (this.searchMode === 'transcript') {
        const transcripts = await this.$axios.$get(`/api/libraries/${this.libraryId}/search-transcripts?q=${encodeURIComponent(this.query)}&limit=50`).catch((error) => {
          console.error('Failed to search transcripts', error)
          return []
        })
        this.results = {
          podcasts: [],
          episodes: [],
          books: [],
          authors: [],
          series: [],
          tags: [],
          narrators: [],
          transcripts: transcripts || []
        }
      } else {
        const results = await this.$axios.$get(`/api/libraries/${this.libraryId}/search?q=${encodeURIComponent(this.query)}`).catch((error) => {
          console.error('Failed to search library', error)
          return null
        })
        this.results = {
          podcasts: results?.podcast || [],
          episodes: results?.episodes || [],
          books: results?.book || [],
          authors: results?.authors || [],
          series: results?.series || [],
          tags: results?.tags || [],
          narrators: results?.narrators || [],
          transcripts: results?.transcripts || []
        }
      }
      this.$nextTick(() => {
        if (this.$refs.bookshelf) {
          this.$refs.bookshelf.setShelvesFromSearch()
        }
      })
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>
