<template>
  <modals-modal v-model="show" name="edit-series" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div v-if="series" class="p-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden" style="min-height: 400px; max-height: 80vh">
      <div class="flex">
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
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      seriesCopy: {
        name: '',
        description: '',
        coverPath: null
      },
      imageUrl: '',
      processing: false
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
    }
  },
  methods: {
    init() {
      this.imageUrl = ''
      this.seriesCopy = {
        ...this.series
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
