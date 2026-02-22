<template>
  <div>
    <div aria-hidden="true" class="rounded-full py-1 bg-primary px-2 border border-black-100 text-center flex items-center box-shadow-md" @mousedown.prevent @mouseup.prevent>
      <span class="material-symbols" :class="currentSize <= minSize ? 'text-gray-400' : 'hover:text-yellow-300 cursor-pointer'" style="font-size: 0.9rem" @mousedown.prevent @click="decreaseSize" aria-label="Decrease Cover Size" role="button">&#xe15b;</span>
      <input
        ref="sizeInput"
        type="number"
        inputmode="numeric"
        :min="minSize"
        :max="maxSize"
        v-model.number="inputValue"
        class="w-12 text-center bg-transparent font-mono outline-none border-none appearance-none"
        style="font-size: 1rem; -moz-appearance: textfield"
        @focus="onFocus"
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
      maxSize: 300,
      inputValue: 120,
      isEditing: false
    }
  },
  watch: {
    currentSize: {
      immediate: true,
      handler(val) {
        if (!this.isEditing) {
          this.inputValue = val
        }
      }
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
      this.inputValue = clamped
      if (clamped === this.currentSize) return
      this.$store.dispatch('user/updateUserSettings', { [this.settingKey]: clamped })
    },
    increaseSize() {
      const base = this.isEditing ? (this.inputValue || this.currentSize) : this.currentSize
      const nextStep = this.stepSizes.find((s) => s > base)
      this.applySize(nextStep || base + 20)
    },
    decreaseSize() {
      const base = this.isEditing ? (this.inputValue || this.currentSize) : this.currentSize
      const prevSteps = this.stepSizes.filter((s) => s < base)
      this.applySize(prevSteps.length ? prevSteps[prevSteps.length - 1] : base - 20)
    },
    onFocus(e) {
      this.isEditing = true
      e.target.select()
    },
    onInputBlur() {
      this.isEditing = false
      const val = parseInt(this.inputValue, 10)
      if (!isNaN(val) && val > 0) {
        this.applySize(val)
      } else {
        this.inputValue = this.currentSize
      }
    },
    onInputEnter() {
      this.$refs.sizeInput.blur()
    }
  }
}
</script>

<style scoped>
/* Hide number input spinners */
input[type='number']::-webkit-outer-spin-button,
input[type='number']::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
