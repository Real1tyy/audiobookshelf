<template>
  <div v-if="streamLibraryItem" id="mediaPlayerContainer" class="w-full fixed bottom-0 left-0 right-0 h-48 lg:h-40 z-50 bg-primary px-2 lg:px-4 pb-1 lg:pb-4 pt-2">
    <div class="absolute left-2 top-2 lg:left-4 cursor-pointer">
      <covers-book-cover expand-on-click :library-item="streamLibraryItem" :width="bookCoverWidth" :book-cover-aspect-ratio="coverAspectRatio" />
    </div>
    <div class="flex items-start mb-6 lg:mb-0" :class="isSquareCover ? 'pl-18 sm:pl-24' : 'pl-12 sm:pl-16'">
      <div class="min-w-0 w-full">
        <div class="flex items-center">
          <nuxt-link :to="`/item/${streamLibraryItem.id}`" class="hover:underline cursor-pointer text-sm sm:text-lg block truncate">
            {{ title }}
          </nuxt-link>
          <widgets-explicit-indicator v-if="isExplicit" />
        </div>
        <div class="text-gray-400 flex items-center w-1/2 sm:w-4/5 lg:w-2/5">
          <span class="material-symbols text-sm">person</span>
          <div v-if="authors.length" class="pl-1 sm:pl-1.5 text-xs sm:text-base truncate">
            <nuxt-link v-for="(author, index) in authors" :key="index" :to="`/author/${author.id}`" class="hover:underline">{{ author.name }}<span v-if="index < authors.length - 1">,&nbsp;</span></nuxt-link>
          </div>
          <div v-else class="text-xs sm:text-base cursor-pointer pl-1 sm:pl-1.5">{{ $strings.LabelUnknown }}</div>
        </div>

        <div class="text-gray-400 flex items-center">
          <span class="material-symbols text-xs">schedule</span>
          <p class="font-mono text-xs sm:text-sm pl-1 sm:pl-1.5 pb-px">{{ totalDurationPretty }}</p>
        </div>
      </div>
      <div class="grow" />
      <ui-tooltip direction="top" :text="$strings.LabelClosePlayer">
        <button :aria-label="$strings.LabelClosePlayer" class="material-symbols sm:px-2 py-1 lg:p-4 cursor-pointer text-xl sm:text-2xl" @click="closePlayer">close</button>
      </ui-tooltip>
    </div>
    <player-ui
      ref="audioPlayer"
      :chapters="chapters"
      :current-chapter="currentChapter"
      :paused="!isPlaying"
      :loading="playerLoading"
      :bookmarks="bookmarks"
      :sleep-timer-set="sleepTimerSet"
      :sleep-timer-remaining="sleepTimerRemaining"
      :sleep-timer-type="sleepTimerType"
      :is-podcast="isPodcast"
      :hasNextItemInQueue="hasNextItemInQueue"
      :repeat-mode="repeatMode"
      @playPause="playPause"
      @jumpForward="jumpForward"
      @jumpBackward="jumpBackward"
      @setVolume="setVolume"
      @setPlaybackRate="setPlaybackRate"
      @seek="seek"
      @nextItemInQueue="playNextItemInQueue"
      @close="closePlayer"
      @showBookmarks="showBookmarks"
      @showSleepTimer="showSleepTimerModal = true"
      @showPlayerQueueItems="showPlayerQueueItemsModal = true"
      @cycleRepeatMode="cycleRepeatMode"
    />

    <modals-bookmarks-modal v-model="showBookmarksModal" :bookmarks="bookmarks" :current-time="bookmarkCurrentTime" :playback-rate="currentPlaybackRate" :library-item-id="libraryItemId" @select="selectBookmark" />

    <modals-sleep-timer-modal v-model="showSleepTimerModal" :timer-set="sleepTimerSet" :timer-type="sleepTimerType" :remaining="sleepTimerRemaining" :has-chapters="!!chapters.length" @set="setSleepTimer" @cancel="cancelSleepTimer" @increment="incrementSleepTimer" @decrement="decrementSleepTimer" />

    <modals-player-queue-items-modal v-model="showPlayerQueueItemsModal" />
  </div>
</template>

<script>
import PlayerHandler from '@/players/PlayerHandler'

