"use client"
import { usePathname } from 'next/navigation'
import AuthGuard from '@/components/auth/AuthGuard'
import useSessionTimeout from '@/app/hooks/useSessionTimeout'

// /document/templates → нэвтрэлтгүй харж болно
// /document хэсгийн бусад хуудас → нэвтрэх шаардлагатай
const PUBLIC_PATHS = ['/document/templates']
function SessionWrapper({ children }) {
  // Нэвтэрсэн хэрэглэгчид session timeout ажиллуулна
  useSessionTimeout()
  return <>{children}</>
}

export default function DocumentLayout({ children }) {
  const pathname = usePathname()
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
   // Templates хуудас — AuthGuard хэрэггүй
  if (isPublic) return <>{children}</>
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AuthGuard>
      <SessionWrapper>
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
      </SessionWrapper>
      </AuthGuard>
    </div>
  )
}
