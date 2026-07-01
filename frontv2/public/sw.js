// MalchinGeree Service Worker — offline fallback + cache versioning
// Стратеги: network-first + cache fallback.
//   • Online үед 200 хариуг кэшэлж, offline үед кэшнээс / app shell-ээс үйлчилнэ.
//   • Cache нэр VERSION-той — DEPLOY БҮРД VERSION-ийг нэмэгдүүлбэл (v2 → v3)
//     хуучин cache activate дээр цэвэрлэгдэж, "stale chunk → 503" асуудал арилна.
const VERSION   = 'v2'                    // ← ШИНЭ deploy бүрд нэмэгдүүлнэ
const CACHE     = `mg-offline-${VERSION}`
const APP_SHELL = '/'                     // offline navigation-ийн fallback

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // App shell-ийг урьдчилан кэшэлнэ — offline navigation найдвартай fallback-тай болно
        const cache = await caches.open(CACHE)
        await cache.add(APP_SHELL)
      } catch (_) {
        /* install үед offline бол алгасна — activate-д дахин оролдоно */
      }
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Хуучин version-ы cache-уудыг цэвэрлэх (stale chunk-ийг устгана)
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

  // Next.js RSC prefetch (?_rsc=...) — SW-ээр боловсруулахгүй, шууд сүлжээнд өгнө.
  // Ингэснээр амжилтгүй/404 prefetch нь console-д хиймэл 503 өгөхгүй.
  if (url.searchParams.has('_rsc')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Зөвхөн амжилттай, ижил-origin (basic) хариуг кэшэлнэ
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(async () => {
        // Сүлжээ амжилтгүй (жинхэнэ offline) — кэшнээс үйлчилнэ
        const cached = await caches.match(request)
        if (cached) return cached
        if (request.mode === 'navigate') {
          const shell = await caches.match(APP_SHELL)
          if (shell) return shell
        }
        return new Response('Offline — кэшэгдсэн хувилбар олдсонгүй', {
          status: 503,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      })
  )
})
