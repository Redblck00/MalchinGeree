"use client"
import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import useAuthStore from '@/app/store/authStore'
import Link from 'next/link'
import { FiEye, FiEyeOff } from 'react-icons/fi'

export default function LoginForm({ onSuccess }) {
  const { login, authLoading, authError, clearError } = useAuthStore()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const redirectTo   = searchParams.get('redirect')

  const [form, setForm] = useState({ phone: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [remember,     setRemember]     = useState(false)
  const [error,        setError]        = useState(null)
  const [loading,      setLoading]      = useState(false)

  const handleChange = (e) => {
    clearError?.()
    setError(null)
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
      await login(form.phone, form.password)
      if (redirectTo) router.push(redirectTo)
      else onSuccess?.()
    } catch (err) {
      console.error('Login error:', err)
      // authError нь authStore-д backend-ээс ирсэн жинхэнэ message-аар set хийгдсэн.
      // (err.response.data.message → "Утас эсвэл нууц үг буруу" гм)
      // Энд local setError-аар overwrite хийвэл хэрэглэгч жинхэнэ шалтгааныг харахгүй.
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-100 rounded-2xl px-10 py-12 w-full max-w-md">

      {/* ── Title ───────────────────────────────────────── */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-light tracking-[0.12em] uppercase text-gray-900 mb-2 m-0">
          Сайн байна уу
        </h1>
        <p className="text-sm text-gray-500 m-0">
          Welcome back! Please enter your details.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* ── Утас ─────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Утас</label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="бүртгэлтэй утасны дугаар"
            maxLength={8}
            required
            autoComplete="tel"
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-full text-sm
                       text-gray-900 placeholder:text-gray-400 outline-none box-border
                       focus:border-gray-400 transition-colors"
          />
        </div>

        {/* ── Нууц үг ─────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Нууц үг</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="**********"
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 pr-12 bg-white border border-gray-200 rounded-full text-sm
                         text-gray-900 placeholder:text-gray-400 outline-none box-border
                         focus:border-gray-400 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              tabIndex={-1}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-0
                         cursor-pointer leading-none p-0 text-gray-400 hover:text-gray-600
                         transition-colors inline-flex items-center justify-center"
              aria-label={showPassword ? 'Нуух' : 'Харах'}
            >
              {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
        </div>

        {/* ── Алдаа ────────────────────────────────────── */}
        {(error || authError) && (
          <p className="text-red-500 text-xs m-0">{error || authError}</p>
        )}

        {/* ── Remember + Forgot ────────────────────────── */}
        <div className="flex justify-between items-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border border-gray-300 accent-[#3d3a8c] cursor-pointer"
            />
            <span className="text-sm text-gray-700">Намайг сана</span>
          </label>
          <Link
            href="/forgot-password"
            className="text-sm text-gray-700 hover:text-[#3d3a8c] no-underline"
          >
            Нууц үг мартсан
          </Link>
        </div>

        {/* ── Нэвтрэх товч ─────────────────────────────── */}
        <button
          type="submit"
          disabled={authLoading || loading}
          className="w-full py-3 bg-[#3d3a8c] hover:bg-[#2d2a6e]
                     disabled:bg-gray-400 disabled:cursor-not-allowed
                     text-white border-0 rounded-full text-[15px] font-medium
                     cursor-pointer transition-colors"
        >
          {authLoading || loading ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
        </button>

        {/* ── ДАН ─────────────────────────────────────── */}
      
      </form>

      {/* ── Register link ───────────────────────────────── */}
      <p className="text-center mt-6 text-sm text-gray-500">
        Бүртгэл байхгүй юу?{' '}
        <Link href="/register" className="text-[#3d3a8c] no-underline font-semibold">
          Бүртгүүлэх
        </Link>
      </p>
    </div>
  )
}
