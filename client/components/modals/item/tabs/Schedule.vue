<template>
  <div class="w-full h-full relative">
    <!-- Schedule tab removed: podcast-only feature -->
  </div>
</template>

<script>
export default {
  props: {
    processing: Boolean,
    libraryItem: {
      type: Object,
      default: () => {}
    }
  }
}
</script>
