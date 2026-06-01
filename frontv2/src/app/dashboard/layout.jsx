"use client"
import SideBar from '@/components/layout/Sidebar'
import PageTransition from '@/components/layout/PageTransition'
import useSessionTimeout from '@/app/hooks/useSessionTimeout'
import AuthGuard from '@/components/auth/AuthGuard'

function SessionWrapper({ children }) {
  useSessionTimeout()
  return <>{children}</>
}

export default function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-white font-forum">
      <AuthGuard>
        <SessionWrapper>
          <SideBar />
          {/* overflow-x-hidden — slide-in animation-ын үед түр зуурын
              horizontal scrollbar гарахаас сэргийлнэ */}
          <main className="flex-1 min-w-0 overflow-x-hidden">
            <PageTransition>{children}</PageTransition>
          </main>
        </SessionWrapper>
      </AuthGuard>
    </div>
  )
}
