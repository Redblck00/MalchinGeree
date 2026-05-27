"use client"
import Image from 'next/image'
import AuthGuard from '@/components/auth/AuthGuard'

export default function AuthLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-white">

      {/* ── ЗҮҮН: Illustration ───────────────────────────── */}
      <div className="hidden lg:flex lg:flex-1 items-center justify-center p-12">
        <Image
          src="/auth/login.png"
          alt="Authenticate"
          width={500}
          height={500}
          priority
          className="w-full max-w-md h-auto object-contain"
        />
      </div>

      {/* ── БАРУУН: Form area ────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
