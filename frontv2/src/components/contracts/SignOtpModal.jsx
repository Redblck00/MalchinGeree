'use client'
import { useEffect, useRef, useState } from 'react'
import { MdMailOutline, MdRefresh, MdCheckCircle, MdLockOutline } from 'react-icons/md'

// ══════════════════════════════════════════════════════════════
// SignOtpModal — Гарын үсэг зурахын өмнө OTP баталгаажуулах
//
// AcceptModal-ийн дараа ачааллагдана. Backend нь хэрэглэгчийн нэвтэрсэн
// имэйл рүү 6 оронтой OTP илгээсэн (request-otp endpoint), энэ modal нь
// тэр кодыг оруулж баталгаажуулна.
//
// Props:
//   open           boolean
//   emailMasked    string | null   — "b***@gmail.com" (header-т харуулна)
//   onVerify       (code) => Promise — /sign endpoint руу otp_code хамт явуулна
//   onResend       () => Promise<boolean> — шинэ OTP хүсэлт; true = амжилт
//   onClose        () => void      — backdrop эсвэл "Цуцлах" дарвал
//   verifying      boolean         — /sign дуудалт явж байгаа эсэх
//   error          string | null   — backend-аас ирсэн алдаа
// ══════════════════════════════════════════════════════════════
const COOLDOWN_SEC = 60

export default function SignOtpModal({
  open,
  emailMasked = null,
  onVerify,
  onResend,
  onClose,
  verifying = false,
  error = null,
}) {
  const [code, setCode]           = useState('')
  const [cooldown, setCooldown]   = useState(COOLDOWN_SEC)
  const [resending, setResending] = useState(false)
  const inputRef = useRef(null)

  // Modal нээгдэх бүрд: код арчих, cooldown reset, input-д focus
  useEffect(() => {
    if (!open) return
    setCode('')
    setCooldown(COOLDOWN_SEC)
    // Дараагийн tick-д focus (modal mount хийгдэх хэрэгтэй)
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  // Cooldown timer — 1 сек тутамд буурна
  useEffect(() => {
    if (!open || cooldown <= 0) return
    const t = setInterval(() => setCooldown(c => (c > 0 ? c - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [open, cooldown])

  // Backend алдаа гарвал кодыг арчиж дахин focus авна
  useEffect(() => {
    if (error) {
      setCode('')
      inputRef.current?.focus()
    }
  }, [error])

  if (!open) return null

  // Зөвхөн 0-9 авна, max 6 тэмдэгт
  const handleChange = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(v)
    // Бүрэн оруулж дууссан үед автоматаар submit (UX shortcut)
    if (v.length === 6 && !verifying) {
      // Бичигдсэн state-ийг нь ашигла гэж setTimeout 0 хэрэглэнэ
      setTimeout(() => onVerify(v), 0)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (code.length === 6 && !verifying) onVerify(code)
  }

  const handleResend = async () => {
    if (cooldown > 0 || resending || verifying) return
    setResending(true)
    try {
      const ok = await onResend()
      if (ok) setCooldown(COOLDOWN_SEC)
    } finally {
      setResending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={verifying ? undefined : onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
            <MdLockOutline size={22} className="text-[#3d3a8c]" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 m-0">
              Баталгаажуулах код
            </h3>
            <p className="text-sm text-gray-500 mt-1 m-0 flex items-center gap-1.5">
              <MdMailOutline size={14} className="text-gray-400" />
              {emailMasked
                ? <>Имэйл руу <strong className="text-gray-700">{emailMasked}</strong> код илгээгдлээ</>
                : 'Имэйл руу код илгээгдлээ'}
            </p>
          </div>
        </div>

        {/* Тайлбар */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4">
          <p className="text-xs text-indigo-900 m-0 leading-relaxed">
            Гарын үсэг зурахын өмнө таны өөрийг чинь мөн эсэхийг баталгаажуулна.
            Имэйл хайрцагт ирсэн 6 оронтой кодыг доор оруулна уу.
            Код <strong>5 минут</strong> хүчинтэй.
          </p>
        </div>

        {/* OTP input */}
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={handleChange}
            disabled={verifying}
            placeholder="• • • • • •"
            className="w-full text-center font-mono text-2xl tracking-[0.5em]
                       py-3 px-4 border-2 border-gray-200 rounded-xl bg-white
                       focus:border-[#3d3a8c] focus:ring-2 focus:ring-[#3d3a8c]/10
                       outline-none transition-colors
                       disabled:bg-gray-50 disabled:text-gray-400"
          />

          {error && (
            <p className="text-xs text-red-600 mt-2 m-0">{error}</p>
          )}

          {/* Resend */}
          <div className="flex items-center justify-between mt-4">
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resending || verifying}
              className="inline-flex items-center gap-1.5 text-xs text-[#3d3a8c]
                         hover:underline cursor-pointer bg-transparent border-0 p-0
                         disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
            >
              <MdRefresh size={14} />
              {resending
                ? 'Илгээж байна...'
                : cooldown > 0
                  ? `Дахин илгээх (${cooldown}с)`
                  : 'Дахин илгээх'}
            </button>
            <span className="text-[11px] text-gray-400">
              5 минут хүчинтэй
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={verifying}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm
                         rounded-xl hover:bg-gray-50 cursor-pointer bg-white
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Цуцлах
            </button>
            <button
              type="submit"
              disabled={code.length !== 6 || verifying}
              className="flex-1 px-4 py-2.5 bg-[#3d3a8c] text-white text-sm font-semibold
                         rounded-xl hover:bg-[#2d2a6e] cursor-pointer border-0
                         disabled:opacity-50 disabled:cursor-not-allowed
                         inline-flex items-center justify-center gap-1.5"
            >
              <MdCheckCircle size={16} />
              {verifying ? 'Шалгаж байна...' : 'Баталгаажуулах'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
