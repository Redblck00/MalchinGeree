'use client'
import { useState, useEffect } from 'react'
import { MdSell, MdShoppingCart, MdHandshake, MdClose, MdArrowForward } from 'react-icons/md'

// Template сонгосны дараа гарч ирэх modal
// Хэрэглэгч худалдагч уу, худалдан авагч уу гэдгээ сонгоно
export default function RoleSelectModal({ template, onClose, onSelect }) {
  const [role, setRole] = useState('seller')

  // ESC дарж хаах
  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  if (!template) return null

  return (
    <div
      className="fixed inset-0 bg-emerald-950/50 backdrop-blur-sm z-50
                 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full max-w-lg shadow-2xl overflow-hidden
                    max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER with emerald accent ─────────────────── */}
        <div className="relative px-4 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5
                        bg-linear-to-br from-emerald-50 to-emerald-100/60
                        border-b border-emerald-100 overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-emerald-200/40 blur-2xl" />
          <div className="absolute -left-6 -bottom-10 w-24 h-24 rounded-full bg-emerald-300/30 blur-xl" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Header icon */}
              <div className="shrink-0 w-11 h-11
                              bg-linear-to-br from-emerald-500 to-emerald-700
                              text-white flex items-center justify-center
                              shadow-md shadow-emerald-200">
                <MdHandshake size={22} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-emerald-900 m-0 leading-tight">
                  Гэрээнд ямар талаас орох вэ?
                </h2>
                <p className="text-xs text-emerald-700/70 mt-1 m-0 truncate font-medium">
                  {template.name}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 flex items-center justify-center
                         text-emerald-700/60 hover:text-emerald-900 hover:bg-white/60
                         cursor-pointer bg-transparent border-0 transition-colors"
              aria-label="Хаах"
            >
              <MdClose size={20} />
            </button>
          </div>
        </div>

        {/* ── BODY — role options ───────────────────────── */}
        <div className="p-4 sm:p-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold m-0 mb-3">
            Үүргээ сонгоно уу
          </p>

          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            <RoleOption
              selected={role === 'seller'}
              onClick={() => setRole('seller')}
              icon={<MdSell size={28} />}
              title="Худалдагч"
              subtitle="Малаа зарж байна"
              accent="seller"
            />
            <RoleOption
              selected={role === 'buyer'}
              onClick={() => setRole('buyer')}
              icon={<MdShoppingCart size={28} />}
              title="Худалдан авагч"
              subtitle="Мал авч байна"
              accent="buyer"
            />
          </div>
        </div>

        {/* ── FOOTER ─────────────────────────────────────── */}
        <div className="flex gap-3 px-6 pb-6 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-sm font-medium text-gray-700
                       bg-white border border-gray-200
                       hover:bg-gray-50 hover:border-gray-300
                       cursor-pointer transition-colors"
          >
            Цуцлах
          </button>
          <button
            onClick={() => onSelect(role)}
            className="flex-1 inline-flex items-center justify-center gap-1.5
                       px-4 py-3 text-sm font-semibold text-white
                       bg-linear-to-br from-emerald-500 to-emerald-700
                       hover:from-emerald-600 hover:to-emerald-800
                       shadow-md shadow-emerald-200
                       cursor-pointer border-0 transition-all"
          >
            Үргэлжлүүлэх
            <MdArrowForward size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function RoleOption({ selected, onClick, icon, title, subtitle }) {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden p-4 sm:p-5 border-2
                  flex flex-col items-center gap-2 transition-all
                  cursor-pointer text-center
                  ${selected
                    ? 'border-emerald-500 bg-linear-to-br from-emerald-50 to-emerald-100/70 shadow-md shadow-emerald-100'
                    : 'border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30'}`}
    >
      {/* Selected check indicator */}
      {selected && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full
                         bg-emerald-600 text-white text-[10px] font-bold
                         flex items-center justify-center shadow-sm">
          ✓
        </span>
      )}

      {/* Icon */}
      <div className={`w-14 h-14 flex items-center justify-center transition-colors
                       ${selected
                         ? 'bg-linear-to-br from-emerald-500 to-emerald-700 text-white shadow-md shadow-emerald-200'
                         : 'bg-gray-100 text-gray-500'}`}>
        {icon}
      </div>

      {/* Title + subtitle */}
      <span className={`text-sm font-bold mt-1 ${selected ? 'text-emerald-800' : 'text-gray-800'}`}>
        {title}
      </span>
      <span className={`text-xs ${selected ? 'text-emerald-700/80' : 'text-gray-500'}`}>
        {subtitle}
      </span>
    </button>
  )
}
