'use client'
import { useRouter } from 'next/navigation'
import {
  MdArrowBack, MdPictureAsPdf, MdDescription,
  MdEdit, MdStar, MdHistory, MdCancel,
} from 'react-icons/md'
import StatusBadge from './StatusBadge'

// ══════════════════════════════════════════════════════════════
// ContractHeader — 2 эгнээтэй layout
//
// Row 1: ← Буцах | Гэрээнүүд › NUMBER | [Status]            YYYY.MM.DD
// Row 2: [PDF] [Word] [Түүх]              [Өөрчлөх] [Үнэлэх] [Цуцлах]
//
// • Row 2-н зүүн талд document export action-ууд, баруун талд
//   contract-state action-ууд. Идэвхгүй (inapplicable) action товч
//   автоматаар нуугдана (disabled state биш — render хийгдэхгүй).
// • Бүгд hide бол row 2 бүхэлдээ render-гүй.
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
    ? `${updatedAt.getFullYear()}.${String(updatedAt.getMonth() + 1).padStart(2, '0')}.${String(updatedAt.getDate()).padStart(2, '0')}`
    : ''
  const timeLine = updatedAt
    ? `${String(updatedAt.getHours()).padStart(2, '0')}:${String(updatedAt.getMinutes()).padStart(2, '0')}`
    : ''

  // Action availability — товч render хийгдэх эсэх
  const hasLeftActions  = !!onPdf || !!onDocx || !!onHistory
  const hasRightActions = canEdit || canRate || canCancel
  const showActionBar   = hasLeftActions || hasRightActions

  return (
    <header className="bg-white border-b border-gray-100 shrink-0 print:hidden">
      {/* ── Row 1: navigation + identity ─────────────────── */}
      <div className="px-6 py-3 flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/contracts')}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700
                     border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer bg-white"
        >
          <MdArrowBack size={16} /> Гэрээнүүд
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="font-semibold text-gray-900 truncate">
            {contract.contract_number}
          </span>
        </div>

        <StatusBadge status={contract.status} />

        {dateLine && (
          <div className="ml-auto text-xs text-gray-500 hidden md:block">
            {dateLine} <span className="text-gray-400">· {timeLine}</span>
          </div>
        )}
      </div>

      {/* ── Row 2: action bar (responsive) ────────────────
          Desktop (sm+): icon + label
          Mobile (<sm):  icon-only (label-уудыг title/aria-label-аар хадгална)
          flex-wrap нь wide overflow тохиолдолд автоматаар 2 мөр болгоно.
          Right group ml-auto-той тул нэг мөрөнд барууну тал руу шахагдана. */}
      {showActionBar && (
        <div className="px-4 sm:px-6 py-2 border-t border-gray-50">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Зүүн талын бүлэг — utility action-ууд */}
            {onPdf && (
              <ActionButton
                icon={<MdPictureAsPdf size={16} />}
                label="PDF"
                onClick={onPdf}
                busy={downloadBusy === 'pdf'}
                disabled={downloadBusy !== null}
              />
            )}
            {onDocx && (
              <ActionButton
                icon={<MdDescription size={16} />}
                label="Word"
                onClick={onDocx}
                busy={downloadBusy === 'docx'}
                disabled={downloadBusy !== null}
              />
            )}
            {onHistory && (
              <IconLabelButton
                onClick={onHistory}
                icon={<MdHistory size={16} />}
                label="Түүх"
                title="Өөрчлөлтийн түүх / тайлбар"
                variant="indigo"
              />
            )}

            {/* Баруун талын бүлэг — contract-state action-ууд.
                ml-auto эхний flex item-ийн дараа байгаа тул баруун талд шахагдана.
                Wrap болсон үед ч баруун-align-тай үлдэнэ. */}
            {hasRightActions && (
              <div className="ml-auto flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {canEdit && (
                  <IconLabelButton
                    onClick={onEdit}
                    icon={<MdEdit size={16} />}
                    label="Өөрчлөх"
                    title="Өөрчлөх"
                    variant="primary"
                  />
                )}
                {canRate && (
                  <IconLabelButton
                    onClick={onRate}
                    icon={<MdStar size={16} />}
                    label={hasRated ? 'Үнэлгээ засах' : 'Үнэлэх'}
                    title={hasRated ? 'Үнэлгээ засах' : 'Үнэлэх'}
                    variant="warning"
                  />
                )}
                {canCancel && (
                  <IconLabelButton
                    onClick={onCancel}
                    icon={<MdCancel size={16} />}
                    label="Цуцлах"
                    title="Гэрээг цуцлах"
                    variant="danger"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

// ── Action button: PDF/Word — busy төлөвт "..." text-аар солигдоно ──
function ActionButton({ icon, label, onClick, busy, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm text-gray-700
                 border border-gray-200 rounded-lg hover:bg-gray-50
                 cursor-pointer bg-white disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {busy ? (
        <span className="text-xs font-bold w-4 text-center">...</span>
      ) : (
        <>
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </>
      )}
    </button>
  )
}

// ── Icon + label button (responsive label hide). Variant-аар theme солино ──
function IconLabelButton({ icon, label, onClick, title, variant = 'default' }) {
  const variants = {
    default: 'text-gray-700 border border-gray-200 bg-white hover:bg-gray-50',
    indigo:  'text-[#3d3a8c] border border-[#3d3a8c]/30 bg-white hover:bg-[#3d3a8c]/5 font-semibold',
    primary: 'text-white bg-gray-900 hover:bg-gray-800 border-0 font-semibold',
    warning: 'text-white bg-yellow-500 hover:bg-yellow-600 border-0 font-semibold',
    danger:  'text-red-600 border border-red-200 bg-white hover:bg-red-50 font-semibold',
  }
  return (
    <button
      onClick={onClick}
      title={title || label}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm rounded-lg
                  cursor-pointer transition-colors ${variants[variant]}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
