"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import  useAuthStore  from '@/app/store/authStore'
import api from '@/lib/api'

export default function AuthGuard({ children }) {
  const router = useRouter()
  const { isAuthenticated, restoreAuth, logout } = useAuthStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const check = async () => {
      // localStorage-с auth сэргээх
      restoreAuth()

      const { isAuthenticated: isAuth } = useAuthStore.getState()

      if (!isAuth) {
        // Нэвтрээгүй → login руу
        const path = window.location.pathname
        router.replace(`/login?redirect=${path}`)
        return
      }

      // Offline бол серверийн шалгалтыг алгасаж локал token-оор шууд нэвтрүүлнэ
      // (эс бол /users/profile нь timeout хүртэл (10с) spinner дээр гацна).
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setChecking(false)
        return
      }

      // Token хүчинтэй эсэхийг backend-с шалгах
      try {
        await api.get('/users/profile')
        setChecking(false)
      } catch (err) {
        if (err.response?.status === 401) {
          // Token хугацаа дууссан эсвэл хүчингүй → гаргах
          logout()
          router.replace('/login?reason=expired')
        } else {
          // Сүлжээгүй / сервер унтарсан (network error, response байхгүй):
          // локал token хүчинтэй тул offline горимд нэвтрүүлнэ.
          // Зөвхөн 401 үед л logout хийнэ — өөр алдаа session-ийг таслахгүй.
          setChecking(false)
        }
      }
    }

    check()
  }, [])

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-[#1e1b4b] rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}