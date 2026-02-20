/**
 * Offline Audio Service Worker
 *
 * Intercepts fetch requests for offline audio files (cached via the Cache Storage API)
 * and serves them directly from the cache. This lets the browser's audio element stream
 * audio from disk-backed cache instead of loading entire files into RAM via blob URLs.
 */

const CACHE_NAME = 'abs-audio-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only intercept offline audio requests
  if (!url.pathname.startsWith('/offline/items/')) return

  event.respondWith(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.match(event.request))
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }
        return new Response('Not found in offline cache', {
          status: 404,
          statusText: 'Not Found'
        })
      })
      .catch(() => {
        return new Response('Cache error', {
          status: 500,
          statusText: 'Internal Error'
        })
      })
  )
})
