"use client"
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LoginForm from '@/components/auth/LoginForm'
import  useAuthStore  from '@/app/store/authStore'

function LoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirect     = searchParams.get('redirect') || '/dashboard'
  const reason       = searchParams.get('reason')

  const messages = {
    timeout:  '5 минут идэвхгүй байсан тул автоматаар гарлаа.',
    expired:  'Нэвтрэлтийн хугацаа дууссан. Дахин нэвтэрнэ үү.',
  }

  const handleSuccess = () => {
    const { user } = useAuthStore.getState()
    if (user?.user_type === 'ADMIN') {
      router.replace('/admin')
    } else {
      router.replace(redirect)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {reason && messages[reason] && (
        <div className="w-full max-w-110 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700 text-center">
          {messages[reason]}
        </div>
      )}
      <LoginForm onSuccess={handleSuccess} />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Уншиж байна...</div>}>
      <LoginContent />
    </Suspense>
  )
}