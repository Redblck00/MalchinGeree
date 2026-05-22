'use client'
import { useRouter } from 'next/navigation'
import {
  MdArrowBack, MdPictureAsPdf, MdDescription,
  MdPrint, MdEdit, MdStar, MdHistory, MdCancel,
} from 'react-icons/md'
import StatusBadge from './StatusBadge'

// ══════════════════════════════════════════════════════════════
// ContractHeader — Дэлгэрэнгүйн дээд header
//
//   ← Буцах | Гэрээнүүд > NUMBER | [Status] | date · автоматаар хадгалагдсан
//                                                  [PDF] [Word] [Хэвлэх] [Засах]
//
// Props:
//   contract        full contract object
//   onEdit          () => void (Edit товч даргад дуудна — DRAFT/SENT-d л идэвхтэй)
//   onPdf           () => Promise
//   onDocx          () => Promise
//   onPrint         () => void
//   downloadBusy    'pdf'|'docx'|'print'|null
//   canEdit         boolean
// ══════════════════════════════════════════════════════════════
export default function ContractHeader({
  contract,
  onEdit,
  onPdf,
  onDocx,
  onPrint,
  onRate,
  onHistory,
  onCancel,
  downloadBusy,
  canEdit = false,
  canRate = false,
  hasRated = false,
  canCancel = false,
}) {
  const router = useRouter()

  const updatedAt = contract.updated_at
    ? new Date(contract.updated_at)
    : null

  const dateLine = updatedAt
    ? `${updatedAt.getFullYear()}.${String(updatedAt.getMonth()+1).padStart(2,'0')}.${String(updatedAt.getDate()).padStart(2,'0')}`
    : ''
  const timeLine = updatedAt
    ? ` ${String(updatedAt.getHours()).padStart(2,'0')}:${String(updatedAt.getMinutes()).padStart(2,'0')}`
    : ''

  return (
    <header className="bg-white border-b border-gray-100 shrink-0 print:hidden">
      <div className="px-6 py-3 flex items-center gap-4 flex-wrap">
        {/* Зүүн тал — back + breadcrumb + status */}
        <button
          onClick={() => router.push('/dashboard/contracts')}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700
                     border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer bg-white"
        >
          <MdArrowBack size={16} /> Буцах
        </button>

        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => router.push('/dashboard/contracts')}
            className="text-gray-500 hover:text-gray-900 bg-transparent border-0
                       cursor-pointer p-0"
          >
            Гэрээнүүд
          </button>
          <span className="text-gray-300">›</span>
          <span className="font-semibold text-gray-900">
            {contract.contract_number}
          </span>
        </div>

        <StatusBadge status={contract.status} />

        {dateLine && (
          <div className="text-xs text-gray-500 hidden md:block">
            {dateLine} <span className="text-gray-400">· {timeLine}</span>
          </div>
        )}

        {/* Баруун тал — action товчнууд */}
        <div className="ml-auto flex items-center gap-2">
          <ActionButton
            icon={<MdPictureAsPdf size={16} />}
            label="PDF"
            onClick={onPdf}
            busy={downloadBusy === 'pdf'}
            disabled={downloadBusy !== null}
          />
          <ActionButton
            icon={<MdDescription size={16} />}
            label="Word"
            onClick={onDocx}
            busy={downloadBusy === 'docx'}
            disabled={downloadBusy !== null}
          />
          {/* <ActionButton
            icon={<MdPrint size={16} />}
            label="Хэвлэх"
            onClick={onPrint}
            busy={downloadBusy === 'print'}
            disabled={downloadBusy !== null}
          /> */}
          {onHistory && (
            <button
              onClick={onHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold
                         text-[#3d3a8c] border border-[#3d3a8c]/30 rounded-lg
                         hover:bg-[#3d3a8c]/5 cursor-pointer bg-white"
              title="Өөрчлөлтийн түүх / тайлбар"
            >
              <MdHistory size={16} /> Түүх
            </button>
          )}
          {canEdit && (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold
                         text-white bg-gray-900 rounded-lg hover:bg-gray-800
                         cursor-pointer border-0"
            >
              <MdEdit size={16} /> Засах
            </button>
          )}
          {canRate && (
            <button
              onClick={onRate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold
                         text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg
                         cursor-pointer border-0"
            >
              <MdStar size={16} /> {hasRated ? 'Үнэлгээ засах' : 'Үнэлэх'}
            </button>
          )}
          {canCancel && (
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold
                         text-red-600 border border-red-200 rounded-lg
                         hover:bg-red-50 cursor-pointer bg-white"
              title="Гэрээг цуцлах"
            >
              <MdCancel size={16} /> Цуцлах
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

function ActionButton({ icon, label, onClick, busy, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700
                 border border-gray-200 rounded-lg hover:bg-gray-50
                 cursor-pointer bg-white disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icon}
      <span>{busy ? '...' : label}</span>
    </button>
  )
}
