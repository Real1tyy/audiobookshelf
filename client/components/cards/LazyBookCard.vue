<template>
  <div ref="card" :id="`book-card-${index}`" tabindex="0" :style="{ minWidth: coverWidth + 'px', maxWidth: coverWidth + 'px' }" class="absolute rounded-xs z-10 cursor-pointer" @mousedown.prevent @mouseup.prevent @mousemove.prevent @mouseover="mouseover" @mouseleave="mouseleave" @click="clickCard" @auxclick.prevent="middleClickCard">
    <div :id="`cover-area-${index}`" class="relative w-full top-0 left-0 rounded-sm overflow-hidden z-10 bg-primary box-shadow-book" :style="{ height: coverHeight + 'px ' }">
      <!-- When cover image does not fill -->
      <div cy-id="coverBg" v-show="showCoverBg" class="absolute top-0 left-0 w-full h-full overflow-hidden rounded-xs bg-primary">
        <div class="absolute cover-bg" ref="coverBg" />
      </div>

      <div cy-id="seriesSequenceList" v-if="seriesSequenceList" class="absolute rounded-lg bg-black/90 box-shadow-md z-20 text-right" :style="{ top: 0.375 + 'em', right: 0.375 + 'em', padding: `0.1em 0.25em` }" style="background-color: #78350f">
        <p :style="{ fontSize: 0.8 + 'em' }">#{{ seriesSequenceList }}</p>
      </div>
      <div cy-id="booksInSeries" v-else-if="booksInSeries" class="absolute rounded-lg bg-black/90 box-shadow-md z-20" :style="{ top: 0.375 + 'em', right: 0.375 + 'em', padding: `0.1em 0.25em` }" style="background-color: #cd9d49dd">
        <p :style="{ fontSize: 0.8 + 'em' }">{{ booksInSeries }}</p>
      </div>

      <!-- Listening stats badge (top center) -->
      <div
        cy-id="listeningStats"
        v-if="hasListeningStats && !isHovering && !isSelectionMode && !booksInSeries"
        class="absolute z-20 flex items-center rounded-b-md shadow-md"
        :style="{ top: 0, left: '50%', transform: 'translateX(-50%)', padding: '0.15em 0.4em', gap: '0.5em', backgroundColor: 'rgba(0, 0, 0, 0.85)' }"
      >
        <div v-if="viewedCount > 0" class="flex items-center" :style="{ gap: '0.15em' }">
          <span class="material-symbols fill text-green-400" :style="{ fontSize: 0.7 + 'em' }">headphones</span>
          <span class="text-green-400 font-bold" :style="{ fontSize: 0.65 + 'em' }">{{ viewedCount }}</span>
        </div>
        <div v-if="totalListeningMinutes > 0" class="flex items-center" :style="{ gap: '0.15em' }">
          <span class="material-symbols fill text-blue-400" :style="{ fontSize: 0.7 + 'em' }">schedule</span>
          <span class="text-blue-400 font-bold" :style="{ fontSize: 0.65 + 'em' }">{{ formattedListeningTime }}</span>
        </div>
        <div v-if="isDownloadedOffline" class="flex items-center">
          <span class="material-symbols fill text-success" :style="{ fontSize: 0.7 + 'em' }">cloud_done</span>
        </div>
      </div>

      <div class="w-full h-full absolute top-0 left-0 rounded-sm overflow-hidden z-10">
        <div cy-id="titleImageNotReady" v-show="libraryItem && !imageReady" aria-hidden="true" class="absolute top-0 left-0 w-full h-full flex items-center justify-center" :style="{ padding: 0.5 + 'em' }">
          <p :style="{ fontSize: 0.8 + 'em' }" class="text-gray-300 text-center">{{ title }}</p>
        </div>

        <!-- Cover Image -->
        <img cy-id="coverImage" v-if="libraryItem" :alt="`${displayTitle}, ${$strings.LabelCover}`" ref="cover" aria-hidden="true" :src="bookCoverSrc" class="relative w-full h-full transition-opacity duration-300" :class="showCoverBg ? 'object-contain' : 'object-fill'" @load="imageLoaded" :style="{ opacity: imageReady ? 1 : 0 }" />

        <!-- Placeholder Cover Title & Author -->
        <div cy-id="placeholderTitle" v-if="!hasCover" class="absolute top-0 left-0 right-0 bottom-0 w-full h-full flex items-center justify-center" :style="{ padding: placeholderCoverPadding + 'em' }">
          <div>
            <p cy-id="placeholderTitleText" aria-hidden="true" class="text-center" style="color: rgb(247 223 187)" :style="{ fontSize: titleFontSize + 'em' }">{{ titleCleaned }}</p>
          </div>
        </div>
        <div cy-id="placeholderAuthor" v-if="!hasCover" class="absolute left-0 right-0 w-full flex items-center justify-center" :style="{ padding: placeholderCoverPadding + 'em', bottom: authorBottom + 'em' }">
          <p cy-id="placeholderAuthorText" aria-hidden="true" class="text-center" style="color: rgb(247 223 187); opacity: 0.75" :style="{ fontSize: authorFontSize + 'em' }">{{ authorCleaned }}</p>
        </div>

        <div cy-id="progressBar" class="absolute bottom-0 left-0 h-1e max-w-full z-20 rounded-b box-shadow-progressbar" :class="itemIsFinished ? 'bg-success' : 'bg-yellow-400'" :style="{ width: coverWidth * userProgressPercent + 'px' }"></div>

        <!-- Overlay is not shown if collapsing series in library -->
        <div cy-id="overlay" v-show="!booksInSeries && libraryItem && (isHovering || isSelectionMode || isMoreMenuOpen) && !processing" class="w-full h-full absolute top-0 left-0 z-10 bg-black rounded-sm md:block" :class="overlayWrapperClasslist">
          <div cy-id="playButton" v-show="showPlayButton" class="h-full flex items-center justify-center pointer-events-none">
            <div class="hover:text-white text-gray-200 hover:scale-110 transform duration-200 pointer-events-auto" @click.stop.prevent="play">
              <span class="material-symbols fill" :style="{ fontSize: playIconFontSize + 'em' }">play_arrow</span>
            </div>
          </div>

          <div cy-id="readButton" v-show="showReadButton" class="h-full flex items-center justify-center pointer-events-none">
            <div class="hover:text-white text-gray-200 hover:scale-110 transform duration-200 pointer-events-auto" @click.stop.prevent="clickReadEBook">
              <span class="material-symbols" :style="{ fontSize: playIconFontSize + 'em' }">auto_stories</span>
            </div>
          </div>

          <div cy-id="editButton" v-if="userCanUpdate" v-show="!isSelectionMode" class="absolute cursor-pointer hover:text-yellow-300 hover:scale-125 transform duration-150 top-0 right-0" :style="{ padding: 0.375 + 'em' }" @click.stop.prevent="editClick">
            <span class="material-symbols" :style="{ fontSize: 1 + 'em' }">edit</span>
          </div>

          <!-- Add to Queue button -->
          <div cy-id="addToQueueButton" v-if="showQuickAddToQueue" v-show="!isSelectionMode" class="absolute cursor-pointer hover:text-yellow-300 hover:scale-125 transform duration-150 right-0" :style="{ top: userCanUpdate ? 1.75 + 'em' : 0.375 + 'em', padding: 0.375 + 'em' }" @click.stop.prevent="addToQueue">
            <span class="material-symbols" :style="{ fontSize: 1 + 'em' }">queue_music</span>
          </div>

          <!-- Radio button -->
          <div cy-id="selectedRadioButton" class="absolute cursor-pointer hover:text-yellow-300 hover:scale-125 transform duration-100" :style="{ top: 0.375 + 'em', left: 0.375 + 'em' }" @click.stop.prevent="selectBtnClick">
            <span class="material-symbols" :class="selected ? 'text-yellow-400' : ''" :style="{ fontSize: 1.25 + 'em' }">{{ selected ? 'radio_button_checked' : 'radio_button_unchecked' }}</span>
          </div>

          <!-- More Menu Icon -->
          <div cy-id="moreButton" ref="moreIcon" v-show="!isSelectionMode && moreMenuItems.length" class="md:block absolute cursor-pointer hover:text-yellow-300 300 hover:scale-125 transform duration-150" :style="{ bottom: 0.375 + 'em', right: 0.375 + 'em' }" @click.stop.prevent="clickShowMore">
            <span class="material-symbols" :style="{ fontSize: 1.2 + 'em' }">more_vert</span>
          </div>

          <div cy-id="ebookFormat" v-if="ebookFormat" class="absolute" :style="{ bottom: 0.375 + 'em', left: 0.375 + 'em' }">
            <span class="text-white/80" :style="{ fontSize: 0.8 + 'em' }">{{ ebookFormat }}</span>
          </div>
        </div>

        <!-- Processing/loading spinner overlay -->
        <div cy-id="loadingSpinner" v-if="processing" class="w-full h-full absolute top-0 left-0 z-10 bg-black/40 rounded-sm flex items-center justify-center">
          <widgets-loading-spinner size="la-lg" />
        </div>

        <!-- Series name overlay -->
        <div cy-id="seriesNameOverlay" v-if="booksInSeries && libraryItem && isHovering" class="w-full h-full absolute top-0 left-0 z-10 bg-black/60 rounded-sm flex items-center justify-center" :style="{ padding: 1 + 'em' }">
          <p v-if="seriesName" class="text-gray-200 text-center" :style="{ fontSize: 1.1 + 'em' }">{{ seriesName }}</p>
        </div>

        <!-- Error widget -->
        <ui-tooltip cy-id="ErrorTooltip" v-if="showError" :text="errorText" plaintext class="absolute bottom-4e left-0 z-10">
          <div :style="{ height: 1.5 + 'em', width: 2.5 + 'em' }" class="bg-error rounded-r-full shadow-md flex items-center justify-end border-r border-b border-red-300">
            <span class="material-symbols text-red-100 pr-1e" :style="{ fontSize: 0.875 + 'em' }">priority_high</span>
          </div>
        </ui-tooltip>

        <!-- media item shared icon -->
        <div cy-id="mediaItemShare" v-if="mediaItemShare && !isSelectionMode && !isHovering" class="absolute text-success left-0 z-10" :style="{ padding: 0.375 + 'em', top: '0px' }">
          <span class="material-symbols" aria-hidden="true" :style="{ fontSize: 1.5 + 'em' }">public</span>
        </div>

        <!-- Series sequence -->
        <div cy-id="seriesSequence" v-if="seriesSequence && !isHovering && !isSelectionMode" class="absolute rounded-lg bg-black/90 box-shadow-md z-10" :style="{ top: 0.375 + 'em', right: 0.375 + 'em', padding: `${0.1}em ${0.25}em` }">
          <p :style="{ fontSize: 0.8 + 'em' }">#{{ seriesSequence }}</p>
        </div>

        <!-- Rating and Tags container -->
        <div
          v-if="(rating !== null || displayTags.length) && !isHovering && !isSelectionMode && !booksInSeries"
          class="absolute left-0 right-0 z-10 flex flex-col items-start"
          :style="{ bottom: userProgressPercent > 0 ? '0.5em' : '0.3em', padding: '0 0.3em', gap: '0.25em' }"
        >
          <!-- Rating display -->
          <div
            cy-id="ratingDisplay"
            v-if="rating !== null"
            class="flex items-center bg-yellow-500/95 text-black font-bold rounded-sm shadow-md"
            :style="{ fontSize: 0.75 + 'em', padding: '0.2em 0.4em' }"
          >
            <span class="material-symbols fill text-base mr-1" style="font-size: 1em">star</span>
            <span>{{ rating }}</span>
          </div>

          <!-- Tags display -->
          <div cy-id="tagsDisplay" v-if="displayTags.length" class="flex flex-wrap" :style="{ gap: '0.25em' }">
            <div v-for="tag in displayTags" :key="tag" class="bg-black/85 text-white font-semibold rounded-sm truncate" :style="{ fontSize: 0.75 + 'em', padding: '0.15em 0.4em', maxWidth: '100%' }">
              {{ tag }}
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Alternative bookshelf title/author/sort -->
    <div cy-id="detailBottom" :id="`description-area-${index}`" v-if="isAlternativeBookshelfView || isAuthorBookshelfView" dir="auto" class="relative mt-2e mb-2e left-0 z-50 w-full">
      <div :style="{ fontSize: 0.9 + 'em' }">
        <ui-tooltip v-if="displayTitle" :text="displayTitle" plaintext :disabled="!displayTitleTruncated" direction="bottom" :delayOnShow="500" class="flex items-center">
          <nuxt-link cy-id="title" ref="displayTitle" :to="itemLink" class="truncate hover:underline" @click.native.stop>{{ displayTitle }}</nuxt-link>
          <widgets-explicit-indicator cy-id="explicitIndicator" v-if="isExplicit" />
        </ui-tooltip>
      </div>
      <ui-tooltip v-if="showSubtitles" :text="displaySubtitle" plaintext :disabled="!displaySubtitleTruncated" direction="bottom" :delayOnShow="500" class="flex items-center">
        <p cy-id="subtitle" class="truncate" ref="displaySubtitle" :style="{ fontSize: 0.6 + 'em' }">{{ displaySubtitle }}</p>
      </ui-tooltip>
      <p cy-id="line2" class="truncate text-gray-400" :style="{ fontSize: 0.8 + 'em' }">{{ displayLineTwo || '&nbsp;' }}</p>
      <p cy-id="line3" v-if="displaySortLine" class="truncate text-gray-400" :style="{ fontSize: 0.8 + 'em' }">{{ displaySortLine }}</p>
    </div>
  </div>
