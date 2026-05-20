"use client"
import AuthGuard from '@/components/auth/AuthGuard'

export default function AuthLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden">

      <div className="flex-1 flex items-center justify-center bg-white px-8 py-10 overflow-y-auto">
        {children}
      </div>

      <div className="hidden lg:block lg:flex-1 relative">
        <img
          src="/BgLogin3.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    </div>
  );
}