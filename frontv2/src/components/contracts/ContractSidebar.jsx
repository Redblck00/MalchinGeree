'use client'
import { useState, useEffect, useRef } from 'react'
import SignatureModal from '@/components/signature/SignatureModal'
import AcceptModal from '@/components/contracts/AcceptModal'
import AddParticipantModal from '@/components/contracts/AddParticipantModal'
import ChangeLog from '@/components/contracts/ChangeLog'
import {
  MdCheckCircle, MdSend, MdEdit, MdAttachFile,
  MdPersonOutline, MdPhone, MdMail, MdRemoveRedEye,
  MdChatBubbleOutline, MdAdd, MdInsertDriveFile,
  MdNotificationsActive, MdExpandMore, MdExpandLess,
  MdVerified, MdHourglassEmpty, MdCloudUpload,
  MdBlock, MdSchedule, MdCancel, MdVerifiedUser,
  MdClose, MdStar, MdStarBorder, MdHistory, MdNote,
  MdInfoOutline,
} from 'react-icons/md'

// ── Backend дээрх uploads/profiles/xxx.jpg-г бүрэн URL болгох ──
function resolveProfileImg(url) {
  if (!url) return null
  if (url.startsWith('http')) return url
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '')
  return `${base}/${url}`
}

function MiniRating({ avg = 0, count = 0 }) {
  if (!count) {
    return <span className="text-[10px] text-gray-400 italic">Үнэлгээгүй</span>
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-600">
      <MdStar size={11} className="text-amber-400" />
      <span className="font-semibold">{Number(avg).toFixed(1)}</span>
      <span className="text-gray-400">· {count}</span>
    </span>
  )
}
// ── Том star row (детайл хэсэгт) ──
function StarRow({ avg = 0, count = 0 }) {
  const rounded = Math.round(avg)
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) =>
          i < rounded
            ? <MdStar key={i} size={14} className="text-amber-300" />
            : <MdStarBorder key={i} size={14} className="text-gray-300" />
        )}
      </div>
      <span className="text-xs text-gray-600">
        {count > 0
          ? <>{Number(avg).toFixed(1)} <span className="text-gray-400">({count} үнэлгээ)</span></>
          : <span className="text-gray-400">Үнэлгээгүй</span>}
      </span>
    </div>
  )
}
const ROLE_LABEL = {
  CREATOR:      'Үүсгэгч',
  COUNTERPARTY: 'Гэрээнд оролцогч',
  WITNESS:      'Гэрч',
}

// Гэрээний creator_role-аас seller/buyer (харагдах role label)
function getRoleLabel(participant, creatorRole) {
  if (participant.role === 'CREATOR') {
    return creatorRole === 'seller' ? 'Худалдагч' : 'Худалдан авагч'
  }
  if (participant.role === 'COUNTERPARTY') {
    return creatorRole === 'seller' ? 'Худалдан авагч' : 'Худалдагч'
  }
  return ROLE_LABEL[participant.role] || participant.role
}

function initials(p) {
  if (p.first_name) {
    return (p.last_name?.[0] || '') + (p.first_name?.[0] || '')
  }
  if (p.invite_email) return p.invite_email[0].toUpperCase()
  return '?'
}

function displayName(p) {
  if (p.first_name) {
    return `${p.last_name?.[0] || ''}. ${p.first_name}`.trim()
  }
  return p.invite_email || p.invite_phone || '—'
}

