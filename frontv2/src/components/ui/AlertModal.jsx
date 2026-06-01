'use client'
import { useEffect } from 'react'
import { MdClose } from 'react-icons/md'

// ══════════════════════════════════════════════════════════════
// AlertModal — амжилттай үйлдлийн дараа гарч ирэх modal
//
// Props:
//   open       boolean — modal харагдах эсэх
//   message    string  — гарчиг текст
//   onClose    () => void — Thanks/X дарахад дуудна
//   buttonText string  — товчны бичиг (default "Баярлалаа")
//   icon       string  — өөр зураг ашиглах бол (default /alerts.png)
// ══════════════════════════════════════════════════════════════
export default function AlertModal({
  open,
  message,
  onClose,
  buttonText = 'Баярлалаа',
  icon = '/alerts.png',
}) {
  // ESC дарахад хаах
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center
                 bg-black/40 backdrop-blur-sm p-4 print:hidden"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white  shadow-xl
                   w-full max-w-md p-8 pt-12 text-center"
        style={{ animation: 'alertModalIn 0.2s ease-out' }}
      >
        {/* X close — баруун дээд */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Хаах"
          className="absolute top-4 right-4 w-8 h-8 rounded-full
                     inline-flex items-center justify-center text-gray-500
                     hover:bg-gray-100 cursor-pointer bg-transparent border-0"
        >
          <MdClose size={20} />
        </button>

        {/* Том icon — gradient тойрог + alerts.png */}
        <div
          className="mx-auto w-28 h-28 rounded-full flex items-center justify-center
                     shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #80B7FE 0%, #27DEC9 100%)',
          }}
        >
          <img
            src={icon}
            alt=""
            className="w-16 h-16 object-contain"
            draggable={false}
          />
        </div>

        {/* Гарчиг */}
        <h2 className="text-xl font-bold text-gray-900 mt-6 mb-6 m-0">
          {message}
        </h2>

        {/* Gradient товч */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-2xl text-white font-semibold text-base
                     cursor-pointer border-0 transition-transform
                     hover:scale-[1.02] active:scale-[0.99] bg-gradient-to-r from-[#d1d1db] to-[#50e0d4]"
         
        >
          {buttonText}
        </button>
      </div>
    </div>
  )
}
