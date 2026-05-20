"use client"
import SideBar from '@/components/layout/Sidebar'
import useSessionTimeout from '@/app/hooks/useSessionTimeout'
import AuthGuard from '@/components/auth/AuthGuard'
function SessionWrapper({ children }) {
  // Нэвтэрсэн хэрэглэгчид session timeout ажиллуулна
  useSessionTimeout()
  return <>{children}</>
}
 
export default function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
       <AuthGuard>
      <SessionWrapper>
      <SideBar />
      <main className="flex-1 min-w-0">
        {children}
      </main>
      </SessionWrapper>
    </AuthGuard>
    </div>
  )
}
