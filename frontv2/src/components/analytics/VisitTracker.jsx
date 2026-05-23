'use client'
import { useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

// Backend-д нэг л удаа ping явуулна (нэвтрээгүй зочдын тоо).
// Нэвтэрсэн (token-той) хэрэглэгчийг бүртгэхгүй.
// SessionStorage-аар нэг session-д нэг path-аар нэг л удаа дуудна.
export default function VisitTracker({ path }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('token')) return

    const key = `visit:${path}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')

    fetch(`${API}/public/visit`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ path, referer: document.referrer || '' }),
      keepalive: true,
    }).catch(() => {})
  }, [path])

  return null
}
