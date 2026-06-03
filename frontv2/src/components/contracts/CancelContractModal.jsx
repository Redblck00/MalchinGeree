'use client'
import { useEffect, useState } from 'react'
import { MdWarning, MdCancel } from 'react-icons/md'

// ══════════════════════════════════════════════════════════════
// CancelContractModal — Гэрээг цуцлах баталгаажуулалт + шалтгаан
//
// Дүрэм:
//   • DRAFT эсвэл SENT статуст л идэвхтэй (parent шалгана)
//   • Аль ч талын оролцогч (CREATOR, COUNTERPARTY) дуудаж болно
//   • FULLY_SIGNED бол backend block хийнэ (parent шалгахгүй ч 400 буцна)
//
// Props:
//   open            boolean
//   contractTitle   string         — header-т харуулна
//   onConfirm       ({ reason }) => Promise
//   onClose         () => void
//   submitting      boolean        — cancel API дуудалт явж байгаа
// ══════════════════════════════════════════════════════════════
const MAX_REASON = 500

export default function CancelContractModal({
  open,
  contractTitle = '',
  onConfirm,
  onClose,
  submitting = false,
}) {
  const [reason, setReason] = useState('')

  // Modal нээгдэх бүрд reason арчина
  useEffect(() => {
    if (open) setReason('')
  }, [open])

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (submitting) return
    const trimmed = reason.trim().slice(0, MAX_REASON)
    onConfirm({ reason: trimmed || null })
  }

  const reasonLen = reason.length

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="bg-white max-w-md w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <MdWarning size={22} className="text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 m-0">
              Гэрээг цуцлах уу?
            </h3>
            {contractTitle && (
              <p className="text-sm text-gray-500 mt-1 m-0">
                "{contractTitle}"
              </p>
            )}
          </div>
        </div>

        {/* Анхааруулга */}
        <div className="bg-red-50 border border-red-200 p-3 mb-4">
          <p className="text-xs text-red-900 m-0 leading-relaxed">
            <strong>Анхаар:</strong> Цуцалсан гэрээг сэргээх боломжгүй.
            харилцагчид мэдэгдэнэ.
            Хэрэв харилцагчид  гарын үсэг зурсан бол цуцлах боломжгүй.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Optional reason */}
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Шалтгаан <span className="text-gray-400 font-normal">(заавал биш)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
            disabled={submitting}
            rows={3}
            placeholder="Жишээ нь: Тохиролцоо болсонгүй..."
            className="w-full px-3 py-2.5 border border-gray-200 text-sm bg-white
                       text-gray-900 outline-none resize-none
                       focus:border-[#3d3a8c] focus:ring-2 focus:ring-[#3d3a8c]/10
                       transition-colors
                       disabled:bg-gray-50 disabled:text-gray-500"
          />
          <div className="flex justify-end mt-1">
            <span className={`text-[11px] ${reasonLen >= MAX_REASON ? 'text-red-500' : 'text-gray-400'}`}>
              {reasonLen} / {MAX_REASON}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm
                         hover:bg-gray-50 cursor-pointer bg-white
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Үгүй, буцах
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold
                         hover:bg-red-700 cursor-pointer border-0
                         disabled:opacity-50 disabled:cursor-not-allowed
                         inline-flex items-center justify-center gap-1.5"
            >
              <MdCancel size={16} />
              {submitting ? 'Цуцалж байна...' : 'Тийм, цуцлах'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
