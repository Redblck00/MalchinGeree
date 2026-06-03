'use client'
import { useEffect, useRef, useState } from 'react'
import { MdClose, MdShortText, MdNumbers, MdCalendarToday, MdNotes } from 'react-icons/md'
import { CUSTOM_FIELD_TYPES, validateCustomKey, getPresetKeys } from '@/lib/contractFields'

const TYPE_ICON = {
  text:     MdShortText,
  number:   MdNumbers,
  float:    MdNumbers,
  date:     MdCalendarToday,
  textarea: MdNotes,
}

// label-аас key-г автоматаар санал болгох
//   "Гэрчлэх дугаар"  → "gerchleh_dugaar"  (latinise мин, fallback ascii_only)
const slugifyKey = (s) => {
  if (!s) return ''
  const ascii = s
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, '')   // зөвхөн ascii үсэг үлдээнэ
    .trim()
    .replace(/\s+/g, '_')
  return ascii.slice(0, 40)
}

// ══════════════════════════════════════════════════════
// Modal — хувийн талбар үүсгэх / засах
// props:
//   open, onClose, onSave({ key, label, type })
//   defaultType — admin товчдсон type
//   editing     — байгаа field-ийг засах үед {key, label, type}
//   existingKeys— давтагдсан key илрүүлэх Set
// ══════════════════════════════════════════════════════
export default function CustomFieldModal({
  open, onClose, onSave,
  defaultType = 'text',
  editing = null,
  existingKeys = new Set(),
}) {
  const [label, setLabel] = useState('')
  const [key,   setKey]   = useState('')
  const [type,  setType]  = useState(defaultType)
  const [error, setError] = useState(null)
  const [keyTouched, setKeyTouched] = useState(false)

  const labelRef = useRef(null)

  // Modal нээгдэх бүрд reset/load
  useEffect(() => {
    if (!open) return
    if (editing) {
      setLabel(editing.label || '')
      setKey(editing.key || '')
      setType(editing.type || defaultType)
      setKeyTouched(true)
    } else {
      setLabel('')
      setKey('')
      setType(defaultType)
      setKeyTouched(false)
    }
    setError(null)
    setTimeout(() => labelRef.current?.focus(), 50)
  }, [open, editing, defaultType])

  // Label өөрчлөгдөхөд key автомат санал (хэрэв админ key-г гар хүрээгүй бол)
  useEffect(() => {
    if (!keyTouched && !editing) setKey(slugifyKey(label))
  }, [label, keyTouched, editing])

  if (!open) return null

  const presetKeys = getPresetKeys()

  const handleSubmit = (e) => {
    e?.preventDefault?.()
    const keyErr = validateCustomKey(key)
    if (keyErr) return setError(keyErr)
    if (!label.trim()) return setError('Label шаардлагатай')
    if (presetKeys.has(key)) return setError(`"${key}" нь preset талбар. Өөр нэр сонгоно уу.`)
    if (!editing && existingKeys.has(key)) return setError(`"${key}" аль хэдийн нэмэгдсэн байна`)
    if (editing && editing.key !== key && existingKeys.has(key)) {
      return setError(`"${key}" аль хэдийн нэмэгдсэн байна`)
    }

    onSave({ key: key.trim(), label: label.trim(), type })
    onClose()
  }

  const TypeIcon = TYPE_ICON[type] || MdShortText

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm
                 flex items-center justify-center p-4"
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white shadow-2xl
                   border border-gray-100 overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between
                        bg-linear-to-br from-[#1e1b4b] to-[#3d3a8c] text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-white/15 flex items-center justify-center shrink-0">
              <TypeIcon size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold m-0 leading-tight">
                {editing ? 'Талбар засах' : 'Хувийн талбар нэмэх'}
              </h3>
              <p className="text-[11px] text-white/70 m-0 mt-0.5 truncate">
                Хэрэглэгчид харагдах оролтын талбар үүсгэх
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 bg-white/10 hover:bg-white/20 cursor-pointer
                       border-0 flex items-center justify-center text-white"
          >
            <MdClose size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {/* Type chooser */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1.5 block uppercase tracking-wide">
              Талбарын төрөл
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {CUSTOM_FIELD_TYPES.map(t => {
                const Icon = TYPE_ICON[t.value] || MdShortText
                const active = t.value === type
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    title={t.hint}
                    className={`flex flex-col items-center gap-1 py-2
                                border transition-all cursor-pointer
                                ${active
                                  ? 'bg-[#1e1b4b] text-white border-[#1e1b4b] shadow-sm'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#1e1b4b]/40'}`}
                  >
                    <Icon size={16} />
                    <span className="text-[10px] font-medium">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1.5 block uppercase tracking-wide">
              Label <span className="text-red-400 normal-case">*</span>
              <span className="ml-1.5 font-normal normal-case text-gray-400 tracking-normal">
                — хэрэглэгчид харагдах нэр
              </span>
            </label>
            <input
              ref={labelRef}
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Жишээ: Гэрчлэх дугаар"
              className="w-full px-3 py-2.5 border border-gray-200 text-sm
                         outline-none focus:border-[#1e1b4b] focus:ring-2 focus:ring-[#1e1b4b]/10"
            />
          </div>

          {/* Key */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1.5 block uppercase tracking-wide">
              Key <span className="text-red-400 normal-case">*</span>
              <span className="ml-1.5 font-normal normal-case text-gray-400 tracking-normal">
                — template дотор {`{{key}}`} болж орно
              </span>
            </label>
            <input
              value={key}
              onChange={e => { setKeyTouched(true); setKey(e.target.value.toLowerCase()) }}
              placeholder="extra_note"
              className="w-full px-3 py-2.5 border border-gray-200 text-sm font-mono
                         outline-none focus:border-[#1e1b4b] focus:ring-2 focus:ring-[#1e1b4b]/10"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Жижиг үсэг, тоо, _ зөвхөн (a-z, 0-9, _)
            </p>
          </div>

          {/* Preview chip */}
          {label && key && (
            <div className="bg-gray-50 border border-gray-100 px-3 py-2.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1.5">
                Урьдчилан харах
              </p>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7166D9]" />
                <TypeIcon size={14} className="text-[#3C3489]" />
                <span className="text-xs font-medium text-[#3C3489]">{label}</span>
                <code className="ml-auto text-[10px] text-gray-500 font-mono">
                  {`{{${key}}}`}
                </code>
              </div>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-xs text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200
                       hover:bg-gray-50 cursor-pointer"
          >
            Цуцлах
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-semibold text-white bg-[#1e1b4b]
                       hover:bg-[#2d2a6e] cursor-pointer border-0"
          >
            {editing ? 'Хадгалах' : 'Нэмэх'}
          </button>
        </div>
      </form>
    </div>
  )
}
