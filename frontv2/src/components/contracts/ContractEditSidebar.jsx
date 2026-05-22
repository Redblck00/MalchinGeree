'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  MdEdit, MdSend, MdSave, MdArrowBack, MdNote,
  MdCheckCircle, MdInfoOutline, MdAdd, MdClose,
} from 'react-icons/md'
import CONTRACT_FIELDS from '@/lib/contractFields'
import ChangeLog from './ChangeLog'

// ─────────────────────────────────────────────────────────────
// Хэрэгслүүд: schema_json дотор хэрэглэгдсэн key-уудыг гаргах
// ─────────────────────────────────────────────────────────────
function extractUsedKeys(schemaFields) {
  const keys = new Set()
  ;(schemaFields || []).forEach(f => {
    if (f.type === 'object') {
      (f.fields || []).forEach(c => keys.add(`${f.key}.${c.key}`))
    } else if (f.type === 'array') {
      keys.add(`#each ${f.key}`)
    } else {
      keys.add(f.key)
    }
  })
  return keys
}

function getNested(obj, key) {
  const parts = key.split('.')
  let cur = obj
  for (const p of parts) {
    if (cur == null) return ''
    cur = cur[p]
  }
  return cur ?? ''
}

function setNested(obj, key, value) {
  const parts = key.split('.')
  if (parts.length === 1) return { ...obj, [key]: value }
  const [parent, child] = parts
  return {
    ...obj,
    [parent]: { ...(obj[parent] || {}), [child]: value },
  }
}

const SYSTEM_ONLY_KEYS = ['contract_number', 'year', 'month', 'day']

// ─────────────────────────────────────────────────────────────
// Компакт хэлбэрийн нэг field
// ─────────────────────────────────────────────────────────────
function CompactField({ field, value, onChange, disabled }) {
  const base = `w-full px-2.5 py-1.5 text-sm rounded-md outline-none border
                ${disabled
                  ? 'bg-gray-50 border-gray-200 text-gray-500'
                  : 'bg-white border-gray-200 text-gray-900 focus:border-[#3d3a8c] focus:ring-1 focus:ring-[#3d3a8c]/30'}`

  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[11px] font-medium text-gray-600 inline-flex items-center gap-1">
        {field.label}
        {!field.optional && !disabled && <span className="text-red-400">*</span>}
        {disabled && (
          <span className="text-[9px] font-bold uppercase tracking-wider
                           bg-indigo-50 text-[#3d3a8c] px-1 py-0.5 rounded">авто</span>
        )}
      </label>
      {field.type === 'textarea' ? (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          rows={2}
          className={base + ' resize-none'}
        />
      ) : field.type === 'date' ? (
        <input type="date" value={value || ''}
               onChange={e => onChange(e.target.value)}
               disabled={disabled} className={base} />
      ) : field.type === 'number' ? (
        <input type="number" value={value || ''}
               onChange={e => onChange(e.target.value)}
               disabled={disabled} className={base} />
      ) : field.type === 'select' ? (
        <select value={value || ''}
                onChange={e => onChange(e.target.value)}
                disabled={disabled} className={base}>
          <option value="">— Сонгох —</option>
          <option value="cash">Бэлэн</option>
          <option value="bank">Дансаар</option>
          <option value="advance">Нийт</option>
        </select>
      ) : (
        <input type="text" value={value || ''}
               onChange={e => onChange(e.target.value)}
               disabled={disabled} className={base} />
      )}
    </div>
  )
}

