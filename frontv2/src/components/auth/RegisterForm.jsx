"use client"
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import  useAuthStore  from '@/app/store/authStore'
import OtpVerify from '@/components/auth/OtpVerify'
import Link from 'next/link'
import {Button,Input} from '../ui/index'
const requirements = [
  { label: 'Багадаа 8 тэмдэгт оруулах', test: (p) => p.length >= 8 },
  { label: 'Том үсэг ашиглах (A–Z)',     test: (p) => /[A-Z]/.test(p) },
  { label: 'Жижиг үсэг ашиглах (a–z)',   test: (p) => /[a-z]/.test(p) },
  { label: 'Тооны утга оруулах (1–9)',    test: (p) => /[0-9]/.test(p) },
]

export default function RegisterForm() {
  const { register, authLoading, authError, clearError } = useAuthStore()
  const searchParams = useSearchParams()
  const redirectTo   = searchParams.get('redirect') || null
  const inviteEmail  = searchParams.get('email') || ''

  const [step, setStep] = useState('register')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [form, setForm] = useState({
    first_name: '',
    last_name:  '',
    phone:      '',
    email:      inviteEmail,  // Урилгын линкээс ирсэн email-г pre-fill
    password:   '',
  })

  // URL-аар email өөрчлөгдвөл form-д шинэчлэх
  useEffect(() => {
    if (inviteEmail) setForm(f => ({ ...f, email: inviteEmail }))
  }, [inviteEmail])

  const handleChange = (e) => {
    clearError?.()
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== confirmPassword) return
    try {
      // Backend: POST /api/auth/register
      // { first_name, last_name, phone, email, password }
      // Хариу: { message, phone }
      await register(form)
      setStep('otp')
    } catch (_) {}
  }

  // OTP шат — register амжилттай болсны дараа
  if (step === 'otp') {
    return (
      <div className="bg-white rounded-2xl px-10 py-12 w-full max-w-110">
        <OtpVerify
          phone={form.phone}
          email={form.email}
          redirectTo={redirectTo}
          onBack={() => setStep('register')}
        />
      </div>
    )
  }

  const passwordMismatch = confirmPassword.length > 0 && form.password !== confirmPassword

  return (
    <div className="bg-white rounded-2xl px-10 py-12 w-full max-w-110">
      <div className="mb-4 mt-2">
        <p className="text-sm text-gray-500 m-0">Бүртгүүлэх мэдэллээ бөглөнө үү</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">

        {/* Овог */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Овог</label>
          <Input
            type="text"
            name="last_name"
            value={form.last_name}
            onChange={handleChange}
            placeholder="Овог"
            required
            // className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] text-sm outline-none box-border bg-gray-50 text-gray-900"
          />
        </div>

        {/* Нэр */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Нэр</label>
          <input
            type="text"
            name="first_name"
            value={form.first_name}
            onChange={handleChange}
            placeholder="Нэр"
            required
            className="w-full px-3.5 py-3 border border-gray-200 rounded-[10px] text-sm outline-none box-border bg-gray-50 text-gray-900"
          />
        </div>

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

        {/* Имейл */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">И-мэйл хаяг</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="example@mail.com"
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
          {form.password.length > 0 && (
            <ul className="list-none mt-1 p-0 flex flex-col gap-0.75">
              {requirements.map(({ label, test }) => (
                <li
                  key={label}
                  className={`text-xs transition-colors ${test(form.password) ? 'text-green-500' : 'text-gray-400'}`}
                >
                  • {label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Нууц үг давтах */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Нууц үг давтах</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••"
              required
              className={`w-full px-3.5 py-3 pr-13 border rounded-[10px] text-sm outline-none box-border bg-gray-50 text-gray-900 ${passwordMismatch ? 'border-red-400' : 'border-gray-200'}`}
            />
            <Button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
            //   className="absolute right-3.5 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer text-base leading-none p-0"
            >
              {showConfirm ? '🙈' : '👁'}
            </Button>
          </div>
          {passwordMismatch && (
            <p className="text-red-400 text-xs mt-0.5 m-0">Нууц үг таарахгүй байна</p>
          )}
        </div>

        {/* Backend алдаа */}
        {authError && (
          <p className="text-red-400 text-[13px] m-0">{authError}</p>
        )}

        {/* Бүртгүүлэх товч */}
        <button
          type="submit"
          disabled={authLoading || passwordMismatch}
          className="w-full py-3.25 bg-[#3d3a8c] disabled:bg-gray-400 text-white border-0 rounded-[10px] text-[15px] font-medium cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          {authLoading ? 'Бүртгэж байна...' : 'Бүртгүүлэх'}
        </button>
      </form>

      <p className="text-center mt-6 text-sm text-gray-500">
        Бүртгэлтэй юу?{' '}
        <Link href="/login" className="text-[#3d3a8c] no-underline font-semibold">
          Нэвтрэх
        </Link>
      </p>
    </div>
  )
}