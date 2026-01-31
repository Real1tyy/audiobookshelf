<template>
  <modals-modal v-model="show" name="queue-items" :width="800" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ $strings.HeaderPlayerQueue }}</p>
      </div>
    </template>
    <div ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden py-4" style="max-height: 80vh">
      <div v-if="show" class="w-full h-full">
        <div class="pb-4 px-4 flex items-center">
          <p class="text-base text-gray-200">{{ $strings.HeaderPlayerQueue }}</p>
          <p class="text-base text-gray-400 px-4">{{ playerQueueItems.length }} {{ $strings.LabelItems || 'Items' }}</p>
          <div class="grow" />
          <button v-if="hasItemsToClear" class="flex items-center px-3 py-1 mr-4 rounded bg-error/80 hover:bg-error text-white text-sm transition-colors" @click="clearAll">
            <span class="material-symbols text-base mr-1">delete_sweep</span>
            {{ $strings.ButtonClearAll || 'Clear All' }}
          </button>
          <ui-checkbox v-model="playerQueueAutoPlay" label="Auto Play" medium checkbox-bg="primary" border-color="gray-600" label-class="pl-2 mb-px" />
        </div>
        <modals-player-queue-item-row v-for="(item, index) in playerQueueItems" :key="index" :item="item" :index="index" @play="playItem(index)" @remove="removeItem" />
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean
  },
  data() {
    return {}
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    playerQueueAutoPlay: {
      get() {
        return this.$store.state.playerQueueAutoPlay
      },
      set(val) {
        this.$store.commit('setPlayerQueueAutoPlay', val)
      }
    },
    playerQueueItems() {
      return this.$store.state.playerQueueItems || []
    },
    currentlyPlayingLibraryItemId() {
      return this.$store.state.streamLibraryItem?.id || null
    },
    currentlyPlayingEpisodeId() {
      return this.$store.state.streamEpisodeId || null
    },
    // Check if there are items to clear (more than just the currently playing item)
    hasItemsToClear() {
      if (this.playerQueueItems.length <= 1) return false
      return this.playerQueueItems.length > 1
    }
  },
  methods: {
    playItem(index) {
      this.$eventBus.$emit('play-queue-item', {
        index
      })
      this.show = false
    },
    removeItem(item) {
      this.$store.commit('removeItemFromQueue', item)
    },
    clearAll() {
      // Keep only the currently playing item in the queue
      const currentLibraryItemId = this.currentlyPlayingLibraryItemId
      const currentEpisodeId = this.currentlyPlayingEpisodeId

      if (currentLibraryItemId) {
        // Find the currently playing item in the queue
        const currentItem = this.playerQueueItems.find((item) => {
          if (currentEpisodeId) {
            return item.libraryItemId === currentLibraryItemId && item.episodeId === currentEpisodeId
          }
          return item.libraryItemId === currentLibraryItemId && !item.episodeId
        })

        if (currentItem) {
          // Keep only the current item
          this.$store.commit('setPlayerQueueItems', [currentItem])
        } else {
          // Current item not in queue, clear everything
          this.$store.commit('setPlayerQueueItems', [])
        }
      } else {
        // Nothing playing, clear everything
        this.$store.commit('setPlayerQueueItems', [])
      }

      this.$toast.success(this.$strings.ToastQueueCleared || 'Queue cleared')
    }
  }
}
</script>