// ──────────────────────────────────────────────────────────────
// Talууд (Participants) — expandable cards
// ──────────────────────────────────────────────────────────────
function ParticipantCard({ p, creatorRole, isMe }) {
  const [expanded, setExpanded] = useState(false)
  const roleLabel = getRoleLabel(p, creatorRole)
  const isSigned  = p.status === 'SIGNED'
  const imgSrc    = resolveProfileImg(p.profile_image_url)

  // Avatar fallback өнгө: role-аас хамаарна (seller=ногоон, buyer=улбар шар)
  const avatarBg = (p.role === 'CREATOR')
    ? (creatorRole === 'seller' ? 'bg-emerald-500' : 'bg-orange-500')
    : (creatorRole === 'seller' ? 'bg-orange-500'  : 'bg-emerald-500')

  return (
    <div className="border border-[#ece8df] rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 cursor-pointer bg-white border-0
                   hover:bg-gray-50 text-left"
      >
        {/* Avatar — зураг байвал зургаар, үгүй бол initials */}
        <div className="shrink-0 w-10 h-10 rounded-full overflow-hidden
                        border border-gray-100 bg-gray-100 relative">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={displayName(p)}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <div className={`absolute inset-0 ${avatarBg} text-white
                             flex items-center justify-center text-sm font-bold uppercase`}>
              {initials(p)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 m-0 inline-flex items-center gap-1">
            {displayName(p)}
            {isSigned && <MdCheckCircle size={14} className="text-emerald-500" />}
            {isMe && <span className="text-xs text-gray-400 font-normal ml-1">(Та)</span>}
          </p>
          <p className="text-[11px] text-gray-500 m-0 mt-0.5">
            {roleLabel} {p.phone && <span>· {p.phone}</span>}
          </p>
          <div className="mt-1">
            <MiniRating avg={p.rating_avg} count={p.rating_count} />
          </div>
        </div>

        {expanded
          ? <MdExpandLess size={18} className="text-gray-400" />
          : <MdExpandMore size={18} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-3 flex flex-col gap-2">
          {/* Үнэлгээ — bigger star row */}
          <div className="flex items-center justify-between gap-2
                          bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span className="text-[11px] text-amber-900 font-semibold uppercase tracking-wide">
              Үнэлгээ
            </span>
            <StarRow avg={p.rating_avg} count={p.rating_count} />
          </div>

          <DetailRow icon={<MdPersonOutline size={14} />} label="Овог нэр" value={displayName(p)} />
          {p.phone && <DetailRow icon={<MdPhone size={14} />} label="Утас" value={p.phone} />}
          {(p.email || p.invite_email) &&
            <DetailRow icon={<MdMail size={14} />} label="Имэйл"
                       value={p.email || p.invite_email} optional />}
          <div className="flex gap-2 mt-1">
            <SmallButton icon={<MdRemoveRedEye size={13} />}>Профайл</SmallButton>
            <SmallButton icon={<MdChatBubbleOutline size={13} />}>Мессеж</SmallButton>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ icon, label, value, optional }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500">{label}</span>
        {optional && <span className="text-gray-400 uppercase text-[10px]">сонголтот</span>}
      </div>
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg
                      text-sm text-gray-800">
        <span className="text-gray-400">{icon}</span>
        <span className="truncate">{value}</span>
      </div>
    </div>
  )
}

function SmallButton({ icon, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 inline-flex items-center justify-center gap-1.5
                 px-3 py-1.5 text-xs text-gray-700 border border-[#ece8df]
                 rounded-lg hover:bg-gray-50 cursor-pointer bg-white"
    >
      {icon} {children}
    </button>
  )
}

function ParticipantsTab({ contract, currentUserId, onAddClick }) {
  const participants = contract.participants || []
  const creatorRole  = contract.creator_role || 'seller'

  return (
    <div className="flex flex-col gap-3">
      {participants.map(p => (
        <ParticipantCard
          key={p.participant_id}
          p={p}
          creatorRole={creatorRole}
          isMe={p.user_id === currentUserId}
        />
      ))}

      {contract.status === 'DRAFT' && onAddClick && (
        <button
          onClick={onAddClick}
          className="border-2 border-dashed border-[#ece8df] rounded-xl py-3 text-sm
                     text-[#3d3a8c] hover:border-[#3d3a8c] hover:bg-[#3d3a8c]/5
                     cursor-pointer bg-white inline-flex items-center justify-center gap-1.5"
        >
          <MdAdd size={16} /> Талыг нэмэх
        </button>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Хавсралт (Attachments) — Cloudinary upload, lock-той
// ──────────────────────────────────────────────────────────────
function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/1024/1024).toFixed(1)} MB`
}

function AttachmentsTab({
  contract, currentUserId, onUpload, onDelete, uploading, locked,
}) {
  const fileRef = useRef(null)
  const list    = contract.attachments || []

  const handlePick = () => {
    if (uploading || locked) return
    fileRef.current?.click()
  }
  const handleChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    onUpload(file)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
          <MdInsertDriveFile size={18} className="text-gray-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900 m-0">Нэмэлт материал</p>
          <p className="text-[10px] text-gray-400 m-0">Гэрээний сүүл хэсэгт нэмэгдэнэ</p>
        </div>
        <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
          {list.length} файл
        </span>
      </div>

      {/* Уже орсон файлууд */}
      {list.length > 0 && (
        <div className="flex flex-col gap-2">
          {list.map(a => {
            const isImage = a.file_type?.startsWith('image/')
            const isOwner = a.uploaded_by === currentUserId
            return (
              <div key={a.attachment_id}
                   className="flex items-center gap-2 p-2 border border-[#ece8df] rounded-lg bg-white">
                {/* Thumb / icon */}
                <div className="shrink-0 w-10 h-10 rounded bg-gray-50 border border-gray-100
                                flex items-center justify-center overflow-hidden">
                  {isImage ? (
                    <img src={a.file_url} alt={a.file_name}
                         className="w-full h-full object-cover" />
                  ) : (
                    <MdInsertDriveFile size={18} className="text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 m-0 truncate">
                    {a.file_name}
                  </p>
                  <p className="text-[10px] text-gray-400 m-0">
                    {formatFileSize(a.file_size)} · {new Date(a.created_at).toLocaleDateString('mn-MN')}
                  </p>
                </div>
                <a href={a.file_url} target="_blank" rel="noopener"
                   className="shrink-0 px-1.5 py-1 text-gray-500 hover:text-gray-700
                              hover:bg-gray-50 rounded cursor-pointer"
                   title="Шинэ tab-д нээх">
                  <MdRemoveRedEye size={14} />
                </a>
                {isOwner && !locked && (
                  <button onClick={() => onDelete(a.attachment_id)}
                          className="shrink-0 px-1.5 py-1 text-red-500 hover:bg-red-50
                                     rounded cursor-pointer bg-transparent border-0"
                          title="Устгах">
                    <MdClose size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Upload zone */}
      {locked ? (
        <div className="border-2 border-dashed border-[#ece8df] rounded-xl py-4
                        flex flex-col items-center gap-1 text-center bg-gray-50">
          <p className="text-xs text-gray-500 m-0">
             Гарын үсэг зурагдсан учир хавсралт нэмэх боломжгүй
          </p>
        </div>
      ) : (
        <button
          onClick={handlePick}
          disabled={uploading}
          className="border-2 border-dashed border-[#ece8df] rounded-xl py-5
                     flex flex-col items-center gap-1.5 text-center cursor-pointer
                     hover:border-[#3d3a8c] hover:bg-[#3d3a8c]/5 transition-colors
                     bg-white disabled:opacity-50"
        >
          <MdCloudUpload size={24} className="text-gray-400" />
          <p className="text-xs text-[#3d3a8c] font-semibold m-0">
            {uploading ? 'Хуулагдаж байна...' : 'Файл оруулах'}
          </p>
          <p className="text-[10px] text-gray-400 m-0">
            PDF, JPG, PNG · 10 MB хүртэл
          </p>
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,.doc,.docx"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
// Гарын үсэг (Signatures) — signed (green) / waiting (amber) cards
//   • Бусад талыг: зөвхөн харах (info card)
//   • Өөрийн талыг (myTurn + canSign үед): дарж өргөтгөж гарын үсэг зурна
//     ↓ дарж → expand → signature preview → click → AcceptModal → sign

function SignatureCard({
  p, creatorRole, isCurrentUser, canInteract, savedSignature, onSignClick,
}) {
  const [expanded, setExpanded] = useState(false)
  const isSigned  = p.status === 'SIGNED'
  const roleLabel = getRoleLabel(p, creatorRole)

  // ── НОГООН — зурсан ──
  if (isSigned) {
    return (
      <div className="rounded-xl p-3 border bg-emerald-50 border-emerald-200
                      flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-emerald-100
                        flex items-center justify-center">
          <MdVerified size={18} className="text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 m-0">
              {roleLabel} · {displayName(p)}
            </p>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5
                             bg-emerald-200 text-emerald-800 rounded-full
                             text-[10px] font-bold uppercase tracking-wide">
              <MdCheckCircle size={10} /> Зурсан
            </span>
          </div>
          {p.signed_at && (
            <p className="text-[11px] text-emerald-700 m-0 mt-1">
              {formatDateTime(p.signed_at)}  Баталгаажсан
            </p>
          )}
        </div>
        <button
          className="shrink-0 px-2.5 py-1 text-emerald-700 border border-emerald-200
                     rounded-lg hover:bg-emerald-100 cursor-pointer bg-white
                     inline-flex items-center"
          title="Гарын үсэг харах"
        >
          <MdRemoveRedEye size={14} />
        </button>
      </div>
    )
  }

  // ── ШАР — зураагүй ──
  // Зөвхөн өөрийн карт дээр + миний ээлж үед л дарж өргөтгөнө
  const isExpandable = isCurrentUser && canInteract

  return (
    <div className="rounded-xl border bg-amber-50 border-amber-200 overflow-hidden">
      <button
        onClick={isExpandable ? () => setExpanded(!expanded) : undefined}
        disabled={!isExpandable}
        className={`w-full p-3 flex items-start gap-3 bg-transparent border-0 text-left
                    ${isExpandable
                      ? 'cursor-pointer hover:bg-amber-100'
                      : 'cursor-default'}`}
      >
        <div className="shrink-0 w-9 h-9 rounded-lg bg-amber-100
                        flex items-center justify-center">
          <MdHourglassEmpty size={18} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 m-0">
              {roleLabel} · {displayName(p)}
            </p>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5
                             bg-amber-200 text-amber-800 rounded-full
                             text-[10px] font-bold uppercase tracking-wide">
              <MdHourglassEmpty size={10} /> Хүлээгдэж байна
            </span>
          </div>
          <p className="text-[11px] text-amber-700 m-0 mt-1">
            {isExpandable
              ? (expanded
                  ? 'Гарын үсгээ дарж баталгаажуулна уу'
                  : 'Гарын үсэг зурахын тулд энд дарна уу')
              : 'Гарын үсэг зураагүй байна'}
          </p>
        </div>
        {isExpandable && (
          expanded
            ? <MdExpandLess size={18} className="text-amber-600 shrink-0" />
            : <MdExpandMore size={18} className="text-amber-600 shrink-0" />
        )}
      </button>

      {/* ── Өргөтгөсөн: гарын үсгийн preview эсвэл "зурах" placeholder ── */}
      {isExpandable && expanded && (
        <div className="px-3 pb-3 border-t border-amber-200 pt-3 flex flex-col gap-2">
          {savedSignature ? (
            <button
              onClick={onSignClick}
              className="w-full bg-white rounded-sm p-3 flex items-center justify-center
                         min-h-20 cursor-pointer border-2 border-amber-300
                         hover:border-amber-500 hover:shadow-md transition-all"
              title="Гарын үсэг дээр дарж баталгаажуулна уу"
            >
              <img
                src={savedSignature.signature_blob}
                alt="Таны гарын үсэг"
                className="max-h-16 max-w-full object-contain"
              />
            </button>
          ) : (
            <button
              onClick={onSignClick}
              className="w-full p-4 text-sm font-semibold text-amber-700
                         border-2 border-dashed border-amber-300 rounded-lg
                         hover:bg-amber-100 cursor-pointer bg-white
                         inline-flex items-center justify-center gap-2"
            >
              <MdEdit size={16} /> Гарын үсэг зурах
            </button>
          )}
          <p className="text-[10px] text-amber-700 text-center m-0">
            Гарын үсэг дээр дарж баталгаажуулна уу
          </p>
        </div>
      )}
    </div>
  )
}

function SignaturesTab({
  contract, currentUserId, canSign, savedSignature, onSignClick,
}) {
  const participants = contract.participants || []
  const creatorRole  = contract.creator_role || 'seller'

  return (
    <div className="flex flex-col gap-3">
      {participants.map(p => (
        <SignatureCard
          key={p.participant_id}
          p={p}
          creatorRole={creatorRole}
          isCurrentUser={p.user_id === currentUserId}
          canInteract={canSign}
          savedSignature={savedSignature}
          onSignClick={onSignClick}
        />
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// History (өөрчлөлтийн түүх + comment box)
//   • ChangeLog: бүх оролцогчид харагдана
//   • Comment box: зөвхөн SENT + myTurn үед — өөрчлөлтгүй ч comment-ийг
//     /return-ээр илгээх боломжтой (backend note-only log дэмждэг)
// ──────────────────────────────────────────────────────────────
function HistoryTab({
  contract, currentUserId, myTurn,
  refreshLogKey, quickNote, setQuickNote,
  onSendComment, sending,
}) {
  const canComment = contract.status === 'SENT' && myTurn
  return (
    <div className="flex flex-col gap-4 h-full">
      {canComment && (
        <div className="flex flex-col gap-1.5 shrink-0">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500
                            inline-flex items-center gap-1">
            <MdNote size={12} /> Тайлбар нэмэх
          </label>
          <textarea
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value.slice(0, 1000))}
            rows={3}
            placeholder="Жишээ: Нэгж үнийг 480к → 500к болгож тохиров уу..."
            className="w-full px-3 py-2 text-sm border border-[#ece8df] rounded-lg
                       outline-none focus:border-[#3d3a8c] focus:ring-1 focus:ring-[#3d3a8c]/30
                       bg-white resize-none"
          />
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span className="inline-flex items-center gap-1">
              <MdInfoOutline size={11} />
              харилцагч email , мэдэгдэл харна
            </span>
            <span>{quickNote.length}/1000</span>
          </div>
          <button
            type="button"
            onClick={onSendComment}
            disabled={!quickNote.trim() || sending}
            className="mt-1 w-full inline-flex items-center justify-center gap-1.5
                       px-3 py-2 text-xs font-semibold text-white
                       bg-[#3d3a8c] hover:bg-[#2d2a6e] rounded-lg cursor-pointer border-0
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MdSend size={12} /> {sending ? 'Илгээж байна...' : 'Тайлбар илгээх'}
          </button>
        </div>
      )}

      {!canComment && contract.status === 'SENT' && (
        <p className="text-[11px] text-gray-500 bg-gray-50 border border-[#ece8df]
                      rounded-lg px-3 py-2 m-0 inline-flex items-start gap-1.5">
          <MdInfoOutline size={12} className="shrink-0 mt-0.5" />
          Харилцагч мэдээллийг шалгах тул  хүлээнэ үү.
        </p>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        <ChangeLog
          contractId={contract.contract_id}
          currentUserId={currentUserId}
          refreshKey={refreshLogKey}
        />
      </div>
    </div>
  )
}

function formatDateTime(iso) {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  } catch { return iso }
}
// Bottom action — статус + ээлжээс хамаарч өөрчлөгдөнө
// BottomAction — Доод үндсэн товч
// Логик:
//   DRAFT + creator         → "Тал нэмж илгээх" товч → AddParticipantModal нээгдэнэ
//   SENT + myTurn           → Илгээх (enabled, /return)
//   SENT + ээлж нөгөөд      → Илгээх (disabled — аль хэдийн илгээгдсэн)
//   PARTIALLY_SIGNED        → Илгээх (disabled — гарын үсгийн фаз)
//   FULLY_SIGNED + creator  → Баталгаажуулах
//   COMPLETED/etc           → Эцсийн badge
function BottomAction({
  contract, isCreator, myTurn,
  onOpenAddParticipant,
  onReturn, onConfirm, onClose,
  sending, confirming, closing,
}) {
  const status = contract.status

  // ── DRAFT (creator) — Modal-аар тал нэмж урих ──
  if (status === 'DRAFT' && isCreator) {
    return (
      <button
        onClick={onOpenAddParticipant}
        disabled={sending}
        className="w-full inline-flex items-center justify-center gap-1.5
                   px-4 py-2.5 text-sm font-semibold text-white
                   bg-[#3d3a8c] hover:bg-[#2d2a6e] rounded-lg cursor-pointer border-0
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <MdPersonOutline size={16} />
        {sending ? 'Илгээж байна…' : 'Тал нэмж илгээх'}
      </button>
    )
  }

  // ── SENT — myTurn бол enable, эс бөгөөс disable ──
  if (status === 'SENT') {
    if (myTurn) {
      return (
        <button
          onClick={() => onReturn()}
          disabled={sending}
          className="w-full inline-flex items-center justify-center gap-1.5
                     px-4 py-2.5 text-sm font-semibold text-white
                     bg-[#3d3a8c] hover:bg-[#2d2a6e] rounded-lg cursor-pointer border-0
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MdSend size={14} /> {sending ? 'Илгээж байна...' : 'Илгээх'}
        </button>
      )
    }
    return (
      <button
        disabled
        className="w-full inline-flex items-center justify-center gap-1.5
                   px-4 py-2.5 text-sm font-semibold text-gray-500
                   bg-gray-100 rounded-lg border-0 cursor-not-allowed"
      >
        <MdSend size={14} /> Илгээгдсэн
      </button>
    )
  }
  // ── PARTIALLY_SIGNED — гарын үсгийн фаз, илгээх боломжгүй ──
  if (status === 'PARTIALLY_SIGNED') {
    return (
      <button
        disabled
        className="w-full inline-flex items-center justify-center gap-1.5
                   px-4 py-2.5 text-sm font-semibold text-gray-500
                   bg-gray-100 rounded-lg border-0 cursor-not-allowed"
      >
        <MdSend size={14} /> Илгээгдсэн
      </button>
    )
  }
  // ── FULLY_SIGNED — creator confirm ──
  if (status === 'FULLY_SIGNED' && isCreator) {
    return (
      <button
        onClick={onConfirm}
        disabled={confirming}
        className="w-full inline-flex items-center justify-center gap-1.5
                   px-4 py-2.5 text-sm font-semibold text-white
                   bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer border-0
                   disabled:opacity-50"
      >
        <MdVerifiedUser size={14} />
        {confirming ? 'Баталгаажуулж байна...' : 'Баталгаажуулах'}
      </button>
    )
  }

  // ── COMPLETED — creator-т "Гэрээг хаах" товч ──────────
  if (status === 'COMPLETED' && isCreator) {
    return (
      <div className="flex flex-col gap-2">
        <div className="rounded-lg py-2 px-3 text-center border text-xs font-semibold
                        inline-flex items-center justify-center gap-1.5
                        bg-emerald-50 text-emerald-800 border-emerald-200">
          <MdVerifiedUser size={14} /> Blockchain дээр баталгаажсан
        </div>
        <button
          onClick={onClose}
          disabled={closing}
          className="w-full inline-flex items-center justify-center gap-1.5
                     px-4 py-2.5 text-sm font-semibold text-white
                     bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer border-0
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MdClose size={14} /> {closing ? 'Хааж байна...' : 'Гэрээг хаах'}
        </button>
      </div>
    )
  }

  // ── Final states ──
  if (['COMPLETED', 'CLOSED', 'CANCELLED', 'DECLINED', 'EXPIRED'].includes(status)) {
    const finalCfg = {
      COMPLETED: { icon: <MdVerifiedUser size={16} />, label: 'Blockchain дээр баталгаажсан', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
      CLOSED:    { icon: <MdCheckCircle size={16} />,  label: 'Гэрээ хаагдсан',                cls: 'bg-slate-100 text-slate-700 border-slate-200' },
      CANCELLED: { icon: <MdCancel size={16} />,       label: 'Цуцлагдсан',                    cls: 'bg-red-50 text-red-700 border-red-200' },
      DECLINED:  { icon: <MdBlock size={16} />,        label: 'Татгалзсан',                     cls: 'bg-red-50 text-red-700 border-red-200' },
      EXPIRED:   { icon: <MdSchedule size={16} />,     label: 'Хугацаа дууссан',                cls: 'bg-gray-100 text-gray-600 border-[#ece8df]' },
    }[status]
    return (
      <div className={`rounded-lg py-2.5 px-4 text-center border text-sm font-semibold
                       inline-flex items-center justify-center gap-1.5 ${finalCfg.cls}`}>
        {finalCfg.icon} {finalCfg.label}
      </div>
    )
  }

  return null
}

// ══════════════════════════════════════════════════════════════
// Гол sidebar component
// ══════════════════════════════════════════════════════════════
export default function ContractSidebar({
  contract,
  user,
  savedSignature,
  onSign,
  onSend,
  onReturn,
  onConfirm,
  onEdit,
  onClose,
  onUploadAttachment,
  onDeleteAttachment,
  signing,
  sending,
  confirming,
  closing,
  uploadingAttachment,
  tab: controlledTab,         // optional controlled mode (parent-аас удирдах)
  onTabChange,                // controlled tab change handler
  refreshLogKey = 0,          // ChangeLog татах сигналыг шинэчлэх
}) {
  const [internalTab, setInternalTab]       = useState('participants')
  const tab = controlledTab ?? internalTab
  const setTab = (next) => {
    if (onTabChange) onTabChange(next)
    else setInternalTab(next)
  }

  const [drawModalOpen,   setDrawModalOpen] = useState(false)
  const [acceptModalOpen, setAcceptModalOpen] = useState(false)
  const [addModalOpen,    setAddModalOpen]    = useState(false)
  const [quickNote,       setQuickNote]       = useState('')

  const status      = contract.status
  const isCreator   = contract.creator_id === user?.user_id
  const myRole      = contract.my_role
  const myStatus    = contract.my_status
  const myTurn      = contract.current_turn && contract.current_turn === myRole
  const userName    = user ? `${user.last_name || ''} ${user.first_name || ''}`.trim() : ''

  const participants = contract.participants || []
  const signedCount  = participants.filter(p => p.status === 'SIGNED').length
  const totalCount   = participants.length

  // Progress (статусаас хамаарч):
  const progressByStatus = {
    DRAFT: 25, SENT: 40, PARTIALLY_SIGNED: 65, FULLY_SIGNED: 85,
    COMPLETED: 100, CANCELLED: 0, DECLINED: 0, EXPIRED: 0,
  }
  const progress = progressByStatus[status] ?? 0

  const canSign = myTurn &&
                  myStatus !== 'SIGNED' &&
                  ['SENT', 'PARTIALLY_SIGNED'].includes(status)
  const canEdit = myTurn && status === 'SENT'

  const handleConfirmSign = async () => {
    setAcceptModalOpen(false)
    if (savedSignature) {
      await onSign(savedSignature.signature_blob, savedSignature.signature_type || 'DRAW')
    }
  }
  const handleDrawnSignature = (blob, type) => {
    setDrawModalOpen(false)
    onSign(blob, type)
  }
  const handleAddSubmit = async (payload) => {
    // payload: { user_id?, email, name?, subject? }
    await onSend(payload)
    setAddModalOpen(false)
  }

  return (
    <>
      {/* Sidebar нь баруун ирмэгт нялзана: бүтэн өндөр, sharp corners.
          Background: linear gradient (right-bottom teal → left-top white) —
          inner card-уудын white bg-ын хооронд subtle depth өгнө. */}
      <div
        className="h-full w-full font-forum flex flex-col gap-4 p-5 print:hidden
                   border-l border-[#ece8df]"
        style={{
          background:
            'linear-gradient(to top left, rgba(20, 184, 166, 0.18), #ffffff)',
        }}
      >

        {/* Header — title + number badge */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl text-slate-900 m-0 tracking-wide">
            Гэрээний дэлгэрэнгүй
          </h2>
          <span className="text-[11px] font-mono text-[#3d3a8c] bg-[#3d3a8c]/10
                           rounded-full px-2 py-0.5">
            {contract.contract_number}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="tracking-wide">Гүйцэтгэл</span>
            <span className="font-sans font-semibold text-slate-700">
              {signedCount}/{totalCount} · {progress}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#ece8df] rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-[#6b67c4] to-[#3d3a8c] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#f3efe6] rounded-lg p-1">
          <TabButton active={tab === 'participants'} onClick={() => setTab('participants')}>
            Талууд <Counter>{totalCount}</Counter>
          </TabButton>
          <TabButton active={tab === 'attachments'} onClick={() => setTab('attachments')}>
            Хавсралт <Counter>{contract.attachments?.length || 0}</Counter>
          </TabButton>
          <TabButton active={tab === 'signatures'} onClick={() => setTab('signatures')}>
            Гарын үсэг
          </TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
            <MdHistory size={12} /> Түүх
          </TabButton>
        </div>

        {/* Tab content — scrollable middle area */}
        <div className="flex-1 overflow-y-auto no-scrollbar pr-1 -mr-1 min-h-0">
          {tab === 'participants' && (
            <ParticipantsTab
              contract={contract}
              currentUserId={user?.user_id}
              onAddClick={isCreator && status === 'DRAFT'
                ? () => setAddModalOpen(true)
                : null}
            />
          )}
          {tab === 'attachments'  && (
            <AttachmentsTab
              contract={contract}
              currentUserId={user?.user_id}
              onUpload={onUploadAttachment}
              onDelete={onDeleteAttachment}
              uploading={uploadingAttachment}
              locked={(contract.signatures?.length || 0) > 0}
            />
          )}
          {tab === 'signatures'   && (
            <SignaturesTab
              contract={contract}
              currentUserId={user?.user_id}
              canSign={canSign}
              savedSignature={savedSignature}
              onSignClick={() => savedSignature
                ? setAcceptModalOpen(true)
                : setDrawModalOpen(true)}
            />
          )}
          {tab === 'history' && (
            <HistoryTab
              contract={contract}
              currentUserId={user?.user_id}
              myTurn={myTurn}
              refreshLogKey={refreshLogKey}
              quickNote={quickNote}
              setQuickNote={setQuickNote}
              onSendComment={async () => {
                const note = quickNote.trim()
                if (!note) return
                try {
                  await onReturn?.(note)
                  setQuickNote('')
                } catch { /* parent handles error */ }
              }}
              sending={sending}
            />
          )}
        </div>

        {/* Bottom action — доод хэсэгт нялзана */}
        <div className="pt-3 border-t border-[#ece8df]">
          <BottomAction
            contract={contract}
            isCreator={isCreator}
            myTurn={myTurn}
            onOpenAddParticipant={() => setAddModalOpen(true)}
            onReturn={onReturn}
            onConfirm={onConfirm}
            onClose={onClose}
            sending={sending}
            confirming={confirming}
            closing={closing}
          />
        </div>
      </div>

      <AcceptModal
        open={acceptModalOpen}
        onConfirm={handleConfirmSign}
        onCancel={() => setAcceptModalOpen(false)}
        confirming={signing}
        contractTitle={contract.title}
      />

      {drawModalOpen && (
        <SignatureModal
          onClose={() => setDrawModalOpen(false)}
          onSave={handleDrawnSignature}
          userName={userName}
          loading={signing}
        />
      )}

      <AddParticipantModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={handleAddSubmit}
        submitting={sending}
      />
    </>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5
                  text-[13px] tracking-wide rounded-md cursor-pointer border-0
                  transition-colors
                  ${active
                    ? 'bg-white text-[#3d3a8c] shadow-sm'
                    : 'bg-transparent text-slate-500 hover:text-slate-800'}`}
    >
      {children}
    </button>
  )
}

function Counter({ children }) {
  if (children === 0 || children === '0') return null
  return (
    <span className="inline-flex items-center justify-center min-w-4 h-4 px-1
                     bg-[#3d3a8c] text-white rounded-full text-[10px] font-sans font-bold">
      {children}
    </span>
  )
}
