<template>
  <div ref="wrapper" class="relative" v-click-outside="clickOutside">
    <button type="button" class="relative w-full h-full bg-fg border border-gray-500 hover:border-gray-400 rounded-sm shadow-xs pl-3 pr-3 py-0 text-left focus:outline-hidden sm:text-sm cursor-pointer" aria-haspopup="menu" :aria-expanded="showMenu" @click.prevent="showMenu = !showMenu">
      <span class="flex items-center justify-between">
        <span class="block truncate text-xs" :class="!selectedText ? 'text-gray-300' : ''">{{ selectedText }}</span>
        <span class="material-symbols text-lg text-yellow-400" :aria-label="descending ? $strings.LabelSortDescending : $strings.LabelSortAscending">{{ descending ? 'expand_more' : 'expand_less' }}</span>
      </span>
    </button>

    <ul v-show="showMenu" class="absolute z-50 mt-1 w-full bg-bg border border-black-200 shadow-lg max-h-96 rounded-md py-1 ring-1 ring-black/5 overflow-auto focus:outline-hidden text-sm" role="menu">
      <li v-for="item in selectItems" :key="item.value" class="select-none relative py-2 pr-9 cursor-pointer hover:bg-white/5" :class="item.value === selected ? 'bg-white/5 text-yellow-400' : 'text-gray-200 hover:text-white'" role="menuitem" @click="clickedOption(item.value)">
        <div class="flex items-center">
          <span class="font-normal ml-3 block truncate">{{ item.text }}</span>
        </div>
        <span v-if="item.value === selected" class="text-yellow-400 absolute inset-y-0 right-0 flex items-center pr-4">
          <span class="material-symbols text-xl" :aria-label="descending ? $strings.LabelSortDescending : $strings.LabelSortAscending">{{ descending ? 'expand_more' : 'expand_less' }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  props: {
    value: String,
    descending: Boolean
  },
  data() {
    return {
      showMenu: false
    }
  },
  computed: {
    selected: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    selectedDesc: {
      get() {
        return this.descending
      },
      set(val) {
        this.$emit('update:descending', val)
      }
    },
    selectItems() {
      return [
        {
          text: this.$strings.LabelTitle,
          value: 'title'
        },
        {
          text: this.$strings.LabelPublishYear,
          value: 'publishedYear'
        },
        {
          text: this.$strings.LabelAddedAt,
          value: 'addedAt'
        },
        {
          text: this.$strings.LabelSize,
          value: 'size'
        },
        {
          text: this.$strings.LabelDuration,
          value: 'duration'
        },
        {
          text: this.$strings.LabelLibrarySortByProgress,
          value: 'progress'
        },
        {
          text: this.$strings.LabelRandomly,
          value: 'random'
        }
      ]
    },
    selectedText() {
      const item = this.selectItems.find((i) => i.value === this.selected)
      return item ? item.text : ''
    }
  },
  methods: {
    clickOutside() {
      this.showMenu = false
    },
    clickedOption(val) {
      if (this.selected === val) {
        this.selectedDesc = !this.selectedDesc
      } else {
        this.selected = val
        if (this.defaultsToAsc(val)) this.selectedDesc = false
      }
      this.showMenu = false
      this.$nextTick(() => this.$emit('change', val))
    },
    defaultsToAsc(val) {
      return val === 'title' || val === 'publishedYear'
    }
  }
}
</script>