export default {
  data() {
    return {
      playerHandler: new PlayerHandler(this),
      totalDuration: 0,
      showBookmarksModal: false,
      bookmarkCurrentTime: 0,
      playerLoading: false,
      isPlaying: false,
      currentTime: 0,
      showSleepTimerModal: false,
      showPlayerQueueItemsModal: false,
      sleepTimerSet: false,
      sleepTimerRemaining: 0,
      sleepTimerType: null,
      sleepTimer: null,
      displayTitle: null,
      currentPlaybackRate: 1,
      syncFailedToast: null,
      coverAspectRatio: 1,
      lastChapterId: null,
      repeatMode: 'off', // 'off', 'all', 'one'
      _queueRestoreInProgress: false, // flag to cancel queue restore when user initiates play
      _userPlayInProgress: false, // flag set immediately on user-initiated play to block queue restore
      _wakeLock: null // Screen Wake Lock to prevent page suspension while audio is loaded
    }
  },
  computed: {
    isSquareCover() {
      return this.coverAspectRatio === 1
    },
    isMobile() {
      return this.$store.state.globals.isMobile
    },
    bookCoverWidth() {
      if (this.isMobile) return 64 / this.coverAspectRatio
      return 77 / this.coverAspectRatio
    },
    cover() {
      if (this.media.coverPath) return this.media.coverPath
      return 'Logo.png'
    },
    user() {
      return this.$store.state.user.user
    },
    userMediaProgress() {
      if (!this.libraryItemId) return
      return this.$store.getters['user/getUserMediaProgress'](this.libraryItemId)
    },
    userItemCurrentTime() {
      return this.userMediaProgress ? this.userMediaProgress.currentTime || 0 : 0
    },
    bookmarks() {
      if (!this.libraryItemId) return []
      return this.$store.getters['user/getUserBookmarksForItem'](this.libraryItemId)
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    libraryItemId() {
      return this.streamLibraryItem?.id || null
    },
    media() {
      return this.streamLibraryItem?.media || {}
    },
    isPodcast() {
      return false
    },
    isExplicit() {
      return !!this.mediaMetadata.explicit
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    chapters() {
      return this.media.chapters || []
    },
    currentChapter() {
      return this.chapters.find((chapter) => chapter.start <= this.currentTime && this.currentTime < chapter.end)
    },
    title() {
      if (this.playerHandler.displayTitle) return this.playerHandler.displayTitle
      return this.mediaMetadata.title || 'No Title'
    },
    authors() {
      return this.mediaMetadata.authors || []
    },
    libraryId() {
      return this.streamLibraryItem?.libraryId || null
    },
    totalDurationPretty() {
      // Adjusted by playback rate
      return this.$secondsToTimestamp(this.totalDuration / this.currentPlaybackRate)
    },
    hasNextItemInQueue() {
      return this.currentPlayerQueueIndex < this.playerQueueItems.length - 1
    },
    currentPlayerQueueIndex() {
      if (!this.libraryItemId) return -1
      return this.playerQueueItems.findIndex((i) => {
        return i.libraryItemId === this.libraryItemId
      })
    },
    playerQueueItems() {
      return this.$store.state.playerQueueItems || []
    }
  },
  watch: {
    streamLibraryItem: {
      handler(newVal, oldVal) {
        if (!newVal || !oldVal) return
        if (newVal.id !== oldVal.id) return // Different item, not a refresh

        const newDuration = newVal.media?.duration
        const oldDuration = oldVal.media?.duration
        if (newDuration && oldDuration && newDuration !== oldDuration) {
          console.log(`[MediaPlayerContainer] Duration changed from ${oldDuration} to ${newDuration}, updating player`)
          this.setDuration(newDuration)

          // Update the player's internal audio tracks so getDuration() returns correct value
          if (this.playerHandler?.player?.audioTracks?.length) {
            const tracks = this.playerHandler.player.audioTracks
            const lastTrack = tracks[tracks.length - 1]
            // Adjust the last track's duration so the total matches the new duration
            const totalExceptLast = tracks.length > 1 ? lastTrack.startOffset : 0
            lastTrack.duration = newDuration - totalExceptLast
          }

          // Update the queue item duration
          const queueItems = this.$store.state.playerQueueItems
          const queueIdx = queueItems.findIndex((i) => i.libraryItemId === newVal.id && !i.episodeId)
          if (queueIdx >= 0) {
            const updated = { ...queueItems[queueIdx], duration: newDuration }
            const newQueue = [...queueItems]
            newQueue[queueIdx] = updated
            this.$store.commit('setPlayerQueueItems', newQueue)
          }
        }
      },
      deep: false
    }
  },
  methods: {
    mediaFinished(libraryItemId, episodeId) {
      // Play next item in queue
      if (!this.playerQueueItems.length || !this.$store.state.playerQueueAutoPlay) {
        // TODO: Set media finished flag so play button will play next queue item
        return
      }
      var currentQueueIndex = this.playerQueueItems.findIndex((i) => {
        if (episodeId) return i.libraryItemId === libraryItemId && i.episodeId === episodeId
        return i.libraryItemId === libraryItemId
      })
      if (currentQueueIndex < 0) {
        console.error('Media finished not found in queue - using first in queue', this.playerQueueItems)
        currentQueueIndex = -1
      }

      let nextItemInQueue = null
      if (currentQueueIndex === this.playerQueueItems.length - 1) {
        // Last item in queue
        if (this.repeatMode === 'all') {
          // Repeat All: loop back to first item in queue
          console.log('Repeat All - looping back to first item in queue')
          nextItemInQueue = this.playerQueueItems[0]
        } else {
          console.log('Finished last item in queue')
          // Mark series as finished if this was a series playback
          const seriesId = this.playerHandler.seriesId
          if (seriesId) {
            this.$axios.$patch(`/api/me/series-progress/${seriesId}`, { isFinished: true }).catch((err) => {
              console.error('Failed to mark series as finished', err)
            })
          }
          return
        }
      } else {
        nextItemInQueue = this.playerQueueItems[currentQueueIndex + 1]
      }

      if (nextItemInQueue) {
        this.playLibraryItem({
          libraryItemId: nextItemInQueue.libraryItemId,
          episodeId: nextItemInQueue.episodeId || null,
          queueItems: this.playerQueueItems,
          seriesId: this.playerHandler.seriesId || undefined
        })
      }
    },
    setPlaying(isPlaying) {
      this.isPlaying = isPlaying
      this.$store.commit('setIsPlaying', isPlaying)
      this.updateMediaSessionPlaybackState()
      if (isPlaying) {
        this.requestWakeLock()
      }
    },
    setSleepTimer(time) {
      this.sleepTimerSet = true
      this.showSleepTimerModal = false

      this.sleepTimerType = time.timerType
      if (this.sleepTimerType === this.$constants.SleepTimerTypes.COUNTDOWN) {
        this.runSleepTimer(time)
      }
    },
    runSleepTimer(time) {
      this.sleepTimerRemaining = time.seconds

      var lastTick = Date.now()
      clearInterval(this.sleepTimer)
      this.sleepTimer = setInterval(() => {
        var elapsed = Date.now() - lastTick
        lastTick = Date.now()
        this.sleepTimerRemaining -= elapsed / 1000

        if (this.sleepTimerRemaining <= 0) {
          this.sleepTimerEnd()
        }
      }, 1000)
    },
    checkChapterEnd() {
      if (!this.currentChapter) return

      // Track chapter transitions by comparing current chapter with last chapter
      if (this.lastChapterId !== this.currentChapter.id) {
        // Chapter changed - if we had a previous chapter, this means we crossed a boundary
        if (this.lastChapterId) {
          this.sleepTimerEnd()
        }
        this.lastChapterId = this.currentChapter.id
      }
    },
    sleepTimerEnd() {
      this.clearSleepTimer()
      this.playerHandler.pause()
      this.$toast.info(this.$strings.ToastSleepTimerDone)
    },
    cancelSleepTimer() {
      this.showSleepTimerModal = false
      this.clearSleepTimer()
    },
    clearSleepTimer() {
      clearInterval(this.sleepTimer)
      this.sleepTimerRemaining = 0
      this.sleepTimer = null
      this.sleepTimerSet = false
      this.sleepTimerType = null
    },
    incrementSleepTimer(amount) {
      if (!this.sleepTimerSet) return
      this.sleepTimerRemaining += amount
    },
    decrementSleepTimer(amount) {
      if (this.sleepTimerRemaining < amount) {
        this.sleepTimerRemaining = 3
        return
      }
      this.sleepTimerRemaining = Math.max(0, this.sleepTimerRemaining - amount)
    },
    playPause() {
      this.playerHandler.playPause()
    },
    jumpForward() {
      this.playerHandler.jumpForward()
      this.updateQueuePositionImmediate()
    },
    jumpBackward() {
      this.playerHandler.jumpBackward()
      this.updateQueuePositionImmediate()
    },
    setVolume(volume) {
      this.playerHandler.setVolume(volume)
    },
    setPlaybackRate(playbackRate) {
      this.currentPlaybackRate = playbackRate
      this.playerHandler.setPlaybackRate(playbackRate)
    },
    seek(time) {
      this.playerHandler.seek(time)
      this.updateQueuePositionImmediate()
    },
    cycleRepeatMode() {
      // Cycle through: off -> all -> one -> off
      if (this.repeatMode === 'off') {
        this.repeatMode = 'all'
      } else if (this.repeatMode === 'all') {
        this.repeatMode = 'one'
      } else {
        this.repeatMode = 'off'
      }
      this.playerHandler.setRepeatMode(this.repeatMode)
    },
    playbackTimeUpdate(time) {
      // When updating progress from another session
      this.playerHandler.seek(time, false)
    },
    setCurrentTime(time) {
      this.currentTime = time
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.setCurrentTime(time)
      }

      if (this.sleepTimerType === this.$constants.SleepTimerTypes.CHAPTER && this.sleepTimerSet) {
        this.checkChapterEnd()
      }

      // Update queue position in store (will be debounced when saved)
      this.$store.commit('setPlayerQueueCurrentTime', time)

      if (!this._lastQueueSaveTime || Date.now() - this._lastQueueSaveTime > 3000) {
        this._lastQueueSaveTime = Date.now()
        this.updateQueuePosition()
      }
    },
    setDuration(duration) {
      this.totalDuration = duration
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.setDuration(duration)
      }
    },
    setBufferTime(buffertime) {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.setBufferTime(buffertime)
      }
    },
    showBookmarks() {
      this.bookmarkCurrentTime = this.currentTime
      this.showBookmarksModal = true
    },
    selectBookmark(bookmark) {
      this.seek(bookmark.time)
      this.showBookmarksModal = false
    },
    closePlayer() {
      this.playerHandler.closePlayer()
      this.$store.commit('setMediaPlaying', null)
      this.releaseWakeLock()
      // Note: Queue persists when player is closed, so we don't clear it
    },
    mediaSessionPlay() {
      console.log('Media session play')
      this.playerHandler.play()
    },
    mediaSessionPause() {
      console.log('Media session pause')
      this.playerHandler.pause()
    },
    mediaSessionStop() {
      console.log('Media session stop')
      this.playerHandler.pause()
    },
    mediaSessionSeekBackward() {
      console.log('Media session seek backward')
      this.playerHandler.jumpBackward()
    },
    mediaSessionSeekForward() {
      console.log('Media session seek forward')
      this.playerHandler.jumpForward()
    },
    mediaSessionSeekTo(e) {
      console.log('Media session seek to', e)
      if (e.seekTime !== null && !isNaN(e.seekTime)) {
        this.playerHandler.seek(e.seekTime)
      }
    },
    mediaSessionPreviousTrack() {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.prevChapter()
      }
    },
    mediaSessionNextTrack() {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.nextChapter()
      }
    },
    updateMediaSessionPlaybackState() {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused'
      }
    },
    setMediaSession() {
      if (!this.streamLibraryItem) {
        console.error('setMediaSession: No library item set')
        return
      }

      // https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
      if ('mediaSession' in navigator) {
        const chapterInfo = []
        if (this.chapters.length) {
          this.chapters.forEach((chapter) => {
            chapterInfo.push({
              title: chapter.title,
              startTime: chapter.start
            })
          })
        }

        navigator.mediaSession.metadata = new MediaMetadata({
          title: this.title,
          artist: this.playerHandler.displayAuthor || this.mediaMetadata.authorName || 'Unknown',
          album: this.mediaMetadata.seriesName || '',
          artwork: [
            {
              src: this.$store.getters['globals/getLibraryItemCoverSrc'](this.streamLibraryItem, '/Logo.png', true)
            }
          ],
          chapterInfo
        })
        console.log('Set media session metadata', navigator.mediaSession.metadata)

        navigator.mediaSession.setActionHandler('play', this.mediaSessionPlay)
        navigator.mediaSession.setActionHandler('pause', this.mediaSessionPause)
        navigator.mediaSession.setActionHandler('stop', this.mediaSessionStop)
        navigator.mediaSession.setActionHandler('seekbackward', this.mediaSessionSeekBackward)
        navigator.mediaSession.setActionHandler('seekforward', this.mediaSessionSeekForward)
        navigator.mediaSession.setActionHandler('seekto', this.mediaSessionSeekTo)
        navigator.mediaSession.setActionHandler('previoustrack', this.mediaSessionSeekBackward)
        navigator.mediaSession.setActionHandler('nexttrack', this.mediaSessionSeekForward)
      } else {
        console.warn('Media session not available')
      }
    },
    streamProgress(data) {
      if (this.playerHandler.isPlayingLocalItem && this.playerHandler.currentStreamId === data.stream) {
        if (!data.numSegments) return
        var chunks = data.chunks
        console.log(`[MediaPlayerContainer] Stream Progress ${data.percent}`)
        if (this.$refs.audioPlayer) {
          this.$refs.audioPlayer.setChunksReady(chunks, data.numSegments)
        } else {
          console.error('No Audio Ref')
        }
      }
    },
    sessionOpen(session) {
      // For opening session on init (temporarily unused)
      this.$store.commit('setMediaPlaying', {
        libraryItem: session.libraryItem,
        episodeId: session.episodeId
      })
      this.playerHandler.prepareOpenSession(session, this.currentPlaybackRate)
    },
    streamOpen(session) {
      console.log(`[MediaPlayerContainer] Stream session open`, session)
    },
    streamClosed(streamId) {
      // Stream was closed from the server
      if (this.playerHandler.isPlayingLocalItem && this.playerHandler.currentStreamId === streamId) {
        console.warn('[MediaPlayerContainer] Closing stream due to request from server')
        this.playerHandler.closePlayer()
      }
    },
    streamReady() {
      console.log(`[MediaPlayerContainer] Stream Ready`)
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.setStreamReady()
      } else {
        console.error('No Audio Ref')
      }
    },
    streamError(streamId) {
      // Stream had critical error from the server
      if (this.playerHandler.isPlayingLocalItem && this.playerHandler.currentStreamId === streamId) {
        console.warn('[MediaPlayerContainer] Closing stream due to stream error from server')
        this.playerHandler.closePlayer()
      }
    },
    streamReset({ startTime, streamId }) {
      this.playerHandler.resetStream(startTime, streamId)
    },
    castSessionActive(isActive) {
      if (isActive && this.playerHandler.isPlayingLocalItem) {
        // Cast session started switch to cast player
        this.playerHandler.switchPlayer()
      } else if (!isActive && this.playerHandler.isPlayingCastedItem) {
        // Cast session ended switch to local player
        this.playerHandler.switchPlayer()
      }
    },
    playNextItemInQueue() {
      if (this.hasNextItemInQueue) {
        this.playQueueItem({ index: this.currentPlayerQueueIndex + 1 })
      }
    },
    /**
     * @param {{ index: number }} payload
     */
    playQueueItem(payload) {
      if (payload?.index === undefined) {
        console.error('playQueueItem: No index provided')
        return
      }
      if (!this.playerQueueItems[payload.index]) {
        console.error('playQueueItem: No item found at index', payload.index)
        return
      }
      const item = this.playerQueueItems[payload.index]
      this.playLibraryItem({
        libraryItemId: item.libraryItemId,
        episodeId: item.episodeId || null,
        queueItems: this.playerQueueItems
      })
    },
    async restoreQueueToPlayer(payload) {
      // Don't restore queue if something is already playing or user just clicked play
      if (this.$store.state.streamLibraryItem || this._userPlayInProgress) return

      // Restore queue to player UI without auto-playing (paused, ready to play)
      const queueItems = payload.queueItems || []
      if (!queueItems.length) return

      const currentIndex = payload.currentIndex || 0
      const currentTime = payload.currentTime || 0
      const currentItem = queueItems[currentIndex]

      if (!currentItem) {
        console.error('[MediaPlayerContainer] Invalid queue index:', currentIndex)
        return
      }

      console.log('[MediaPlayerContainer] Restoring queue to player:', currentItem.title, 'at index', currentIndex, 'time', currentTime)

      this._queueRestoreInProgress = true

      // Load the current item in the queue (paused) at the saved position
      await this.playLibraryItem({
        libraryItemId: currentItem.libraryItemId,
        episodeId: currentItem.episodeId || null,
        queueItems: queueItems,
        play: false, // Don't auto-play, just load it paused
        startTime: currentTime, // Resume from saved position
        _isQueueRestore: true // internal flag so playLibraryItem can yield to user plays
      })

      this._queueRestoreInProgress = false
    },
    updateQueuePosition() {
      const currentIndex = this.currentPlayerQueueIndex
      if (currentIndex >= 0 && this.playerQueueItems.length) {
        this.$store.commit('setPlayerQueueCurrentIndex', currentIndex)
        this.$store.dispatch('savePlayerQueue', {
          currentIndex: currentIndex,
          currentTime: this.currentTime
        })
      }
    },
    updateQueuePositionImmediate() {
      const currentIndex = this.currentPlayerQueueIndex
      if (currentIndex >= 0 && this.playerQueueItems.length) {
        this.$store.commit('setPlayerQueueCurrentIndex', currentIndex)
        // Clear any pending debounced save
        if (this.$store._saveQueueTimeout) {
          clearTimeout(this.$store._saveQueueTimeout)
          this.$store._saveQueueTimeout = null
        }
        // Save immediately
        this.$axios
          .$post('/api/me/queue', {
            items: this.$store.state.playerQueueItems,
            autoPlay: this.$store.state.playerQueueAutoPlay,
            currentIndex: currentIndex,
            currentTime: this.currentTime
          })
          .then(() => {
            console.log('Queue position saved immediately (index:', currentIndex, ', time:', this.currentTime, ')')
          })
          .catch((error) => {
            console.error('Failed to save queue position immediately', error)
          })
      }
    },
    async playLibraryItem(payload) {
      const libraryItemId = payload.libraryItemId
      const episodeId = payload.episodeId || null
      const isUserPlay = !payload._isQueueRestore

      // User-initiated play: set flag immediately (before any async work)
      // so that queue restore checks will see it and bail out
      if (isUserPlay) {
        this._userPlayInProgress = true
        // Also cancel any in-flight queue restore
        if (this._queueRestoreInProgress) {
          this._queueRestoreInProgress = false
        }
      }

      if (this.playerHandler.libraryItemId == libraryItemId && this.playerHandler.episodeId == episodeId) {
        if (payload.startTime !== null && !isNaN(payload.startTime)) {
          this.seek(payload.startTime)
        } else {
          this.playerHandler.play()
        }
        if (isUserPlay) this._userPlayInProgress = false
        return
      }

      let libraryItem = await this.$axios.$get(`/api/items/${libraryItemId}?expanded=1`).catch((error) => {
        console.error('Failed to fetch full item', error)
        return null
      })

      // If server fetch failed, try to construct a minimal item from offline metadata
      if (!libraryItem) {
        const offlineItem = this.$store.getters['offline/getDownloadedItem'](libraryItemId)
        if (offlineItem) {
          console.log('[MediaPlayerContainer] Server fetch failed, using offline metadata for', libraryItemId)
          libraryItem = {
            id: offlineItem.id,
            libraryId: offlineItem.libraryId,
            media: {
              metadata: {
                title: offlineItem.title,
                authorName: offlineItem.author
              },
              coverPath: offlineItem.coverPath,
              audioFiles: offlineItem.tracks.map((t) => ({
                ino: t.ino,
                duration: t.duration,
                mimeType: t.mimeType,
                metadata: { filename: t.title }
              }))
            }
          }
        } else {
          if (isUserPlay) this._userPlayInProgress = false
          return
        }
      }

      // If this is a queue restore but a user-initiated play happened while we were fetching, yield
      if (payload._isQueueRestore && (this._userPlayInProgress || !this._queueRestoreInProgress)) {
        console.log('[MediaPlayerContainer] Queue restore yielding to user-initiated play for', libraryItemId)
        return
      }

      this.$store.commit('setMediaPlaying', {
        libraryItem,
        episodeId,
        queueItems: payload.queueItems
      })

      // Update current queue index when starting playback
      const currentIndex = this.currentPlayerQueueIndex
      if (currentIndex >= 0) {
        this.$store.commit('setPlayerQueueCurrentIndex', currentIndex)
      }

      // Sync queue to server when playing starts with a queue
      if (payload.queueItems?.length) {
        this.$store.dispatch('savePlayerQueue', {
          currentIndex: currentIndex >= 0 ? currentIndex : 0,
          currentTime: payload.startTime || 0
        })
      }

      // Set cover aspect ratio for this item's library since the library may change
      this.coverAspectRatio = this.$store.getters['libraries/getBookCoverAspectRatio']

      this.$nextTick(() => {
        if (this.$refs.audioPlayer) this.$refs.audioPlayer.checkUpdateChapterTrack()
      })

      // Pass seriesId through to player handler for series progress tracking
      this.playerHandler.seriesId = payload.seriesId || null

      // Use payload.play to control auto-play (defaults to true for backwards compatibility)
      const shouldPlay = payload.play !== false
      this.playerHandler.load(libraryItem, episodeId, shouldPlay, this.currentPlaybackRate, payload.startTime)

      if (isUserPlay) this._userPlayInProgress = false
    },
    pauseItem() {
      this.playerHandler.pause()
    },
    showFailedProgressSyncs() {
      if (!isNaN(this.syncFailedToast)) this.$toast.dismiss(this.syncFailedToast)
      this.syncFailedToast = this.$toast(this.$strings.ToastProgressIsNotBeingSynced, { timeout: false, type: 'error' })
    },
    sessionClosedEvent(sessionId) {
      if (this.playerHandler.currentSessionId === sessionId) {
        console.log('sessionClosedEvent closing current session', sessionId)
        this.playerHandler.resetPlayer() // Closes player without reporting to server
        this.$store.commit('setMediaPlaying', null)
      }
    },
    async requestWakeLock() {
      if (!('wakeLock' in navigator)) return
      try {
        this._wakeLock = await navigator.wakeLock.request('screen')
        this._wakeLock.addEventListener('release', () => {
          console.log('[WakeLock] Released')
        })
        console.log('[WakeLock] Acquired')
      } catch (err) {
        console.warn('[WakeLock] Failed to acquire:', err.message)
      }
    },
    releaseWakeLock() {
      if (this._wakeLock) {
        this._wakeLock.release()
        this._wakeLock = null
      }
    },
    onVisibilityChange() {
      if (!document.hidden) {
        // Re-acquire wake lock when page becomes visible (browsers release it on hide)
        if (this.streamLibraryItem) {
          this.requestWakeLock()
        }
        // Proactive audio health check
        this.playerHandler.checkAudioHealth()
      }
    }
  },
  mounted() {
    this.$eventBus.$on('cast-session-active', this.castSessionActive)
    this.$eventBus.$on('playback-seek', this.seek)
    this.$eventBus.$on('playback-time-update', this.playbackTimeUpdate)
    this.$eventBus.$on('play-queue-item', this.playQueueItem)
    this.$eventBus.$on('play-item', this.playLibraryItem)
    this.$eventBus.$on('pause-item', this.pauseItem)
    this.$eventBus.$on('restore-queue', this.restoreQueueToPlayer)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  },
  beforeDestroy() {
    this.$eventBus.$off('cast-session-active', this.castSessionActive)
    this.$eventBus.$off('playback-seek', this.seek)
    this.$eventBus.$off('playback-time-update', this.playbackTimeUpdate)
    this.$eventBus.$off('play-queue-item', this.playQueueItem)
    this.$eventBus.$off('play-item', this.playLibraryItem)
    this.$eventBus.$off('pause-item', this.pauseItem)
    this.$eventBus.$off('restore-queue', this.restoreQueueToPlayer)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.releaseWakeLock()
  }
}
</script>

<style>
#mediaPlayerContainer {
  box-shadow: 0px -6px 8px #1111113f;
}
</style>
