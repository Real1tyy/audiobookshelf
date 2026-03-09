const MAX_TIMEOUT = 2147483647

/**
 * Handle timeouts greater than 32-bit signed integer
 */
class LongTimeout {
  private timeout: number = 0
  private timer: ReturnType<typeof setTimeout> | null = null

  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  set(fn: () => void, timeout: number): void {
    const handleTimeout = (): void => {
      if (this.timeout > 0) {
        const delay = Math.min(this.timeout, MAX_TIMEOUT)
        this.timeout -= delay
        this.timer = setTimeout(handleTimeout, delay)
        return
      }
      fn()
    }

    this.timeout = timeout
    handleTimeout()
  }
}

export = LongTimeout
