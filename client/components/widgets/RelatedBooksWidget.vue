<template>
  <div class="w-full">
    <p class="px-1 text-sm font-semibold" :class="disabled ? 'text-gray-300' : ''">Related Books</p>
    <div class="flex items-center">
      <div class="w-full relative">
        <form @submit.prevent="submitSearch">
          <ui-text-input ref="input" v-model="textInput" :disabled="disabled" :placeholder="searchPlaceholder" class="w-full" @input="inputUpdate" @focus="inputFocus" @blur="inputBlur" />
        </form>

        <ul v-show="showMenu" ref="menu" class="absolute z-50 mt-1 w-full bg-bg border border-black-200 shadow-lg max-h-56 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm" role="listbox" aria-labelledby="listbox-label">
          <template v-for="item in itemsToShow">
            <li :key="item.id" class="text-gray-100 select-none relative py-2 pr-9 cursor-pointer hover:bg-black-400" role="option" @click="clickShowItem(item)" @mouseup.stop.prevent @mousedown.prevent>
              <div class="flex items-center">
                <span class="font-normal ml-3 block truncate">{{ item.title }}</span>
                <span v-if="item.subtitle" class="ml-2 text-xs text-gray-400 truncate">{{ item.subtitle }}</span>
              </div>
            </li>
          </template>
          <li v-if="!itemsToShow.length" class="text-gray-100 select-none relative py-2 pr-9">
            <div class="flex items-center justify-center">
              <span class="font-normal">{{ searchQuery ? 'No books found' : 'Type to search books' }}</span>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <div v-if="selected.length" class="flex flex-wrap mt-2 -mx-1">
      <template v-for="item in selectedItems">
        <div :key="item.id" class="m-1 rounded-full px-2 py-1 bg-primary bg-opacity-60 text-sm flex items-center justify-center relative">
          <span class="text-xs sm:text-sm">{{ item.title }}</span>
          <span class="material-symbols text-sm ml-1 cursor-pointer hover:text-error" @click="removeItem(item.id)">close</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: {
      type: Array,
      default: () => []
    },
    libraryId: String,
    currentBookId: String,
    disabled: Boolean
  },
  data() {
    return {
      textInput: '',
      selected: [],
      showMenu: false,
      searchQuery: '',
      items: [],
      isFocused: false,
      searchTimeout: null
    }
  },
  computed: {
    searchPlaceholder() {
      return this.selected.length ? `${this.selected.length} selected` : 'Search for books...'
    },
    itemsToShow() {
      if (!this.searchQuery) return []
      // Filter out current book and already selected books
      return this.items.filter((item) => {
        if (item.id === this.currentBookId) return false
        if (this.selected.includes(item.id)) return false
        return true
      })
    },
    selectedItems() {
      return this.selected.map((id) => {
        return this.items.find((item) => item.id === id) || { id, title: 'Unknown' }
      })
    }
  },
  watch: {
    value: {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.selected = [...newVal]
          // Load book data for pre-selected books
          if (this.selected.length && this.items.length === 0) {
            this.loadSelectedBooks()
          }
        }
      }
    }
  },
  methods: {
    async loadSelectedBooks() {
      // Load book data for already-selected books
      if (!this.selected.length) return

      try {
        const payload = await this.$axios.$get(`/api/libraries/${this.libraryId}/items`, {
          params: {
            filter: 'all',
            minified: 1,
            limit: 1000,
            page: 0,
            mediaType: 'book'
          }
        })

        if (payload.results) {
          // Find books that match our selected IDs
          const selectedBooks = payload.results.filter((item) => {
            return this.selected.includes(item.media.id)
          })

          // Add them to items if not already there
          selectedBooks.forEach((item) => {
            const bookData = {
              id: item.media.id,
              title: item.media.metadata.title,
              subtitle: item.media.metadata.subtitle
            }
            // Only add if not already in items
            if (!this.items.find((i) => i.id === bookData.id)) {
              this.items.push(bookData)
            }
          })
        }
      } catch (error) {
        console.error('Failed to load selected books', error)
      }
    },
    inputUpdate() {
      clearTimeout(this.searchTimeout)
      this.searchTimeout = setTimeout(() => {
        this.search()
      }, 250)
    },
    inputFocus() {
      this.isFocused = true
      if (!this.showMenu && this.textInput) {
        this.search()
      }
    },
    inputBlur() {
      setTimeout(() => {
        this.showMenu = false
        this.isFocused = false
      }, 200)
    },
    async search() {
      if (!this.textInput || !this.textInput.trim()) {
        this.searchQuery = ''
        this.items = []
        this.showMenu = false
        return
      }

      this.searchQuery = this.textInput.trim()
      this.showMenu = true

      try {
        const payload = await this.$axios.$get(`/api/libraries/${this.libraryId}/items`, {
          params: {
            filter: 'all',
            minified: 1,
            limit: 50,
            page: 0,
            mediaType: 'book',
            q: this.searchQuery
          }
        })

        if (payload.results) {
          // Update items array with search results
          payload.results.forEach((item) => {
            const bookData = {
              id: item.media.id,
              title: item.media.metadata.title,
              subtitle: item.media.metadata.subtitle
            }
            // Only add if not already in items
            if (!this.items.find((i) => i.id === bookData.id)) {
              this.items.push(bookData)
            }
          })
        }
      } catch (error) {
        console.error('Failed to search books', error)
        this.$toast.error('Failed to search books')
      }
    },
    submitSearch() {
      if (this.itemsToShow.length) {
        this.clickShowItem(this.itemsToShow[0])
      }
    },
    clickShowItem(item) {
      this.selected.push(item.id)
      this.textInput = ''
      this.searchQuery = ''
      this.showMenu = false
      this.$emit('input', this.selected)
      this.$nextTick(() => {
        this.$refs.input.blur()
      })
    },
    removeItem(id) {
      this.selected = this.selected.filter((_id) => _id !== id)
      this.$emit('input', this.selected)
    },
    blur() {
      if (this.$refs.input) {
        this.$refs.input.blur()
      }
    },
    forceBlur() {
      this.showMenu = false
      this.isFocused = false
      this.blur()
    }
  },
  mounted() {}
}
</script>
