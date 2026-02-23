<template>
  <div>
    <div v-if="narrators?.length" class="flex py-0.5 mt-4">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelNarrators }}</span>
      </div>
      <div class="max-w-[calc(100vw-10rem)] overflow-hidden text-ellipsis">
        <template v-for="(narrator, index) in narrators">
          <nuxt-link :key="narrator" :to="`/library/${libraryId}/bookshelf?filter=narrators.${$encode(narrator)}`" class="hover:underline">{{ narrator }}</nuxt-link
          ><span :key="index" v-if="index < narrators.length - 1">,&nbsp;</span>
        </template>
      </div>
    </div>
    <div v-if="publishedYear" role="paragraph" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelPublishYear }}</span>
      </div>
      <div>
        {{ publishedYear }}
      </div>
    </div>
    <div v-if="publisher" role="paragraph" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelPublisher }}</span>
      </div>
      <div>
        <nuxt-link :to="`/library/${libraryId}/bookshelf?filter=publishers.${$encode(publisher)}`" class="hover:underline">{{ publisher }}</nuxt-link>
      </div>
    </div>
    <div v-if="podcastType" role="paragraph" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelPodcastType }}</span>
      </div>
      <div class="capitalize">
        {{ podcastType }}
      </div>
    </div>
    <div class="flex py-0.5" v-if="genres.length">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelGenres }}</span>
      </div>
      <div class="max-w-[calc(100vw-10rem)] overflow-hidden text-ellipsis">
        <template v-for="(genre, index) in genres">
          <nuxt-link :key="genre" :to="`/library/${libraryId}/bookshelf?filter=genres.${$encode(genre)}`" class="hover:underline">{{ genre }}</nuxt-link
          ><span :key="index" v-if="index < genres.length - 1">,&nbsp;</span>
        </template>
      </div>
    </div>
    <div class="flex py-0.5" v-if="tags.length">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelTags }}</span>
      </div>
      <div class="max-w-[calc(100vw-10rem)] overflow-hidden text-ellipsis">
        <template v-for="(tag, index) in tags">
          <nuxt-link :key="tag" :to="`/library/${libraryId}/bookshelf?filter=tags.${$encode(tag)}`" class="hover:underline">{{ tag }}</nuxt-link
          ><span :key="index" v-if="index < tags.length - 1">,&nbsp;</span>
        </template>
      </div>
    </div>
    <div v-if="!isPodcast && rating !== null && rating !== undefined" role="paragraph" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">Rating</span>
      </div>
      <div class="flex items-center">
        <span class="text-yellow-400 material-symbols fill text-lg mr-1">star</span>
        <span>{{ rating }} / 10</span>
      </div>
    </div>
    <div v-for="(urlItem, index) in urls" :key="'url-' + index" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span v-if="index === 0" class="text-white/60 uppercase text-sm">{{ urls.length === 1 ? 'URL' : 'URLs' }}</span>
      </div>
      <a :href="urlItem" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 hover:underline flex items-center truncate">
        <span class="truncate">{{ urlDisplayLabel(urlItem) }}</span>
        <span class="material-symbols text-sm ml-1 flex-shrink-0">open_in_new</span>
      </a>
    </div>
    <div v-if="relatedBooksData.length" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">Related Books</span>
      </div>
      <div class="max-w-[calc(100vw-10rem)]">
        <template v-for="(book, index) in relatedBooksData">
          <nuxt-link :key="book.id" :to="`/item/${book.libraryItemId}`" class="hover:underline">{{ book.title }}</nuxt-link
          ><span :key="`${book.id}-sep`" v-if="index < relatedBooksData.length - 1">,&nbsp;</span>
        </template>
      </div>
    </div>
    <div v-if="!isPodcast && viewedCount > 0" role="paragraph" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">Times Completed</span>
      </div>
      <div class="flex items-center">
        <span class="text-success material-symbols text-lg mr-1">check_circle</span>
        <span>{{ viewedCount }} {{ viewedCount === 1 ? 'time' : 'times' }}</span>
      </div>
    </div>
    <div v-if="!isPodcast && totalListeningTime > 0" role="paragraph" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">Total Listening Time</span>
      </div>
      <div class="flex items-center">
        <span class="text-blue-400 material-symbols text-lg mr-1">schedule</span>
        <span>{{ totalListeningTimeFormatted }}</span>
      </div>
    </div>
    <div v-if="language" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelLanguage }}</span>
      </div>
      <div>
        <nuxt-link :to="`/library/${libraryId}/bookshelf?filter=languages.${$encode(language)}`" class="hover:underline">{{ language }}</nuxt-link>
      </div>
    </div>
    <div v-if="tracks.length || (isPodcast && totalPodcastDuration)" role="paragraph" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelDuration }}</span>
      </div>
      <div>
        {{ durationPretty }}
      </div>
    </div>
    <div role="paragraph" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelSize }}</span>
      </div>
      <div>
        {{ sizePretty }}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      relatedBooksData: []
    }
  },
  computed: {
    libraryId() {
      return this.libraryItem.libraryId
    },
    isPodcast() {
      return this.libraryItem.mediaType === 'podcast'
    },
    media() {
      return this.libraryItem.media || {}
    },
    tracks() {
      return this.media.tracks || []
    },
    podcastEpisodes() {
      return this.media.episodes || []
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    publishedYear() {
      return this.mediaMetadata.publishedYear
    },
    genres() {
      return this.mediaMetadata.genres || []
    },
    tags() {
      return this.media.tags || []
    },
    podcastAuthor() {
      return this.mediaMetadata.author || ''
    },
    authors() {
      return this.mediaMetadata.authors || []
    },
    publisher() {
      return this.mediaMetadata.publisher || ''
    },
    narrators() {
      return this.mediaMetadata.narrators || []
    },
    language() {
      return this.mediaMetadata.language || null
    },
    rating() {
      return this.mediaMetadata.rating
    },
    urls() {
      const raw = this.mediaMetadata.url
      if (Array.isArray(raw)) return raw
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) return parsed
        } catch {}
        if (raw) return [raw]
      }
      return []
    },
    relatedBooks() {
      return this.mediaMetadata.relatedBooks || []
    },
    viewedCount() {
      return this.mediaMetadata.viewedCount || 0
    },
    totalListeningTime() {
      return this.mediaMetadata.totalListeningTime || 0
    },
    totalListeningTimeFormatted() {
      if (!this.totalListeningTime) return '0m'
      const hours = Math.floor(this.totalListeningTime / 60)
      const minutes = Math.round(this.totalListeningTime % 60)
      if (hours > 0) {
        return `${hours}h ${minutes}m`
      }
      return `${minutes}m`
    },
    durationPretty() {
      if (this.isPodcast) return this.$elapsedPrettyExtended(this.totalPodcastDuration)

      if (!this.tracks.length && !this.audioFile) return 'N/A'
      if (this.audioFile) return this.$elapsedPrettyExtended(this.duration)
      return this.$elapsedPretty(this.duration)
    },
    duration() {
      if (!this.tracks.length && !this.audioFile) return 0
      return this.media.duration
    },
    totalPodcastDuration() {
      if (!this.podcastEpisodes.length) return 0
      let totalDuration = 0
      this.podcastEpisodes.forEach((ep) => (totalDuration += ep.duration || 0))
      return totalDuration
    },
    sizePretty() {
      return this.$bytesPretty(this.media.size)
    },
    podcastType() {
      return this.mediaMetadata.type
    }
  },
  watch: {
    libraryItem: {
      immediate: true,
      handler(newVal) {
        if (newVal && newVal.relatedBooksData) {
          this.relatedBooksData = newVal.relatedBooksData
        } else {
          this.relatedBooksData = []
        }
      }
    }
  },
  methods: {
    urlDisplayLabel(url) {
      try {
        const u = new URL(url)
        if (u.hostname) return u.hostname + (u.pathname !== '/' ? u.pathname : '')
      } catch {}
      return url
    }
  },
  mounted() {}
}
</script>
