"use client"
import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import  useAuthStore  from '@/app/store/authStore'

const TIMEOUT_MS = 30 * 60 * 1000 // 30 минут

export default function useSessionTimeout() {
  const router  = useRouter()
  const timer   = useRef(null)
  const { isAuthenticated, logout } = useAuthStore()

  // Timeout дуусахад автоматаар гаргах
  const handleTimeout = useCallback(() => {
    if (!isAuthenticated) return
    logout()
    router.replace('/login?reason=timeout')
  }, [isAuthenticated, logout, router])

  // Timer дахин эхлүүлэх — хэрэглэгч идэвхтэй байхад дуудагдана
  const resetTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(handleTimeout, TIMEOUT_MS)
  }, [handleTimeout])

  useEffect(() => {
    if (!isAuthenticated) return

    // Хэрэглэгчийн үйлдлүүдийг хянах event-үүд
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

    events.forEach((e) => window.addEventListener(e, resetTimer))

    // Эхний timer эхлүүлэх
    resetTimer()

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer))
      if (timer.current) clearTimeout(timer.current)
    }
  }, [isAuthenticated, resetTimer])
}