<template>
  <div class="flex items-center px-4 py-3 cursor-pointer hover:bg-bg relative border-b border-white/10" @click="clickedSeries">
    <div class="grow px-2 seriesContent truncate">
      <p class="truncate text-sm">{{ series.name }}</p>
      <p class="text-xs text-gray-400">{{ bookCount }}</p>
    </div>
    <div class="w-12 flex justify-end">
      <span class="material-symbols text-success text-xl">add</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    series: {
      type: Object,
      default: () => {}
    }
  },
  computed: {
    bookCount() {
      const count = this.series.numBooks || 0
      if (count === 1) {
        return this.$getString('MessageOneBooksInSeries', [count])
      }
      return this.$getString('MessageBooksInSeries', [count])
    }
  },
  methods: {
    clickedSeries() {
      this.$emit('add', this.series)
    }
  }
}
</script>

<style scoped>
.seriesContent {
  max-width: calc(100% - 48px);
}
</style>
