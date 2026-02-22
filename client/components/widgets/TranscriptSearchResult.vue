<template>
  <nuxt-link :to="`/item/${result.libraryItemId}`" class="block bg-bg rounded-md border border-white border-opacity-10 hover:border-opacity-30 p-4 cursor-pointer transition-all duration-200">
    <p class="text-sm font-semibold text-gray-100 mb-1 truncate">{{ result.title }}</p>
    <p class="text-sm text-gray-300 leading-relaxed transcript-snippet" v-html="result.snippet"></p>
  </nuxt-link>
</template>

<script>
export default {
  props: {
    result: {
      type: Object,
      required: true
    }
  }
}
</script>

<style scoped>
.transcript-snippet :deep(mark) {
  background-color: rgba(255, 255, 0, 0.3);
  color: inherit;
  padding: 0 2px;
  border-radius: 2px;
}
</style>
