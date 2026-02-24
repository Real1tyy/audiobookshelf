<template>
  <modals-modal ref="modal" v-model="show" name="add-virtual-item" :width="600" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden pointer-events-none">
        <p class="text-3xl text-white truncate">Add Item</p>
      </div>
    </template>
    <form @submit.prevent="submitForm">
      <div class="px-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 overflow-y-auto overflow-x-hidden" style="min-height: 400px; max-height: 80vh">
        <div class="w-full p-4">
          <div class="w-full mb-2 p-1">
            <ui-text-input-with-label v-model="newTitle" label="Title" trim-whitespace />
          </div>
          <div class="w-full mb-2 p-1">
            <ui-text-input-with-label v-model="newUrl" label="URL (e.g. YouTube link)" trim-whitespace />
          </div>
          <div class="w-full mb-2 p-1">
            <ui-text-input-with-label v-model="newAuthorName" label="Author" trim-whitespace />
          </div>
          <div class="w-full mb-2 p-1">
            <ui-textarea-with-label v-model="newDescription" label="Description" :rows="3" />
          </div>
          <div class="w-full mb-2 p-1">
            <ui-text-input-with-label v-model="newTags" label="Tags (comma-separated)" trim-whitespace />
          </div>
          <div class="w-full mb-2 p-1">
            <ui-textarea-with-label v-model="newTranscript" label="Transcript" :rows="6" />
          </div>
          <div class="flex px-1 pt-4">
            <div class="grow" />
            <ui-btn color="bg-success" type="submit">{{ $strings.ButtonAdd || 'Add' }}</ui-btn>
          </div>
        </div>
      </div>
    </form>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    libraryId: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      processing: false,
      newTitle: '',
      newUrl: '',
      newAuthorName: '',
      newDescription: '',
      newTags: '',
      newTranscript: ''
    }
  },
  watch: {
    show: {
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
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    }
  },
  methods: {
    async submitForm() {
      document.activeElement?.blur?.()
      await this.$nextTick()

      if (!this.newTitle) {
        this.$toast.error('Title is required')
        return
      }

      const tags = this.newTags
        ? this.newTags
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t)
        : []

      this.processing = true
      this.$axios
        .$post('/api/items', {
          libraryId: this.libraryId,
          title: this.newTitle,
          url: this.newUrl || undefined,
          authorName: this.newAuthorName || undefined,
          description: this.newDescription || undefined,
          tags: tags.length ? tags : undefined,
          transcript: this.newTranscript || undefined
        })
        .then(() => {
          this.$toast.success('Item created')
          this.show = false
        })
        .catch((error) => {
          console.error('Failed to create item', error)
          this.$toast.error('Failed to create item')
        })
        .finally(() => {
          this.processing = false
        })
    },
    init() {
      this.newTitle = ''
      this.newUrl = ''
      this.newAuthorName = ''
      this.newDescription = ''
      this.newTags = ''
      this.newTranscript = ''
    }
  }
}
</script>
