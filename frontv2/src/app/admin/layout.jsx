
'use client'
import Sidebar from '@/components/layout/Sidebar'
import AuthGuard from '@/components/auth/AuthGuard'
import useSessionTimeout from '@/app/hooks/useSessionTimeout'

function SessionWrapper({ children }) {
  useSessionTimeout()
  return <>{children}</>
}

export default function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AuthGuard>
        <SessionWrapper>
          <Sidebar />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </SessionWrapper>
      </AuthGuard>
    </div>
  )
}