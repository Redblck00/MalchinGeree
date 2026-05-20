"use client"
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useAuthStore  from '@/app/store/authStore'
import api from '@/lib/api'

export default function OtpVerify({ phone, email, redirectTo, onBack }) {
  const router = useRouter()
  const { verifyOtp, authLoading, authError, clearError } = useAuthStore()

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [timer, setTimer] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const inputRefs = useRef([])

  useEffect(() => {
    if (timer <= 0) { setCanResend(true); return }
    const interval = setInterval(() => setTimer((p) => p - 1), 1000)
    return () => clearInterval(interval)
  }, [timer])

  useEffect(() => { inputRefs.current[0]?.focus() }, [])

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    clearError?.()
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
    if (newOtp.every((d) => d !== '') && index === 5 && !authLoading) handleVerify(newOtp.join(''))
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const newOtp = [...otp]
    pasted.split('').forEach((char, i) => { if (i < 6) newOtp[i] = char })
    setOtp(newOtp)
    inputRefs.current[Math.min(pasted.length, 5)]?.focus()
    if (pasted.length === 6) handleVerify(pasted)
  }

  // Backend: POST /api/auth/verify-otp { phone, code }
  const handleVerify = async (otpCode) => {
    const code = otpCode || otp.join('')
    if (code.length < 6) return
    try {
      await verifyOtp(phone, code)
      router.push(redirectTo || '/dashboard')
    } catch (_) {
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    }
  }

  // Backend: POST /api/auth/resend-otp { phone }
  const handleResend = async () => {
    try {
      await api.post('/auth/resend-otp', { phone })
    } catch (_) {}
    setTimer(60)
    setCanResend(false)
    setOtp(['', '', '', '', '', ''])
    clearError?.()
    inputRefs.current[0]?.focus()
  }

  const isComplete = otp.every((d) => d !== '')

  const boxClass = (digit) => {
    const base = 'w-11 h-13 text-center text-xl font-medium border-2 rounded-[10px] outline-none transition-colors bg-gray-50 text-gray-900'
    if (authError) return `${base} border-red-400 bg-red-50`
    if (digit) return `${base} border-[#3d3a8c] bg-[#3d3a8c]/5`
    return `${base} border-gray-200`
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Title */}
      <div className="text-center w-full">
        <h1 className="text-3xl font-light tracking-[0.12em] uppercase text-gray-900 mb-2.5 m-0">
          Баталгаажуулах
        </h1>
        <p className="text-sm text-gray-500 m-0">
          <span className="font-semibold text-gray-700">{phone}</span> дугаартай имейл рүү илгээсэн{' '}
          6 оронтой кодыг оруулна уу
        </p>
      </div>

      {/* OTP boxes */}
      <div className="flex gap-3 mt-2">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={boxClass(digit)}
          />
        ))}
      </div>

      {/* Error */}
      {authError && (
        <p className="text-red-400 text-sm text-center m-0">{authError}</p>
      )}

      {/* Timer */}
      <p className="text-sm text-gray-500 m-0 text-center">
        {canResend ? (
          'Код ирээгүй юу?'
        ) : (
          <><span className="font-medium text-gray-700">{timer}с</span> дараа дахин илгээх боломжтой</>
        )}
      </p>

      {/* Verify button */}
      <button
        onClick={() => handleVerify()}
        disabled={!isComplete || authLoading}
        className="w-full py-3.25 bg-[#3d3a8c] disabled:bg-gray-400 text-white border-0 rounded-[10px] text-[15px] font-medium cursor-pointer disabled:cursor-not-allowed transition-colors"
      >
        {authLoading ? 'Шалгаж байна...' : 'Баталгаажуулах'}
      </button>

      {/* Resend */}
      {canResend && (
        <button
          onClick={handleResend}
          className="bg-transparent border-0 text-[#3d3a8c] text-sm cursor-pointer underline p-0"
        >
          Код дахин илгээх
        </button>
      )}

      {/* Back */}
      {onBack && (
        <button
          onClick={onBack}
          className="bg-transparent border-0 text-gray-500 text-sm cursor-pointer p-0 flex items-center gap-1 hover:text-gray-700 transition-colors"
        >
          ← Буцах
        </button>
      )}
    </div>
  )
}