function LivestockMiniRow({ item, idx, onUpdate, onRemove }) {
  return (
    <div className="border border-gray-200 rounded-md p-2 bg-gray-50">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold uppercase text-gray-500">
          Мал #{idx + 1}
        </span>
        <button type="button" onClick={() => onRemove(idx)}
                className="text-red-500 hover:bg-red-50 rounded p-0.5
                           cursor-pointer bg-transparent border-0">
          <MdClose size={12} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <input type="text" placeholder="Төрөл"
               value={item.livestock_type || ''}
               onChange={e => onUpdate(idx, 'livestock_type', e.target.value)}
               className="px-2 py-1 text-xs border border-gray-200 rounded outline-none
                          focus:border-[#3d3a8c] bg-white" />
        <input type="number" placeholder="Тоо"
               value={item.count || ''}
               onChange={e => onUpdate(idx, 'count', e.target.value)}
               className="px-2 py-1 text-xs border border-gray-200 rounded outline-none
                          focus:border-[#3d3a8c] bg-white" />
        <input type="number" placeholder="Нэгж үнэ"
               value={item.price_per_unit || ''}
               onChange={e => onUpdate(idx, 'price_per_unit', e.target.value)}
               className="px-2 py-1 text-xs border border-gray-200 rounded outline-none
                          focus:border-[#3d3a8c] bg-white" />
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// ContractEditSidebar
// Mode:
//   • EDIT: form fields list + Save товч
//   • SEND: comment textarea + change log + Send товч
// ═════════════════════════════════════════════════════════════
export default function ContractEditSidebar({
  contract,
  template,
  user,
  onSave,            // (filled_data_json) => Promise
  onSend,            // (note) => Promise
  onCancel,          // edit mode-аас гарах
  saving = false,
  sending = false,
  initialMode = 'EDIT',
  refreshLogKey = 0, // log дахин татах сигнал
}) {
  const [mode, setMode]         = useState(initialMode)
  const [formData, setFormData] = useState(contract.filled_data_json || {})
  const [note, setNote]         = useState('')
  const [localError, setLocalError] = useState(null)

  // Хэрэв бид PARENT-аас ирсэн contract шинэчлэгдсэн бол formData-г refresh хийнэ
  useEffect(() => {
    setFormData(contract.filled_data_json || {})
  }, [contract.filled_data_json])

  // initialMode өөрчлөгдвөл шилжих (saved-pending detect)
  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  // Аль role нь миний тал вэ
  const creatorRole = contract.creator_role || 'seller'
  const myRole      = contract.my_role || 'CREATOR'
  const myRoleKey   = myRole === 'CREATOR'
    ? creatorRole
    : (creatorRole === 'seller' ? 'buyer' : 'seller')
  const oppositeRoleKey = myRoleKey === 'seller' ? 'buyer' : 'seller'

  // Өөрийн талын хоосон талбаруудыг user профайлаас auto-fill хийх
  // (backend мөн адил хийдэг, гэхдээ form-д шууд харагдахын тулд frontend дээр давхар)
  useEffect(() => {
    if (!user) return
    const fullName = `${user.last_name || ''} ${user.first_name || ''}`.trim()
    setFormData(prev => {
      const cur = prev[myRoleKey] || {}
      const next = { ...cur }
      if (!next.name    && fullName)      next.name    = fullName
      if (!next.phone   && user.phone)    next.phone   = user.phone
      if (!next.email   && user.email)    next.email   = user.email
      if (!next.address && user.address)  next.address = user.address

      const changed = ['name', 'phone', 'email', 'address']
        .some(k => (cur[k] || '') !== (next[k] || ''))
      if (!changed) return prev
      return { ...prev, [myRoleKey]: next }
    })
  }, [user, myRoleKey])

  // Template-аас хэрэглэгдсэн key-уудыг гаргах
  const usedKeys = useMemo(
    () => extractUsedKeys(template?.schema_json?.fields),
    [template]
  )
  const hasLivestockArray = usedKeys.has('#each livestock')

  // Тухайн талбар auto-fill (өөрийн талын мэдээлэл) эсэх
  const isAutoFill = (key) => {
    if (key.startsWith(`${myRoleKey}.`)) return true
    if (key === 'payment.total_amount' && hasLivestockArray) return true
    return false
  }

  // Эсрэг талын группийн нэр (одоо засаж буй талын мэдээллийг л харуулна)
  const oppositeGroupName = oppositeRoleKey === 'seller' ? 'Худалдагч' : 'Худалдан авагч'

  // Харагдах группүүд
  const visibleGroups = useMemo(() => {
    const groups = []
    CONTRACT_FIELDS.forEach(group => {
      const title = group.group.trim()
      if (title === oppositeGroupName.trim()) return

      const fields = group.fields.filter(f =>
        usedKeys.has(f.key) &&
        f.type !== 'signature' &&
        f.type !== 'each_start' &&
        f.type !== 'each_end' &&
        !SYSTEM_ONLY_KEYS.includes(f.key) &&
        !['livestock_type', 'count', 'price_per_unit'].includes(f.key)
      )
      const showLivestock = hasLivestockArray &&
        group.fields.some(f => f.key === '#each livestock')

      if (fields.length === 0 && !showLivestock) return
      groups.push({ title, fields, showLivestock })
    })
    return groups
  }, [usedKeys, oppositeGroupName, hasLivestockArray])

  // Field update
  const updateField = (key, value) => {
    setFormData(prev => setNested(prev, key, value))
  }
  const updateLivestock = (idx, k, v) => {
    setFormData(prev => {
      const list = [...(prev.livestock || [])]
      list[idx] = { ...list[idx], [k]: v }
      return { ...prev, livestock: list }
    })
  }
  const addLivestock = () => setFormData(prev => ({
    ...prev, livestock: [...(prev.livestock || []), {}],
  }))
  const removeLivestock = (idx) => setFormData(prev => ({
    ...prev, livestock: (prev.livestock || []).filter((_, i) => i !== idx),
  }))

  // Total amount auto-calculation
  useEffect(() => {
    if (!hasLivestockArray) return
    const items = formData.livestock || []
    const total = items.reduce((sum, it) => {
      const c = parseFloat(it.count) || 0
      const p = parseFloat(it.price_per_unit) || 0
      return sum + c * p
    }, 0)
    setFormData(prev => {
      const cur = prev.payment?.total_amount
      if (cur === total) return prev
      return { ...prev, payment: { ...(prev.payment || {}), total_amount: total } }
    })
  }, [formData.livestock, hasLivestockArray])

  const handleSave = async () => {
    setLocalError(null)
    if (hasLivestockArray) {
      const items = formData.livestock || []
      if (items.length === 0) {
        setLocalError('Хамгийн багадаа нэг мал нэмнэ үү')
        return
      }
    }
    try {
      await onSave(formData)
      setMode('SEND')
    } catch (err) {
      setLocalError(err?.response?.data?.message || 'Хадгалахад алдаа гарлаа')
    }
  }

  const handleSendClick = async () => {
    setLocalError(null)
    try {
      await onSend(note.trim() || null)
      setNote('')
    } catch (err) {
      setLocalError(err?.response?.data?.message || 'Илгээхэд алдаа гарлаа')
    }
  }

  // ═══════════════════════════════════════════════════════════
  // EDIT MODE — form fields list
  // ═══════════════════════════════════════════════════════════
  if (mode === 'EDIT') {
    return (
      <div className="h-full w-full bg-white flex flex-col print:hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-900 m-0 inline-flex items-center gap-1.5">
              <MdEdit size={16} className="text-[#3d3a8c]" /> Гэрээ засварлах
            </h2>
            <button type="button" onClick={onCancel}
                    className="text-xs text-gray-500 hover:text-gray-900
                               inline-flex items-center gap-0.5 cursor-pointer
                               bg-transparent border-0 p-0">
              <MdArrowBack size={12} /> Гарах
            </button>
          </div>
          <p className="text-[11px] text-gray-500 m-0 mt-1">
            Талбаруудыг засаад "Хадгалах" дарна уу. Нөгөө талд автоматаар илгээгдэхгүй.
          </p>
        </div>

        {/* Fields — scrollable */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
          {visibleGroups.map((g, gi) => (
            <div key={gi} className="flex flex-col gap-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500
                              pb-1 border-b border-gray-100">
                {g.title}
              </div>
              <div className="flex flex-col gap-2.5">
                {g.fields.map(f => (
                  <CompactField
                    key={f.key}
                    field={f}
                    value={getNested(formData, f.key)}
                    onChange={(v) => updateField(f.key, v)}
                    disabled={isAutoFill(f.key)}
                  />
                ))}
                {g.showLivestock && (
                  <div className="flex flex-col gap-1.5">
                    {(formData.livestock || []).map((it, idx) => (
                      <LivestockMiniRow
                        key={idx}
                        item={it}
                        idx={idx}
                        onUpdate={updateLivestock}
                        onRemove={removeLivestock}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={addLivestock}
                      className="self-start inline-flex items-center gap-1 px-2 py-1
                                 text-[11px] font-semibold text-[#3d3a8c]
                                 border border-[#3d3a8c]/30 rounded
                                 hover:bg-[#3d3a8c]/5 cursor-pointer bg-white"
                    >
                      <MdAdd size={12} /> Мал нэмэх
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {localError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200
                            rounded-lg px-3 py-2">
              {localError}
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="p-4 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-1.5
                       px-4 py-2.5 text-sm font-semibold text-white
                       bg-[#3d3a8c] hover:bg-[#2d2a6e] rounded-lg cursor-pointer border-0
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MdSave size={14} /> {saving ? 'Хадгалж байна...' : 'Хадгалах'}
          </button>
          <p className="text-[10px] text-gray-400 text-center m-0 mt-2">
            Хадгалсны дараа нөгөө талд илгээх боломжтой
          </p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // SEND MODE — comment + change log + send button
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="h-full w-full bg-white flex flex-col print:hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-900 m-0 inline-flex items-center gap-1.5">
            <MdSend size={16} className="text-emerald-600" /> Нөгөө талд илгээх
          </h2>
          <button type="button" onClick={() => setMode('EDIT')}
                  className="text-xs text-gray-500 hover:text-gray-900
                             inline-flex items-center gap-0.5 cursor-pointer
                             bg-transparent border-0 p-0">
            <MdEdit size={12} /> Дахин засах
          </button>
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1
                        bg-emerald-50 border border-emerald-200 rounded text-[11px]
                        text-emerald-800">
          <MdCheckCircle size={12} /> Засвар хадгалагдсан
        </div>
      </div>

      {/* Body — scroll */}
      <div className="flex-1 overflow-hidden p-4 flex flex-col gap-4 min-h-0">
        {/* Comment textarea */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500
                            inline-flex items-center gap-1">
            <MdNote size={12} /> Тайлбар (сонголттой)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 1000))}
            rows={3}
            placeholder="Жишээ: Хугацааг 6 сар → 1 жил болгох санал..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                       outline-none focus:border-[#3d3a8c] focus:ring-1 focus:ring-[#3d3a8c]/30
                       bg-white resize-none"
          />
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span className="inline-flex items-center gap-1">
              <MdInfoOutline size={11} />
              Нөгөө тал email + мэдэгдэлд харна
            </span>
            <span>{note.length}/1000</span>
          </div>
        </div>

        {/* Change log */}
        <div className="flex-1 min-h-0 flex flex-col">
          <ChangeLog
            contractId={contract.contract_id}
            currentUserId={user?.user_id}
            refreshKey={refreshLogKey}
          />
        </div>

        {localError && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200
                          rounded-lg px-3 py-2 shrink-0">
            {localError}
          </div>
        )}
      </div>

      {/* Send button */}
      <div className="p-4 border-t border-gray-100 shrink-0">
        <button
          type="button"
          onClick={handleSendClick}
          disabled={sending}
          className="w-full inline-flex items-center justify-center gap-1.5
                     px-4 py-2.5 text-sm font-semibold text-white
                     bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer border-0
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MdSend size={14} /> {sending ? 'Илгээж байна...' : 'Илгээх'}
        </button>
      </div>
    </div>
  )
}
