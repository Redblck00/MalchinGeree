'use client'
import { MdWarning, MdCheckCircle } from 'react-icons/md'

// ══════════════════════════════════════════════════════════════
// AcceptModal — Гарын үсэг зурахын өмнө баталгаажуулах modal
// "Та гарын үсэг зурахдаа итгэлтэй байна уу?"
//
// Props:
//   open        boolean
//   onConfirm   () => void   — "Тийм" дарвал
//   onCancel    () => void   — "Үгүй" эсвэл backdrop дарвал
//   confirming  boolean      — sign үйлдэл явж байгаа эсэх
//   contractTitle string     — гэрээний нэр (header-т харуулна)
// ══════════════════════════════════════════════════════════════
export default function AcceptModal({
  open,
  onConfirm,
  onCancel,
  confirming = false,
  contractTitle = '',
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <MdWarning size={22} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 m-0">
              Гарын үсэг зурахдаа итгэлтэй байна уу?
            </h3>
            {contractTitle && (
              <p className="text-sm text-gray-500 mt-1 m-0">
                "{contractTitle}"
              </p>
            )}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
          <p className="text-xs text-amber-900 m-0 leading-relaxed">
            <strong>Анхаар:</strong> Гарын үсэг зурсны дараа гэрээ
            <strong> цаашид өөрчлөгдөх боломжгүй </strong>
            болж байнга хадгалагдана.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={confirming}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm
                       rounded-xl hover:bg-gray-50 cursor-pointer bg-white
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Үгүй, буцах
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="flex-1 px-4 py-2.5 bg-[#3d3a8c] text-white text-sm font-semibold
                       rounded-xl hover:bg-[#2d2a6e] cursor-pointer border-0
                       disabled:opacity-50 disabled:cursor-not-allowed
                       inline-flex items-center justify-center gap-1.5"
          >
            <MdCheckCircle size={16} />
            {confirming ? 'Зурж байна...' : 'Тийм, зурах'}
          </button>
        </div>
      </div>
    </div>
  )
}
