'use client'

import { useEffect } from 'react'

// SW-г client дээр бүртгэнэ. layout.tsx-ийн body-д mount хийгдэнэ.

export default function ServiceWorkerRegister() {
  
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // Dev-д SW-г унтраана — хуучин кэшэлсэн chunk 404/503 Offline үүсгэдэг.
    // Offline/PWA боломж зөвхөн production build дээр ажиллана.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister())
      })
      return
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => console.log('[SW] registered, scope:', reg.scope))
      .catch((err) => console.error('[SW] registration failed:', err))
  }, [])

  return null
}
