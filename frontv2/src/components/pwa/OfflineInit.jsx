'use client'

import { useEffect } from 'react'
import useOfflineStore from '@/app/store/offlineStore'

// Dashboard layout-д mount хийгдэнэ (AuthGuard дотор тул token бэлэн).
// • offline store-ийг init хийнэ (cache унших + online бол sync)
// • online/offline event-уудыг сонсож store-ийг шинэчилнэ
export default function OfflineInit() {
  const init       = useOfflineStore((s) => s.init)
  const setOnline  = useOfflineStore((s) => s.setOnline)
  const syncDrafts = useOfflineStore((s) => s.syncDrafts)

  useEffect(() => {
    init()

    const goOnline  = () => {
      setOnline(true)
      // Сүлжээ сэргэхэд хүлээгдэж буй draft-уудыг автоматаар sync (best-effort)
      syncDrafts().catch(() => {})
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [init, setOnline, syncDrafts])

  return null
}