</template>

<script>
import Vue from 'vue'
import MoreMenu from '@/components/widgets/MoreMenu'

export default {
  props: {
    index: Number,
    width: Number,
    height: {
      type: Number,
      default: 192
    },
    bookshelfView: Number,
    bookMount: {
      // Book can be passed as prop or set with setEntity()
      type: Object,
      default: () => null
    },
    orderBy: String,
    filterBy: String,
    sortingIgnorePrefix: Boolean,
    continueListeningShelf: Boolean
  },
  data() {
    return {
      isHovering: false,
      isMoreMenuOpen: false,
      processing: false,
      libraryItem: null,
      imageReady: false,
      selected: false,
      isSelectionMode: false,
      displayTitleTruncated: false,
      displaySubtitleTruncated: false,
      showCoverBg: false
    }
  },
  watch: {
    bookMount: {
      handler(newVal) {
        if (newVal) {
          this.libraryItem = newVal
        }
      }
    }
  },
  computed: {
    bookCoverAspectRatio() {
      return this.store.getters['libraries/getBookCoverAspectRatio']
    },
    coverWidth() {
      return this.width || this.coverHeight / this.bookCoverAspectRatio
    },
    coverHeight() {
      return this.height * this.sizeMultiplier
    },
    cardWidth() {
      // This method returns immediately without waiting for the DOM to update
      return this.coverWidth
    },
    sizeMultiplier() {
      return this.store.getters['user/getSizeMultiplier']
    },
    dateFormat() {
      return this.store.getters['getServerSetting']('dateFormat')
    },
    timeFormat() {
      return this.store.getters['getServerSetting']('timeFormat')
    },
    _libraryItem() {
      return this.libraryItem || {}
    },
    isFile() {
      // Library item is not in a folder
      return this._libraryItem.isFile
    },
    media() {
      return this._libraryItem.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    mediaType() {
      return this._libraryItem.mediaType
    },
    isPodcast() {
      return false
    },
    isExplicit() {
      return this.mediaMetadata.explicit || false
    },
    placeholderUrl() {
      return this.store.getters['globals/getPlaceholderCoverSrc']
    },
    bookCoverSrc() {
      return this.store.getters['globals/getLibraryItemCoverSrc'](this._libraryItem, this.placeholderUrl)
    },
    libraryItemId() {
      return this._libraryItem.id
    },
    series() {
      // Only included when filtering by series or collapse series or Continue Series shelf on home page
      return this.mediaMetadata.series
    },
    seriesName() {
      if (this.collapsedSeries?.name) return this.collapsedSeries.name
      return this.series?.name || null
    },
    seriesSequence() {
      return this.series?.sequence || null
    },
    libraryId() {
      return this._libraryItem.libraryId
    },
    ebookFormat() {
      return this.media.ebookFormat
    },
    tags() {
      return this.media.tags || []
    },
    displayTags() {
      // Show maximum 3 tags to avoid cluttering the cover
      return this.tags.slice(0, 3)
    },
    rating() {
      return this.mediaMetadata.rating || null
    },
    numTracks() {
      if (this.media.tracks) return this.media.tracks.length
      return this.media.numTracks || 0 // toJSONMinified
    },
    processingBatch() {
      return this.store.state.processingBatch
    },
    collapsedSeries() {
      // Only added to item object when collapseSeries is enabled
      return this._libraryItem.collapsedSeries
    },
    booksInSeries() {
      // Only added to item object when collapseSeries is enabled
      return this.collapsedSeries?.numBooks || 0
    },
    seriesSequenceList() {
      return this.collapsedSeries?.seriesSequenceList || null
    },
    libraryItemIdsInSeries() {
      // Only added to item object when collapseSeries is enabled
      return this.collapsedSeries?.libraryItemIds || []
    },
    hasCover() {
      return !!this.media.coverPath
    },
    squareAspectRatio() {
      return this.bookCoverAspectRatio === 1
    },
    title() {
      return this.mediaMetadata.title || ''
    },
    playIconFontSize() {
      return Math.max(2, 3 * this.sizeMultiplier)
    },
    author() {
      return this.mediaMetadata.authorName
    },
    authorLF() {
      return this.mediaMetadata.authorNameLF
    },
    artist() {
      const artists = this.mediaMetadata.artists || []
      return artists.join(', ')
    },
    displayTitle() {
      const ignorePrefix = this.orderBy === 'media.metadata.title' && this.sortingIgnorePrefix
      if (this.collapsedSeries) return ignorePrefix ? this.collapsedSeries.nameIgnorePrefix : this.collapsedSeries.name
      return ignorePrefix ? this.mediaMetadata.titleIgnorePrefix || '\u00A0' : this.title || '\u00A0'
    },
    displaySubtitle() {
      if (!this.libraryItem) return '\u00A0'
      if (this.collapsedSeries) return `${this.collapsedSeries.numBooks} ${this.$strings.LabelBooks}`
      if (this.mediaMetadata.subtitle) return this.mediaMetadata.subtitle
      if (this.mediaMetadata.seriesName) return this.mediaMetadata.seriesName
      return ''
    },
    displayLineTwo() {
      if (this.collapsedSeries) return ''
      if (this.isAuthorBookshelfView) {
        return this.mediaMetadata.publishedYear || ''
      }
      if (this.orderBy === 'media.metadata.authorNameLF') return this.authorLF
      return this.author
    },
    displaySortLine() {
      if (this.collapsedSeries) return null
      if (this.orderBy === 'mtimeMs') return this.$getString('LabelFileModifiedDate', [this.$formatDate(this._libraryItem.mtimeMs, this.dateFormat)])
      if (this.orderBy === 'birthtimeMs') return this.$getString('LabelFileBornDate', [this.$formatDate(this._libraryItem.birthtimeMs, this.dateFormat)])
      if (this.orderBy === 'addedAt') return this.$getString('LabelAddedDate', [this.$formatDate(this._libraryItem.addedAt, this.dateFormat)])
      if (this.orderBy === 'media.duration') return this.$strings.LabelDuration + ': ' + this.$elapsedPrettyExtended(this.media.duration, false)
      if (this.orderBy === 'size') return this.$strings.LabelSize + ': ' + this.$bytesPretty(this._libraryItem.size)
      if (this.orderBy === 'media.numTracks') return `${this.numTracks} ` + this.$strings.LabelTracks
      if (this.orderBy === 'media.metadata.publishedYear') {
        if (this.mediaMetadata.publishedYear) return this.$getString('LabelPublishedDate', [this.mediaMetadata.publishedYear])
        return '\u00A0'
      }
      if (this.orderBy === 'progress') {
        if (!this.userProgressLastUpdated) return '\u00A0'
        return this.$getString('LabelLastProgressDate', [this.$formatDatetime(this.userProgressLastUpdated, this.dateFormat, this.timeFormat)])
      }
      if (this.orderBy === 'progress.createdAt') {
        if (!this.userProgressStartedDate) return '\u00A0'
        return this.$getString('LabelStartedDate', [this.$formatDatetime(this.userProgressStartedDate, this.dateFormat, this.timeFormat)])
      }
      if (this.orderBy === 'progress.finishedAt') {
        if (!this.userProgressFinishedDate) return '\u00A0'
        return this.$getString('LabelFinishedDate', [this.$formatDatetime(this.userProgressFinishedDate, this.dateFormat, this.timeFormat)])
      }
      return null
    },
    userProgress() {
      return this.store.getters['user/getUserMediaProgress'](this.libraryItemId)
    },
    isEBookOnly() {
      return !this.numTracks && this.ebookFormat
    },
    useEBookProgress() {
      if (!this.userProgress || this.userProgress.progress) return false
      return this.userProgress.ebookProgress > 0
    },
    seriesProgressPercent() {
      if (!this.libraryItemIdsInSeries.length) return 0
      let progressPercent = 0
      const useEBookProgress = this.useEBookProgress
      this.libraryItemIdsInSeries.forEach((lid) => {
        const progress = this.store.getters['user/getUserMediaProgress'](lid)
        if (progress) progressPercent += progress.isFinished ? 1 : useEBookProgress ? progress.ebookProgress || 0 : progress.progress || 0
      })
      return progressPercent / this.libraryItemIdsInSeries.length
    },
    userProgressPercent() {
      let progressPercent = this.itemIsFinished ? 1 : this.booksInSeries ? this.seriesProgressPercent : this.useEBookProgress ? this.userProgress?.ebookProgress || 0 : this.userProgress?.progress || 0
      return Math.max(Math.min(1, progressPercent), 0)
    },
    userProgressLastUpdated() {
      if (!this.userProgress) return null
      return this.userProgress.lastUpdate
    },
    userProgressStartedDate() {
      if (!this.userProgress) return null
      return this.userProgress.startedAt
    },
    userProgressFinishedDate() {
      if (!this.userProgress) return null
      return this.userProgress.finishedAt
    },
    itemIsFinished() {
      if (this.booksInSeries) return this.seriesIsFinished
      return this.userProgress ? !!this.userProgress.isFinished : false
    },
    seriesIsFinished() {
      return !this.libraryItemIdsInSeries.some((lid) => {
        const progress = this.store.getters['user/getUserMediaProgress'](lid)
        return !progress || !progress.isFinished
      })
    },
    showError() {
      return this.isMissing || this.isInvalid
    },
    libraryItemIdStreaming() {
      return this.store.getters['getLibraryItemIdStreaming']
    },
    isStreaming() {
      return this.libraryItemIdStreaming === this.libraryItemId
    },
    isQueued() {
      return this.store.getters['getIsMediaQueued'](this.libraryItemId, null)
    },
    isStreamingFromDifferentLibrary() {
      return this.store.getters['getIsStreamingFromDifferentLibrary']
    },
    showReadButton() {
      return !this.isSelectionMode && !this.showPlayButton && this.ebookFormat
    },
    showPlayButton() {
      return !this.isSelectionMode && !this.isMissing && !this.isInvalid && !this.isStreaming && this.numTracks
    },
    showQuickAddToQueue() {
      // Show quick add to queue button when:
      // 1. Something is playing (queue is available)
      // 2. Not a podcast (or has recent episode)
      // 3. Item has tracks or is a podcast episode
      // 4. Item is not already queued
      // 5. Not streaming from a different library
      if (!this.libraryItemIdStreaming) return false
      if (this.isStreamingFromDifferentLibrary) return false
      if (this.isQueued) return false
      if (!this.numTracks) return false
      return true
    },
    showSmallEBookIcon() {
      return !this.isSelectionMode && this.ebookFormat
    },
    isMissing() {
      return this._libraryItem.isMissing
    },
    isInvalid() {
      return this._libraryItem.isInvalid
    },
    errorText() {
      if (this.isMissing) return 'Item directory is missing!'
      else if (this.isInvalid) {
        return 'Item has no audio tracks & ebook'
      }
      return 'Unknown Error'
    },
    overlayWrapperClasslist() {
      const classes = []
      if (this.isSelectionMode) classes.push('bg-black/60')
      else classes.push('bg-black/40')
      if (this.selected) {
        classes.push('border-2 border-yellow-400')
      }
      return classes
    },
    store() {
      return this.$store || this.$nuxt.$store
    },
    userCanUpdate() {
      return this.store.getters['user/getUserCanUpdate']
    },
    userCanDelete() {
      return this.store.getters['user/getUserCanDelete']
    },
    userCanDownload() {
      return this.store.getters['user/getUserCanDownload']
    },
    userIsAdminOrUp() {
      return this.store.getters['user/getIsAdminOrUp']
    },
    moreMenuItems() {
      let items = [
          {
            func: 'toggleFinished',
            text: this.itemIsFinished ? this.$strings.MessageMarkAsNotFinished : this.$strings.MessageMarkAsFinished
          }
        ]
        if (this.numTracks) {
          if (this.userIsAdminOrUp) {
            items.push({
              func: 'openShare',
              text: this.$strings.LabelShare
            })
          }
          if (!this.isDownloadedOffline) {
            items.push({
              func: 'downloadOffline',
              text: 'Download for Offline'
            })
          } else {
            items.push({
              func: 'deleteOffline',
              text: 'Delete Offline Copy'
            })
          }
        }
        if (this.ebookFormat && this.store.state.libraries.ereaderDevices?.length) {
          items.push({
            text: this.$strings.LabelSendEbookToDevice,
            subitems: this.store.state.libraries.ereaderDevices.map((d) => {
              return {
                text: d.name,
                func: 'sendToDevice',
                data: d.name
              }
            })
          })
        }
      }
      if (this.userCanUpdate) {
        items.push({
          func: 'showEditModalFiles',
          text: this.$strings.HeaderFiles
        })
        items.push({
          func: 'showEditModalMatch',
          text: this.$strings.HeaderMatch
        })
      }
      if (this.userIsAdminOrUp && !this.isFile) {
        items.push({
          func: 'rescan',
          text: this.$strings.ButtonReScan
        })
      }
      if (this.series && this.bookMount) {
        items.push({
          func: 'removeSeriesFromContinueListening',
          text: this.$strings.ButtonRemoveSeriesFromContinueSeries
        })
      }
      if (this.continueListeningShelf) {
        items.push({
          func: 'removeFromContinueListening',
          text: this.isEBookOnly ? this.$strings.ButtonRemoveFromContinueReading : this.$strings.ButtonRemoveFromContinueListening
        })
      }
      if (this.libraryItemIdStreaming && !this.isStreamingFromDifferentLibrary) {
        if (!this.isQueued) {
          items.push({
            func: 'addToQueue',
            text: this.$strings.ButtonQueueAddItem
          })
        } else if (!this.isStreaming) {
          items.push({
            func: 'removeFromQueue',
            text: this.$strings.ButtonQueueRemoveItem
          })
        }
      }

      if (this.userCanDelete) {
        items.push({
          func: 'deleteLibraryItem',
          text: this.$strings.ButtonDelete
        })
      }

      return items
    },
    _socket() {
      return this.$root.socket || this.$nuxt.$root.socket
    },
    titleFontSize() {
      return 0.75
    },
    authorFontSize() {
      return 0.6
    },
    placeholderCoverPadding() {
      return 0.8
    },
    authorBottom() {
      return 0.75
    },
    titleCleaned() {
      if (!this.title) return ''
      if (this.title.length > 60) {
        return this.title.slice(0, 57) + '...'
      }
      return this.title
    },
    authorCleaned() {
      if (!this.author) return ''
      if (this.author.length > 30) {
        return this.author.slice(0, 27) + '...'
      }
      return this.author
    },
    isAlternativeBookshelfView() {
      const constants = this.$constants || this.$nuxt.$constants
      return this.bookshelfView === constants.BookshelfView.DETAIL
    },
    isAuthorBookshelfView() {
      const constants = this.$constants || this.$nuxt.$constants
      return this.bookshelfView === constants.BookshelfView.AUTHOR
    },
    mediaItemShare() {
      return this._libraryItem.mediaItemShare || null
    },
    showSubtitles() {
      return !this.isPodcast && this.store.getters['user/getUserSetting']('showSubtitles')
    },
    itemLink() {
      if (this.collapsedSeries) return `/library/${this.libraryId}/series/${this.collapsedSeries.id}`
      return `/item/${this.libraryItemId}`
    },
    isDownloadedOffline() {
      return this.store.getters['offline/isDownloaded'](this.libraryItemId)
    },
    viewedCount() {
      return this.mediaMetadata.viewedCount || 0
    },
    totalListeningMinutes() {
      return Math.round(this.mediaMetadata.totalListeningTime || 0)
    },
    hasListeningStats() {
      return this.viewedCount > 0 || this.totalListeningMinutes > 0 || this.isDownloadedOffline
    },
    formattedListeningTime() {
      const minutes = this.totalListeningMinutes
      if (minutes < 60) return `${minutes}m`
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      if (mins === 0) return `${hours}h`
      return `${hours}h${mins}m`
    }
  },
  methods: {
    setSelectionMode(val) {
      this.isSelectionMode = val
      if (!val) this.selected = false
    },
    setEntity(_libraryItem) {
      var libraryItem = _libraryItem

      // this code block is only necessary when showing a selected series with sequence #
      //   it will update the selected series so we get realtime updates for series sequence changes
      if (this.series) {
        // i know.. but the libraryItem passed to this func cannot be modified so we need to create a copy
        libraryItem = {
          ..._libraryItem,
          media: {
            ..._libraryItem.media,
            metadata: {
              ..._libraryItem.media.metadata
            }
          }
        }
        var mediaMetadata = libraryItem.media.metadata
        if (mediaMetadata.series && Array.isArray(mediaMetadata.series)) {
          var newSeries = mediaMetadata.series.find((se) => se.id === this.series.id)
          if (newSeries) {
            // update selected series
            libraryItem.media.metadata.series = newSeries
            this.libraryItem = libraryItem
            return
          }
        }
      }

      this.libraryItem = libraryItem

      this.$nextTick(() => {
        if (this.$refs.displayTitle) {
          this.displayTitleTruncated = this.$refs.displayTitle.scrollWidth > this.$refs.displayTitle.clientWidth
        }
        if (this.$refs.displaySubtitle) {
          this.displaySubtitleTruncated = this.$refs.displaySubtitle.scrollWidth > this.$refs.displaySubtitle.clientWidth
        }
      })
    },
    clickCard(e) {
      if (this.processing) return
      if (this.isSelectionMode) {
        e.stopPropagation()
        e.preventDefault()
        this.selectBtnClick(e)
      }
      // Navigation is handled by clicking the title link at the bottom
    },
    middleClickCard(e) {
      // Middle-click opens in new tab
      if (e.button === 1) {
        e.preventDefault()
        e.stopPropagation()
        const config = this.$config || this.$nuxt.$config
        const routerBasePath = config.routerBasePath || ''
        window.open(`${routerBasePath}${this.itemLink}`, '_blank')
      }
    },
    editClick() {
      this.$emit('edit', this.libraryItem)
    },
    toggleFinished(confirmed = false) {
      if (!this.itemIsFinished && this.userProgressPercent > 0 && !confirmed) {
        const payload = {
          message: this.$getString('MessageConfirmMarkItemFinished', [this.displayTitle]),
          callback: (confirmed) => {
            if (confirmed) {
              this.toggleFinished(true)
            }
          },
          type: 'yesNo'
        }
        this.store.commit('globals/setConfirmPrompt', payload)
        return
      }

      var updatePayload = {
        isFinished: !this.itemIsFinished
      }
      this.processing = true

      var apiEndpoint = `/api/me/progress/${this.libraryItemId}`

      var toast = this.$toast || this.$nuxt.$toast
      var axios = this.$axios || this.$nuxt.$axios
      axios
        .$patch(apiEndpoint, updatePayload)
        .then(() => {
          this.processing = false
        })
        .catch((error) => {
          console.error('Failed', error)
          this.processing = false
          toast.error(updatePayload.isFinished ? this.$strings.ToastItemMarkedAsFinishedFailed : this.$strings.ToastItemMarkedAsNotFinishedFailed)
        })
    },
    rescan() {
      if (this.processing) return
      const axios = this.$axios || this.$nuxt.$axios
      this.processing = true
      axios
        .$post(`/api/items/${this.libraryItemId}/scan`)
        .then((data) => {
          var result = data.result
          if (!result) {
            this.$toast.error(this.$getString('ToastRescanFailed', [this.displayTitle]))
          } else if (result === 'UPDATED') {
            this.$toast.success(this.$strings.ToastRescanUpdated)
          } else if (result === 'UPTODATE') {
            this.$toast.success(this.$strings.ToastRescanUpToDate)
          } else if (result === 'REMOVED') {
            this.$toast.error(this.$strings.ToastRescanRemoved)
          }
        })
        .catch((error) => {
          console.error('Failed to scan library item', error)
          this.$toast.error(this.$strings.ToastScanFailed)
        })
        .finally(() => {
          this.processing = false
        })
    },
    showEditModalFiles() {
      // More menu func
      this.$emit('edit', this.libraryItem, 'files')
    },
    showEditModalMatch() {
      // More menu func
      this.$emit('edit', this.libraryItem, 'match')
    },
    sendToDevice(deviceName) {
      // More menu func
      const payload = {
        // message: `Are you sure you want to send ${this.ebookFormat} ebook "${this.title}" to device "${deviceName}"?`,
        message: this.$getString('MessageConfirmSendEbookToDevice', [this.ebookFormat, this.title, deviceName]),
        callback: (confirmed) => {
          if (confirmed) {
            const payload = {
              libraryItemId: this.libraryItemId,
              deviceName
            }
            this.processing = true
            const axios = this.$axios || this.$nuxt.$axios
            axios
              .$post(`/api/emails/send-ebook-to-device`, payload)
              .then(() => {
                this.$toast.success(this.$getString('ToastSendEbookToDeviceSuccess', [deviceName]))
              })
              .catch((error) => {
                console.error('Failed to send ebook to device', error)
                this.$toast.error(this.$strings.ToastSendEbookToDeviceFailed)
              })
              .finally(() => {
                this.processing = false
              })
          }
        },
        type: 'yesNo'
      }
      this.store.commit('globals/setConfirmPrompt', payload)
    },
    removeSeriesFromContinueListening() {
      if (!this.series) return

      const axios = this.$axios || this.$nuxt.$axios
      this.processing = true
      axios
        .$get(`/api/me/series/${this.series.id}/remove-from-continue-listening`)
        .then((data) => {
          console.log('User updated', data)
        })
        .catch((error) => {
          console.error('Failed to remove series from home', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
        })
        .finally(() => {
          this.processing = false
        })
    },
    removeFromContinueListening() {
      if (!this.userProgress) return

      const axios = this.$axios || this.$nuxt.$axios
      this.processing = true
      axios
        .$get(`/api/me/progress/${this.userProgress.id}/remove-from-continue-listening`)
        .then((data) => {
          console.log('User updated', data)
        })
        .catch((error) => {
          console.error('Failed to hide item from home', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
        })
        .finally(() => {
          this.processing = false
        })
    },
    addToQueue() {
      var queueItem = {
        libraryItemId: this.libraryItemId,
        libraryId: this.libraryId,
        episodeId: null,
        title: this.title,
        subtitle: this.author,
        caption: '',
        duration: this.media.duration || null,
        coverPath: this.media.coverPath || null
      }
      this.store.commit('addItemToQueue', queueItem)
      // Sync queue to server
      this.store.dispatch('savePlayerQueue')
    },
    removeFromQueue() {
      this.store.commit('removeItemFromQueue', { libraryItemId: this.libraryItemId, episodeId: null })
      // Sync queue to server
      this.store.dispatch('savePlayerQueue')
    },
    openShare() {
      this.store.commit('setSelectedLibraryItem', this.libraryItem)
      this.store.commit('globals/setShareModal', this.mediaItemShare)
    },
    downloadOffline() {
      const token = this.store.getters['user/getToken']
      this.store.dispatch('offline/downloadItem', { libraryItem: this.libraryItem, token })
    },
    deleteOffline() {
      this.store.dispatch('offline/deleteItem', this.libraryItemId)
    },
    deleteLibraryItem() {
      const payload = {
        message: this.$strings.MessageConfirmDeleteLibraryItem,
        checkboxLabel: this.$strings.LabelDeleteFromFileSystemCheckbox,
        yesButtonText: this.$strings.ButtonDelete,
        yesButtonColor: 'error',
        checkboxDefaultValue: !Number(localStorage.getItem('softDeleteDefault') || 0),
        callback: (confirmed, hardDelete) => {
          if (confirmed) {
            localStorage.setItem('softDeleteDefault', hardDelete ? 0 : 1)

            this.processing = true
            const axios = this.$axios || this.$nuxt.$axios
            axios
              .$delete(`/api/items/${this.libraryItemId}?hard=${hardDelete ? 1 : 0}`)
              .then(() => {
                this.$toast.success(this.$strings.ToastItemDeletedSuccess)
              })
              .catch((error) => {
                console.error('Failed to delete item', error)
                this.$toast.error(this.$strings.ToastItemDeletedFailed)
              })
              .finally(() => {
                this.processing = false
              })
          }
        },
        type: 'yesNo'
      }
      this.store.commit('globals/setConfirmPrompt', payload)
    },
    createMoreMenu() {
      if (!this.$refs.moreIcon) return

      var ComponentClass = Vue.extend(MoreMenu)

      var _this = this
      var instance = new ComponentClass({
        propsData: {
          items: this.moreMenuItems
        },
        created() {
          this.$on('action', (action) => {
            if (action.func && _this[action.func]) _this[action.func](action.data)
          })
          this.$on('close', () => {
            _this.isMoreMenuOpen = false
          })
        }
      })
      instance.$mount()

      var wrapperBox = this.$refs.moreIcon.getBoundingClientRect()
      var el = instance.$el

      var elHeight = this.moreMenuItems.length * 28 + 10
      var elWidth = 130

      var bottomOfIcon = wrapperBox.top + wrapperBox.height
      var rightOfIcon = wrapperBox.left + wrapperBox.width

      var elTop = bottomOfIcon
      var elLeft = rightOfIcon
      if (bottomOfIcon + elHeight > window.innerHeight - 100) {
        elTop = wrapperBox.top - elHeight
        elLeft = wrapperBox.left
      }

      if (rightOfIcon + elWidth > window.innerWidth - 100) {
        elLeft = rightOfIcon - elWidth
      }

      el.style.top = elTop + 'px'
      el.style.left = elLeft + 'px'

      this.isMoreMenuOpen = true
      document.body.appendChild(el)
    },
    clickShowMore() {
      this.createMoreMenu()
    },
    async clickReadEBook() {
      const axios = this.$axios || this.$nuxt.$axios
      var libraryItem = await axios.$get(`/api/items/${this.libraryItemId}?expanded=1`).catch((error) => {
        console.error('Failed to get lirbary item', this.libraryItemId)
        return null
      })
      if (!libraryItem) return
      this.store.commit('showEReader', { libraryItem, keepProgress: true })
    },
    selectBtnClick(evt) {
      if (this.processingBatch) return
      this.selected = !this.selected
      this.$emit('select', { entity: this.libraryItem, shiftKey: evt.shiftKey })
    },
    async play() {
      var eventBus = this.$eventBus || this.$nuxt.$eventBus

      const queueItems = [{
        libraryItemId: this.libraryItemId,
        libraryId: this.libraryId,
        episodeId: null,
        title: this.title,
        subtitle: this.author,
        caption: '',
        duration: this.media.duration || null,
        coverPath: this.media.coverPath || null
      }]

      eventBus.$emit('play-item', {
        libraryItemId: this.libraryItemId,
        episodeId: null,
        queueItems
      })
    },
    mouseover() {
      this.isHovering = true
    },
    mouseleave() {
      this.isHovering = false
    },
    destroy() {
      // destroy the vue listeners, etc
      this.$destroy()

      // remove the element from the DOM
      if (this.$el && this.$el.parentNode) {
        this.$el.parentNode.removeChild(this.$el)
      } else if (this.$el && this.$el.remove) {
        this.$el.remove()
      }
    },
    setCoverBg() {
      if (this.$refs.coverBg) {
        this.$refs.coverBg.style.backgroundImage = `url("${this.bookCoverSrc}")`
      }
    },
    imageLoaded() {
      this.imageReady = true

      if (this.$refs.cover && this.bookCoverSrc !== this.placeholderUrl) {
        var { naturalWidth, naturalHeight } = this.$refs.cover
        var aspectRatio = naturalHeight / naturalWidth
        var arDiff = Math.abs(aspectRatio - this.bookCoverAspectRatio)

        // If image aspect ratio is <= 1.45 or >= 1.75 then use cover bg, otherwise stretch to fit
        if (arDiff > 0.15) {
          this.showCoverBg = true
          this.$nextTick(this.setCoverBg)
        } else {
          this.showCoverBg = false
        }
      }
    }
  },
  mounted() {
    if (this.bookMount) {
      this.setEntity(this.bookMount)
    }
  }
}
</script>
