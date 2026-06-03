// ── MalchinGeree Service Worker (offline fail-fast proof) ──────────────
// Гар бичсэн SW — bundler (Turbopack/webpack)-ээс хамаарахгүй static файл.
// Стратеги: network-first + cache fallback. Online үед хариуг кэшэлж,
// offline үед кэшнээс үйлчилнэ (navigation бол root руу fallback).
const CACHE = 'mg-offline-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Хуучин cache version-уудыг цэвэрлэх
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return 

  event.respondWith(
    fetch(request)
      .then((response) => {
        // 
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        if (request.mode === 'navigate') {
          const root = await caches.match('/')
          if (root) return root
        }
        return new Response('Offline — кэшэгдсэн хувилбар олдсонгүй', {
          status: 503,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      })
  )
})
