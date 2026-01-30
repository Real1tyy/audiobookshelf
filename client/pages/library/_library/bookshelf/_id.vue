<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar :page="id || ''" />
    <app-lazy-bookshelf :page="id || ''" />
  </div>
</template>

<script>
export default {
  async asyncData({ params, query, store, redirect }) {
    var libraryId = params.library
    var libraryData = await store.dispatch('libraries/fetch', libraryId)
    if (!libraryData) {
      return redirect('/oops?message=Library not found')
    }

    // Set series sort by and search query
    if (query.filter || query.sort || query.desc || query.q) {
      const isSeries = params.id === 'series'
      const isLibrary = !params.id || params.id === ''
      const settingsUpdate = {
        [isSeries ? 'seriesFilterBy' : 'filterBy']: query.filter || undefined,
        [isSeries ? 'seriesSortBy' : 'orderBy']: query.sort || undefined,
        [isSeries ? 'seriesSortDesc' : 'orderDesc']: query.desc == '0' ? false : query.desc == '1' ? true : undefined
      }
      // Add search query for library page
      if (isLibrary && query.q !== undefined) {
        settingsUpdate.librarySearchQuery = query.q || ''
      }
      store.dispatch('user/updateUserSettings', settingsUpdate)
    }

    // Redirect podcast libraries
    const library = libraryData.library
    if (library.mediaType === 'podcast' && (params.id === 'collections' || params.id === 'series' || params.id === 'authors')) {
      return redirect(`/library/${libraryId}`)
    }

    return {
      id: params.id || '',
      libraryId
    }
  },
  data() {
    return {}
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    }
  },
  methods: {}
}
</script>
