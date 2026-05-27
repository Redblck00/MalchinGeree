'use client'
import { useState, useEffect } from 'react'
import { MdClose, MdWarning } from 'react-icons/md'

// ══════════════════════════════════════════════════════
// CloseContractModal — Гэрээг хаахаас өмнө баталгаажуулах
// Props:
//   open, onClose, onConfirm({ reason }), submitting
// ══════════════════════════════════════════════════════
export default function CloseContractModal({ open, onClose, onConfirm, submitting }) {
  const [reason, setReason] = useState('')

  useEffect(() => { if (open) setReason('') }, [open])

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    onConfirm({ reason: reason.trim() || null })
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600
                            flex items-center justify-center">
              <MdWarning size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 m-0">Гэрээг хаах уу?</h2>
              <p className="text-xs text-gray-500 m-0 mt-0.5">
                Гэрээ хаагдсаны дараа сэргээх боломжгүй
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 cursor-pointer
                       bg-transparent border-0"
            aria-label="Хаах"
          >
            <MdClose size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600 m-0 mb-4">
            Гэрээг хаасны дараа хоёр тал бие биенээ үнэлэх боломжтой болно.
          </p>

          <label className="text-xs font-medium text-gray-700 mb-1.5 block">
            Хаах шалтгаан <span className="text-green-800 font-normal">(заавал биш)</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Жишээ нь: Хэлцэл амжилттай дууссан"
            className="w-full px-3 py-2.5 border text-green-800 border-gray-200 rounded-xl text-sm
                       outline-none focus:border-[#3d3a8c] bg-white resize-none"
          />
          <p className="text-[11px] text-black text-right mt-1 m-0">
            {reason.length}/300
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 text-sm text-gray-600 border border-gray-200
                       rounded-xl hover:bg-gray-50 cursor-pointer bg-white
                       disabled:opacity-50"
          >
            Цуцлах
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-amber-600
                       rounded-xl hover:bg-amber-700 cursor-pointer border-0
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Хааж байна...' : 'Тийм, хаах'}
          </button>
        </div>
      </form>
    </div>
  )
}
