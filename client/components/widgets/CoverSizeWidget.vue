<template>
  <div>
    <div aria-hidden="true" class="rounded-full py-1 bg-primary px-2 border border-black-100 text-center flex items-center box-shadow-md" @mousedown.prevent @mouseup.prevent>
      <span class="material-symbols" :class="currentSize <= minSize ? 'text-gray-400' : 'hover:text-yellow-300 cursor-pointer'" style="font-size: 0.9rem" @mousedown.prevent @click="decreaseSize" aria-label="Decrease Cover Size" role="button">&#xe15b;</span>
      <input
        ref="sizeInput"
        type="text"
        inputmode="numeric"
        :value="currentSize"
        class="w-10 text-center bg-transparent font-mono outline-none border-none"
        style="font-size: 1rem"
        @focus="$event.target.select()"
        @blur="onInputBlur"
        @keydown.enter="onInputEnter"
        @keydown.up.prevent="increaseSize"
        @keydown.down.prevent="decreaseSize"
      />
      <span class="material-symbols" :class="currentSize >= maxSize ? 'text-gray-400' : 'hover:text-yellow-300 cursor-pointer'" style="font-size: 0.9rem" @mousedown.prevent @click="increaseSize" aria-label="Increase Cover Size" role="button">&#xe145;</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    settingKey: {
      type: String,
      default: 'bookshelfCoverSize'
    }
  },
  data() {
    return {
      stepSizes: [60, 80, 100, 120, 140, 160, 180, 200, 220],
      minSize: 40,
      maxSize: 300
    }
  },
  computed: {
    currentSize() {
      return this.$store.getters['user/getPageCoverSize'](this.settingKey)
    }
  },
  methods: {
    applySize(size) {
      const clamped = Math.max(this.minSize, Math.min(this.maxSize, Math.round(size)))
      if (clamped === this.currentSize) return
      this.$store.dispatch('user/updateUserSettings', { [this.settingKey]: clamped })
    },
    increaseSize() {
      // Jump to next step size above current, or +20 if past max step
      const nextStep = this.stepSizes.find((s) => s > this.currentSize)
      this.applySize(nextStep || this.currentSize + 20)
    },
    decreaseSize() {
      // Jump to previous step size below current, or -20 if below min step
      const prevSteps = this.stepSizes.filter((s) => s < this.currentSize)
      this.applySize(prevSteps.length ? prevSteps[prevSteps.length - 1] : this.currentSize - 20)
    },
    onInputBlur(e) {
      const val = parseInt(e.target.value, 10)
      if (!isNaN(val) && val > 0) {
        this.applySize(val)
      }
      // Reset display to current store value (in case of invalid input)
      e.target.value = this.currentSize
    },
    onInputEnter(e) {
      e.target.blur()
    }
  }
}
</script>
