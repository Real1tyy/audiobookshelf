<template>
  <div class="flex items-center gap-2">
    <!-- Selected filters as removable chips -->
    <div class="flex flex-wrap gap-1 items-center min-w-0">
      <template v-if="selectedFilters.length">
        <button v-for="token in selectedFilters" :key="token" type="button" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-white/10 hover:bg-white/15 text-xs text-gray-100" :title="getFilterLabel(token)" @click.prevent="removeFilter(token)">
          <span class="truncate max-w-44">{{ getFilterLabel(token) }}</span>
          <span class="material-symbols text-base leading-none opacity-80">close</span>
        </button>

        <button type="button" class="text-xs text-gray-300 hover:text-white px-1" @click.prevent="clearAll">
          {{ $strings.ButtonClearFilter || 'Clear' }}
        </button>
      </template>
      <span v-else class="text-xs text-gray-300 truncate">{{ $strings.LabelAll }}</span>
    </div>

    <!-- Picker: reuse the same dropdown as Library page to add ONE filter at a time -->
    <div class="shrink-0">
      <controls-library-filter-select v-model="pendingFilter" class="w-36 sm:w-44 md:w-48 h-7.5" @change="onPicked" />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: {
      type: String,
      default: 'all'
    }
  },
  data() {
    return {
      // Always keep the picker at "all" so it acts like an "Add filter" dropdown.
      pendingFilter: 'all'
    }
  },
  computed: {
    selectedFilters() {
      if (!this.value || this.value === 'all') return []
      return this.value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => !!v && v !== 'all')
    },
    filterData() {
      return this.$store.state.libraries.filterData || {}
    }
  },
  methods: {
    normalizeToken(token) {
      if (!token) return token
      const parts = String(token).split('.')
      if (parts.length <= 1) return token
      const group = parts[0]
      const encoded = parts.slice(1).join('.')
      // LibraryFilterSelect emits values that are already URI-encoded (e.g. ...%3D).
      // If we store that directly and later build URLs with URLSearchParams, it gets encoded again (%253D),
      // which breaks server decoding. Normalize back to raw base64 payload (decodeURIComponent once).
      try {
        return `${group}.${decodeURIComponent(encoded)}`
      } catch (e) {
        return token
      }
    },
    emitValue(tokens) {
      const unique = []
      for (const raw of tokens) {
        const t = this.normalizeToken(raw)
        if (!t || t === 'all') continue
        if (!unique.includes(t)) unique.push(t)
      }
      const val = unique.length ? unique.join(',') : 'all'
      this.$emit('input', val)
      this.$emit('change', val)
    },
    onPicked(val) {
      if (!val || val === 'all') {
        // Selecting "All" acts as "clear all"
        this.clearAll()
        this.pendingFilter = 'all'
        return
      }

      const next = [...this.selectedFilters, val]
      this.emitValue(next)

      // Reset picker back to "all" for the next addition
      this.pendingFilter = 'all'
    },
    removeFilter(token) {
      const next = this.selectedFilters.filter((t) => t !== token)
      this.emitValue(next)
    },
    clearAll() {
      this.emitValue([])
    },
    decodeTokenValue(encodedValue) {
      try {
        return this.$decode(encodedValue)
      } catch (e) {
        return encodedValue
      }
    },
    getFilterLabel(token) {
      if (!token) return ''
      const parts = token.split('.')
      const group = parts[0]
      const encodedValue = parts.length > 1 ? parts.slice(1).join('.') : null
      const decodedValue = encodedValue ? this.decodeTokenValue(encodedValue) : null

      const groupLabels = {
        genres: this.$strings.LabelGenre,
        tags: this.$strings.LabelTag,
        series: this.$strings.LabelSeries,
        authors: this.$strings.LabelAuthor,
        narrators: this.$strings.LabelNarrator,
        publishers: this.$strings.LabelPublisher,
        publishedDecades: this.$strings.LabelPublishedDecade,
        languages: this.$strings.LabelLanguage,
        progress: this.$strings.LabelProgress,
        missing: this.$strings.LabelMissing,
        tracks: this.$strings.LabelTracks,
        ebooks: this.$strings.LabelEbooks,
        abridged: this.$strings.LabelAbridged,
        issues: this.$strings.ButtonIssues,
        'feed-open': this.$strings.LabelRSSFeedOpen,
        explicit: this.$strings.LabelExplicit,
        'share-open': this.$strings.LabelShareOpen
      }

      // Simple filter (no ".")
      if (!encodedValue) {
        return groupLabels[group] || group
      }

      // Resolve special values for nicer labels
      let valueLabel = decodedValue
      if (group === 'authors') {
        const author = (this.filterData.authors || []).find((au) => au.id == decodedValue)
        if (author) valueLabel = author.name
      } else if (group === 'series') {
        if (decodedValue === 'no-series') {
          valueLabel = this.$strings.MessageNoSeries
        } else {
          const series = (this.filterData.series || []).find((se) => se.id == decodedValue)
          if (series) valueLabel = series.name
        }
      } else if (group === 'progress') {
        const progressLabels = {
          finished: this.$strings.LabelFinished,
          'in-progress': this.$strings.LabelInProgress,
          'not-started': this.$strings.LabelNotStarted,
          'not-finished': this.$strings.LabelNotFinished,
          'audio-in-progress': this.$strings.LabelInProgress,
          'ebook-in-progress': this.$strings.LabelInProgress,
          'ebook-finished': this.$strings.LabelFinished
        }
        valueLabel = progressLabels[decodedValue] || decodedValue
      }

      const g = groupLabels[group] || group
      return valueLabel ? `${g}: ${valueLabel}` : g
    }
  }
}
</script>
