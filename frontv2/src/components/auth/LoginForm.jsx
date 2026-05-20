"use client"
import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import  useAuthStore  from '@/app/store/authStore'
import Link from 'next/link'

export default function LoginForm({ onSuccess }) {
  const { login, authLoading, authError, clearError } = useAuthStore()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const redirectTo   = searchParams.get('redirect')

  const [form, setForm] = useState({ phone: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error,   setError]   = useState(null)
  const [loading, setLoading] = useState(false)
  const handleChange = (e) => {
    clearError?.()
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.phone || !form.password) {
        return setError('Утас болон нууц үгээ оруулна уу')
    }
 setLoading(true)
    setError(null)

    try {
      // Backend: POST /api/auth/login { phone, password }
      // Хариу: { user, token }
      await login(form.phone, form.password)
      // redirect параметр байвал тэр хуудсанд, эс бол dashboard-д
      if (redirectTo) router.push(redirectTo)
      else onSuccess?.()
    } catch (error) {
      console.error('Login error:', error)
      setError('Нэвтрэхэд алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl px-10 py-12 w-full max-w-110">
      <div className="mb-9">
        <h1 className="text-3xl font-light tracking-[0.12em] uppercase text-gray-900 mb-2.5 m-0">
          Сайн байна уу
        </h1>
        <p className="text-sm text-gray-500 m-0">Welcome back! Please enter your details.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">

        {/* Утас */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Утас</label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="99112233"
            maxLength={8}
            required
            className="w-full px-3.5 py-3 border border-gray-200 rounded-[10px] text-sm outline-none box-border bg-gray-50 text-gray-900"
          />
        </div>

        {/* Нууц үг */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Нууц үг</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••••"
              required
              className="w-full px-3.5 py-3 pr-13 border border-gray-200 rounded-[10px] text-sm outline-none box-border bg-gray-50 text-gray-900"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer text-base leading-none p-0"
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        {/* Backend алдаа */}
        {authError && (
          <p className="text-red-400 text-[13px] m-0">{authError}</p>
        )}

        <div className="flex justify-between items-center">
          <Link href="/forgot-password" className="text-sm text-gray-700 no-underline">
            Нууц үг мартсан
          </Link>
        </div>

        {/* Нэвтрэх товч */}
        <button
          type="submit"
          disabled={authLoading}
          className="w-full py-3.25 bg-[#3d3a8c] disabled:bg-gray-400 text-white border-0 rounded-[10px] text-[15px] font-medium cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          {authLoading ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
        </button>

      
        {/* <button
          type="button"
          className="w-full py-3.25 bg-white text-gray-900 border-0 rounded-[10px] text-[15px] font-normal cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.10)]"
        >
          ДАН системээр нэвтрэх
        </button> */}
      </form>

      <p className="text-center mt-6 text-sm text-gray-500">
        Бүртгэл байхгүй юу?{' '}
        <Link href="/register" className="text-[#3d3a8c] no-underline font-semibold">
          Бүртгүүлэх
        </Link>
      </p>
    </div>
  )
}