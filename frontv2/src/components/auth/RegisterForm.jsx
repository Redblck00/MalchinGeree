"use client"
import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import useAuthStore from '@/app/store/authStore'
import OtpVerify from '@/components/auth/OtpVerify'
import Link from 'next/link'
import { FiEye, FiEyeOff } from 'react-icons/fi'

const requirements = [
  { label: '8+ тэмдэгт',     test: (p) => p.length >= 8 },
  { label: 'Том үсэг',       test: (p) => /[A-Z]/.test(p) },
  { label: 'Жижиг үсэг',     test: (p) => /[a-z]/.test(p) },
  { label: 'Тоо',            test: (p) => /[0-9]/.test(p) },
]

export default function RegisterForm() {
  const { register, authLoading, authError, clearError } = useAuthStore()
  const searchParams = useSearchParams()
  const redirectTo   = searchParams.get('redirect') || null
  const inviteEmail  = searchParams.get('email') || ''

  const [step, setStep] = useState('register')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [form, setForm] = useState({
    first_name: '',
    last_name:  '',
    phone:      '',
    email:      inviteEmail,
    password:   '',
  })

  useEffect(() => {
    if (inviteEmail) setForm(f => ({ ...f, email: inviteEmail }))
  }, [inviteEmail])

  const handleChange = (e) => {
    clearError?.()
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const metCount = useMemo(
    () => requirements.filter(r => r.test(form.password)).length,
    [form.password]
  )
  const allMet           = metCount === requirements.length
  const passwordMismatch = confirmPassword.length > 0 && form.password !== confirmPassword

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (passwordMismatch || !allMet) return
    try {
      await register(form)
      setStep('otp')
    } catch (_) {}
  }

  // ── OTP шат ───────────────────────────────────────────
  if (step === 'otp') {
    return (
      <div className="bg-gray-100 rounded-2xl px-10 py-12 w-full max-w-md">
        <OtpVerify
          phone={form.phone}
          email={form.email}
          redirectTo={redirectTo}
          onBack={() => setStep('register')}
        />
      </div>
    )
  }

  return (
    <div className="bg-gray-100 rounded-2xl px-10 py-10 w-full max-w-md">

      {/* ── Title ───────────────────────────────────────── */}
      <div className="text-center mb-7">
        <h1 className="text-3xl font-light tracking-[0.12em] uppercase text-gray-900 mb-2 m-0">
          Бүртгүүлэх
        </h1>
        <p className="text-sm text-gray-500 m-0">
          Цахим гэрээний платформд нэгдэх
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Овог + Нэр (2 багана) */}
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Овог"
            name="last_name"
            value={form.last_name}
            onChange={handleChange}
            placeholder="Овог"
            required
            autoComplete="family-name"
          />
          <Field
            label="Нэр"
            name="first_name"
            value={form.first_name}
            onChange={handleChange}
            placeholder="Нэр"
            required
            autoComplete="given-name"
          />
        </div>

        {/* Утас */}
        <Field
          label="Утас"
          name="phone"
          type="tel"
          value={form.phone}
          onChange={handleChange}
          placeholder="99112233"
          maxLength={8}
          required
          autoComplete="tel"
        />

        {/* Имейл */}
        <Field
          label="И-мэйл хаяг"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="example@mail.com"
          required
          autoComplete="email"
          disabled={!!inviteEmail}
        />

        {/* Нууц үг */}
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
              autoComplete="new-password"
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

          {/* Strength bar + requirements */}
          {form.password.length > 0 && (
            <div className="mt-1">
              <div className="flex gap-1 mb-1.5">
                {[0,1,2,3].map(i => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i < metCount
                        ? metCount <= 2 ? 'bg-amber-400'
                          : metCount === 3 ? 'bg-[#7166D9]'
                          : 'bg-[#3d3a8c]'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
                {requirements.map(({ label, test }) => {
                  const ok = test(form.password)
                  return (
                    <span key={label}
                      className={`text-[11px] transition-colors
                                  ${ok ? 'text-[#3d3a8c]' : 'text-gray-400'}`}>
                      {ok ? '✓' : '·'} {label}
                    </span>
                  )
                })}
              </div>
            </div>
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
              placeholder="**********"
              required
              autoComplete="new-password"
              className={`w-full px-4 py-3 pr-12 bg-white border rounded-full text-sm
                          text-gray-900 placeholder:text-gray-400 outline-none box-border
                          focus:border-gray-400 transition-colors
                          ${passwordMismatch ? 'border-red-400' : 'border-gray-200'}`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(s => !s)}
              tabIndex={-1}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-0
                         cursor-pointer leading-none p-0 text-gray-400 hover:text-gray-600
                         transition-colors inline-flex items-center justify-center"
              aria-label={showConfirm ? 'Нуух' : 'Харах'}
            >
              {showConfirm ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
          {passwordMismatch && (
            <p className="text-red-500 text-xs m-0">Нууц үг таарахгүй байна</p>
          )}
        </div>

        {/* Backend алдаа */}
        {authError && (
          <p className="text-red-500 text-xs m-0">{authError}</p>
        )}

        {/* Submit товч */}
        <button
          type="submit"
          disabled={authLoading || passwordMismatch || !allMet}
          className="w-full py-3 bg-[#3d3a8c] hover:bg-[#2d2a6e]
                     disabled:bg-gray-400 disabled:cursor-not-allowed
                     text-white border-0 rounded-full text-[15px] font-medium
                     cursor-pointer transition-colors mt-1"
        >
          {authLoading ? 'Бүртгэж байна...' : 'Бүртгүүлэх'}
        </button>
      </form>

      {/* Footer */}
      <p className="text-center mt-5 text-sm text-gray-500 m-0">
        Бүртгэлтэй юу?{' '}
        <Link href="/login" className="text-[#3d3a8c] no-underline font-semibold">
          Нэвтрэх
        </Link>
      </p>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// Field — login-той ижил pill input
// ══════════════════════════════════════════════════════
function Field({ label, disabled, ...props }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        {...props}
        disabled={disabled}
        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-full text-sm
                   text-gray-900 placeholder:text-gray-400 outline-none box-border
                   focus:border-gray-400 transition-colors
                   disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
      />
    </div>
  )
}
