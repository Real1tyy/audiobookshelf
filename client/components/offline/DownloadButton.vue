<template>
  <div class="flex items-center" :class="small ? '' : 'gap-1'">
    <!-- Downloading: spinner + progress -->
    <template v-if="isDownloading">
      <svg
        class="animate-spin text-yellow-400"
        :style="{ width: iconSize, height: iconSize }"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <span v-if="!small" class="text-yellow-400 font-mono text-xs">{{ progressText }}</span>
    </template>

    <!-- Queued: schedule icon -->
    <template v-else-if="isQueued">
      <button
        title="Queued for download — tap to cancel"
        class="flex items-center text-blue-400 focus:outline-none"
        @click.stop.prevent="cancelQueued"
      >
        <span class="material-symbols" :style="{ fontSize: iconSize }">schedule</span>
        <span v-if="!small" class="text-blue-400 text-xs ml-1">Queued</span>
      </button>
    </template>

    <!-- Downloaded: cloud_done icon, delete on hover/active -->
    <template v-else-if="isDownloaded">
      <button
        :title="deleteActive ? 'Tap again to delete' : 'Downloaded — tap to delete'"
        class="flex items-center focus:outline-none"
        :class="deleteActive ? 'text-error' : 'text-success'"
        @click.stop.prevent="handleDownloadedClick"
      >
        <span class="material-symbols" :style="{ fontSize: iconSize }">
          {{ deleteActive ? 'delete' : 'cloud_done' }}
        </span>
      </button>
    </template>

    <!-- Error: cloud_off, retry on click -->
    <template v-else-if="hasError">
      <button
        title="Download failed — tap to retry"
        class="flex items-center text-error focus:outline-none"
        @click.stop.prevent="startDownload"
      >
        <span class="material-symbols" :style="{ fontSize: iconSize }">cloud_off</span>
      </button>
    </template>

    <!-- Idle: cloud_download -->
    <template v-else>
      <button
        title="Download for offline playback"
        class="flex items-center text-gray-300 hover:text-white focus:outline-none"
        @click.stop.prevent="startDownload"
      >
        <span class="material-symbols" :style="{ fontSize: iconSize }">cloud_download</span>
      </button>
    </template>
  </div>
</template>

<script>
export default {
  props: {
    libraryItem: {
      type: Object,
      required: true
    },
    small: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      hasError: false,
      deleteActive: false,
      deleteTimeout: null
    }
  },
  computed: {
    itemId() {
      return this.libraryItem?.id
    },
    isDownloaded() {
      if (!this.itemId) return false
      return this.$store.getters['offline/isDownloaded'](this.itemId)
    },
    isDownloading() {
      if (!this.itemId) return false
      return this.$store.getters['offline/isDownloading'](this.itemId)
    },
    isQueued() {
      if (!this.itemId) return false
      return this.$store.getters['offline/isQueued'](this.itemId)
    },
    progress() {
      if (!this.itemId) return 0
      return this.$store.getters['offline/getDownloadProgress'](this.itemId)
    },
    byteProgress() {
      if (!this.itemId) return null
      return this.$store.getters['offline/getByteProgress'](this.itemId)
    },
    progressText() {
      if (this.byteProgress && this.byteProgress.total > 0) {
        const loadedMB = (this.byteProgress.loaded / (1024 * 1024)).toFixed(1)
        const totalMB = (this.byteProgress.total / (1024 * 1024)).toFixed(1)
        return `${loadedMB}/${totalMB} MB`
      }
      return `${this.progress}%`
    },
    token() {
      return this.$store.getters['user/getToken']
    },
    iconSize() {
      return this.small ? '1.1em' : '1.4rem'
    }
  },
  methods: {
    startDownload() {
      this.hasError = false
      // Fire-and-forget enqueue — no await
      this.$store.dispatch('offline/enqueue', {
        libraryItems: [this.libraryItem],
        token: this.token
      })
    },
    cancelQueued() {
      this.$store.dispatch('offline/cancelQueueItem', this.itemId)
    },
    handleDownloadedClick() {
      if (!this.deleteActive) {
        // First tap: show delete confirmation state
        this.deleteActive = true
        this.deleteTimeout = setTimeout(() => {
          this.deleteActive = false
        }, 3000)
      } else {
        // Second tap: delete
        clearTimeout(this.deleteTimeout)
        this.deleteActive = false
        this.$store.dispatch('offline/deleteItem', this.itemId)
      }
    }
  },
  beforeDestroy() {
    clearTimeout(this.deleteTimeout)
  }
}
</script>
