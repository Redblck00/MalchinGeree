'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  MdEventNote, MdPersonOutline, MdPets, MdLocalShipping,
  MdPayments, MdAttachFile, MdEdit, MdCheck, MdChevronRight,
  MdChevronLeft, MdInfoOutline, MdWarningAmber, MdSave,
  MdAdd, MdClose, MdArrowForward, MdArrowBack, MdKeyboardArrowDown,
} from 'react-icons/md'
import CONTRACT_FIELDS, { LIVESTOCK_TYPES } from '@/lib/contractFields'
import { REGISTER_LETTERS } from '@/lib/registerLetters'

const SYSTEM_ONLY_KEYS    = ['contract_number', 'year', 'month', 'day']
const LIVESTOCK_ITEM_KEYS = ['livestock_type', 'count', 'weight', 'price_per_unit']

// Профайлаас авто-бөглөгддөг seller/buyer дэд талбарууд (register үүнд ОРОХГҮЙ — гараар)
const AUTO_FILL_PROFILE_KEYS = ['name', 'phone', 'email', 'address']

// Регистр: 2 крил үсэг + 8 оронтой тоо (жишээ: УБ12345678)
const REGISTER_RE = /^[А-ЯӨҮЁ]{2}\d{8}$/

const CYRILLIC_RE = /^[Ѐ-ӿ\s\-]+$/
const validateLivestockItem = (item) => {
  const e = {}
  if (item.livestock_type != null && item.livestock_type !== '') {
    if (!CYRILLIC_RE.test(item.livestock_type.trim())) {
      e.livestock_type = 'Зөвхөн монгол үсэг бичнэ үү'
    }
  }
  if (item.count != null && item.count !== '') {
    const n = parseInt(item.count, 10)
    if (isNaN(n) || n < 1) e.count = 'Эерэг бүхэл тоо оруулна уу'
    else if (parseFloat(item.count) !== n) e.count = 'Бутархай биш бүхэл тоо'
  }
  if (item.weight != null && item.weight !== '') {
    const w = parseFloat(item.weight)
    if (isNaN(w) || w <= 0) e.weight = 'Жин 0-ээс их байх'
  }
  if (item.price_per_unit != null && item.price_per_unit !== '') {
    const p = parseFloat(item.price_per_unit)
    if (isNaN(p) || p < 0) e.price_per_unit = 'Үнэ 0-ээс багагүй'
  }
  return e
}

// Группийн харагдах metadata (icon, subtitle)
const GROUP_META = {
  'Гэрээний мэдээлэл': { icon: MdEventNote,     subtitle: 'Дугаар, огноо, хүчинтэй хугацаа' },
  'Худалдагч':         { icon: MdPersonOutline, subtitle: 'Худалдагч талын мэдээлэл' },
  'Худалдан авагч':    { icon: MdPersonOutline, subtitle: 'Худалдан авагч талын мэдээлэл' },
  'Малын мэдээлэл':    { icon: MdPets,          subtitle: 'Төрөл, тоо, нэгж үнэ' },
  'Хүргэлт':           { icon: MdLocalShipping, subtitle: 'Газар, огноо, нэмэлт шаардлага' },
  'Төлбөр':            { icon: MdPayments,      subtitle: 'Нийт үнэ, төлбөрийн нөхцөл' },
  'Хавсралт':          { icon: MdAttachFile,    subtitle: 'Нэмэлт материал' },
  'Гарын үсэг':        { icon: MdEdit,          subtitle: 'Талуудын гарын үсэг' },
}
const groupMeta = (name) =>
  GROUP_META[name?.trim()] || { icon: MdInfoOutline, subtitle: '' }

// Крилл нэрүүдээс DOM-д ашиглах ASCII id үүсгэх map
const GROUP_SLUGS = {
  'Гэрээний мэдээлэл': 'contract-info',
  'Худалдагч':         'seller',
  'Худалдан авагч':    'buyer',
  'Малын мэдээлэл':    'livestock',
  'Хүргэлт':           'delivery',
  'Төлбөр':            'payment',
  'Хавсралт':          'attachments',
  'Гарын үсэг':        'signatures',
}

function extractUsedKeys(schemaFields) {
  const keys = new Set()
  schemaFields.forEach(f => {
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

function getNestedValue(obj, key) {
  const parts = key.split('.')
  let cur = obj
  for (const p of parts) {
    if (cur == null) return ''
    cur = cur[p]
  }
  return cur ?? ''
}

// ──────────────────────────────────────────────────────────
// Крил үсэг сонгох custom dropdown
// Native <select>-ийн drop-down нь хөтчийн стайлаар гардаг тул Figma-гийн
// "цагаан overlay" харагдацыг гаргаж чадахгүй. Иймд товч + цагаан overlay
// панелиар (grid) өөрсдөө хийнэ. Гадуур дарвал хаагдана.
// ──────────────────────────────────────────────────────────
function LetterSelect({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`flex items-center justify-between gap-1 w-14 px-2.5 py-2.5 border rounded-sm
                    text-sm outline-none transition-colors
                    ${disabled
                      ? 'bg-gray-50 border-gray-200 text-gray-600 cursor-not-allowed'
                      : open
                        ? 'bg-white border-[#3d3a8c] ring-2 ring-[#3d3a8c]/10 text-gray-900 cursor-pointer'
                        : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 cursor-pointer'}`}
      >
        <span className={value ? '' : 'text-gray-400'}>{value || '—'}</span>
        <MdKeyboardArrowDown
          size={16}
          className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && !disabled && (
        <div
          className="absolute z-50 mt-1 left-0 w-48 max-h-56 overflow-y-auto no-scrollbar
                     bg-white border border-gray-200 rounded-md shadow-lg
                     p-2 grid grid-cols-5 gap-1"
        >
          {REGISTER_LETTERS.map(L => (
            <button
              key={L}
              type="button"
              onClick={() => { onChange(L); setOpen(false) }}
              className={`w-7 h-7 flex items-center justify-center text-sm rounded-sm
                          cursor-pointer border-0 transition-colors
                          ${value === L
                            ? 'bg-[#3d3a8c] text-white'
                            : 'bg-transparent text-gray-700 hover:bg-[#3d3a8c]/10'}`}
            >
              {L}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Регистрийн composite input — 2 крил үсэг select + 8 оронтой тоо
// Утга нь нэг мөр болж хадгалагдана (жишээ: "УБ12345678")
// ──────────────────────────────────────────────────────────
function RegisterInput({ value, onChange, disabled }) {
  // Хадгалагдсан мөрийг үсэг(2) + тоо(8) болгон задлах (бат бөх parse)
  const m       = (value || '').match(/^([^\d]{0,2})(\d{0,8})/) || ['', '', '']
  const l1      = m[1][0] || ''
  const l2      = m[1][1] || ''
  const digits  = m[2] || ''
  const invalid = !!value && !REGISTER_RE.test(value)

  const emit = (nl1, nl2, nd) => onChange(`${nl1}${nl2}${nd}`)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <LetterSelect
          value={l1}
          onChange={v => emit(v, l2, digits)}
          disabled={disabled}
        />
        <LetterSelect
          value={l2}
          onChange={v => emit(l1, v, digits)}
          disabled={disabled}
        />
        <input
          type="text"
          inputMode="numeric"
          maxLength={8}
          placeholder="12345678"
          value={digits}
          onChange={e => emit(l1, l2, e.target.value.replace(/\D/g, '').slice(0, 8))}
          disabled={disabled}
          className={`flex-1 min-w-0 px-3 py-2.5 border rounded-sm text-sm outline-none transition-colors tracking-widest
                      ${disabled
                        ? 'bg-gray-50 border-gray-200 text-gray-600'
                        : invalid
                          ? 'bg-red-50 border-red-300 text-red-700'
                          : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 focus:border-[#3d3a8c] focus:ring-2 focus:ring-[#3d3a8c]/10'}`}
        />
      </div>
      {invalid && (
        <p className="text-[11px] text-red-500 m-0">2 үсэг + 8 оронтой тоо (жишээ: УБ12345678)</p>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Field component (label + badges + input)
// ──────────────────────────────────────────────────────────
function FormField({ field, value, onChange, disabled }) {
  const inputCls = `w-full px-3 py-2.5 border rounded-xl text-sm outline-none transition-colors
                    ${disabled
                      ? 'bg-gray-50 border-gray-200 text-gray-600'
                      : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 focus:border-[#3d3a8c] focus:ring-2 focus:ring-[#3d3a8c]/10'}`

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-gray-700 truncate">
          {field.label}
          {!field.optional && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {disabled && (
          <span className="text-[9px] font-bold uppercase tracking-wider
                           bg-indigo-50 text-[#42a385] px-1.5 py-0.5 rounded">
            авто
          </span>
        )}
        {field.optional && !disabled && (
          <span className="text-[9px] font-bold uppercase tracking-wider
                           bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
            сонголттой
          </span>
        )}
      </div>
      {field.type === 'register' ? (
        <RegisterInput value={value} onChange={onChange} disabled={disabled} />
      ) : field.type === 'textarea' ? (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          className={inputCls + ' resize-none'}
        />
      ) : field.type === 'date' ? (
        <input
          type="date"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className={inputCls}
        />
      ) : field.type === 'number' ? (
        <input
          type="number"
          step="1"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className={inputCls}
        />
      ) : field.type === 'float' ? (
        <input
          type="number"
          step="0.01"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className={inputCls}
        />
      ) : field.type === 'select' ? (
        <select
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className={inputCls}
        >
          <option value="">— Сонгох —</option>
          <option value="cash">Бэлэн</option>
          <option value="bank">Дансаар</option>
          <option value="advance">Нийт</option>
        </select>
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className={inputCls}
        />
      )}
    </div>
  )
}

function ValidatedInput({ label, value, onChange, error, type = 'text', options = null, ...rest }) {
  const cls = `w-full px-3 py-2.5 border rounded-xl text-sm outline-none bg-white
               transition-colors
               ${error
                 ? 'border-red-300 bg-red-50 text-red-700'
                 : 'border-gray-200 text-gray-900 hover:border-gray-300 focus:border-[#3d3a8c] focus:ring-2 focus:ring-[#3d3a8c]/10'}`
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label className="text-xs font-medium text-gray-700">{label}</label>
      {options ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={cls}
        >
          <option value="">— Сонгох —</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={cls}
          {...rest}
        />
      )}
      {error && <p className="text-[11px] text-red-500 m-0">{error}</p>}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Livestock row + section
// ──────────────────────────────────────────────────────────
function LivestockRow({ item, idx, onUpdate, onRemove }) {
  const errors = validateLivestockItem(item)
  return (
    <div className="bg-gray-50 p-3 sm:p-4 rounded-xl border border-gray-100">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Мал #{idx + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(idx)}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-red-500
                     border border-red-200 rounded-md hover:bg-red-50 cursor-pointer bg-white"
        >
          <MdClose size={12} /> Хасах
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ValidatedInput
          label="Малын төрөл"
          value={item.livestock_type || ''}
          onChange={v => onUpdate(idx, 'livestock_type', v)}
          options={LIVESTOCK_TYPES}
          error={errors.livestock_type}
        />
        <ValidatedInput
          label="Тоо толгой"
          type="number"
          min="1"
          step="1"
          value={item.count || ''}
          onChange={v => onUpdate(idx, 'count', v)}
          placeholder="10"
          error={errors.count}
        />
        <ValidatedInput
          label="Жин (кг)"
          type="number"
          min="0"
          step="any"
          value={item.weight || ''}
          onChange={v => onUpdate(idx, 'weight', v)}
          placeholder="35.8"
          error={errors.weight}
        />
        <ValidatedInput
          label="Нэгж үнэ (₮)"
          type="number"
          min="0"
          step="any"
          value={item.price_per_unit || ''}
          onChange={v => onUpdate(idx, 'price_per_unit', v)}
          placeholder="500000"
          error={errors.price_per_unit}
        />
      </div>
    </div>
  )
}

function LivestockSection({ items, onUpdate, onAdd, onRemove }) {
  return (
    <div className="sm:col-span-2 flex flex-col gap-3">
      {items.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center">
          <MdPets size={22} className="mx-auto text-gray-300" />
          <p className="text-xs text-gray-500 m-0 mt-1.5">
            Доорх товчоор малын мэдээлэл нэмнэ үү
          </p>
        </div>
      ) : (
        items.map((item, idx) => (
          <LivestockRow
            key={idx}
            item={item}
            idx={idx}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))
      )}
      <button
        type="button"
        onClick={onAdd}
        className="self-start inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold
                   text-gray-900 border border-[#3d3a8c]/30 rounded-sm
                   hover:bg-[#3d3a8c]/5 cursor-pointer bg-white"
      >
        <MdAdd size={14} /> Мал нэмэх
      </button>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Step card (sidebar item)
// ──────────────────────────────────────────────────────────
function StepCard({ group, active, completion, onClick }) {
  const { filled, total, complete } = completion
  const Icon = group.meta.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-sm border text-left
                  cursor-pointer transition-all
                  ${active
                    ? 'bg-white border-[#3d3a8c] shadow-sm ring-2 ring-[#3d3a8c]/10'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
    >
      <div className={`shrink-0 w-9 h-9 rounded-sm flex items-center justify-center
                       ${complete
                         ? 'bg-emerald-50 text-emerald-600'
                         : active
                           ? 'bg-[#3d3a8c]/10 text-[#3d3a8c]'
                           : 'bg-gray-100 text-gray-500'}`}>
        {complete ? <MdCheck size={18} /> : <Icon size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-semibold m-0 truncate
                         ${active ? 'text-[#3d3a8c]' : 'text-gray-900'}`}>
            {group.title}
          </p>
          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded
                            ${complete
                              ? 'bg-emerald-50 text-emerald-600'
                              : filled > 0
                                ? 'bg-amber-50 text-amber-600'
                                : 'bg-gray-100 text-gray-500'}`}>
            {filled}/{total}
          </span>
        </div>
        <p className="text-[11px] text-gray-500 m-0 mt-0.5 truncate">
          {group.meta.subtitle}
        </p>
      </div>
      <MdChevronRight
        size={16}
        className={`shrink-0 ${active ? 'text-[#3a8c6d]' : 'text-gray-300'}`}
      />
    </button>
  )
}

// ══════════════════════════════════════════════════════
// ContractForm — Гэрээ үүсгэх / засах form
// ══════════════════════════════════════════════════════
export default function ContractForm({
  template,
  initialData = null,
  creatorRole = 'seller',
  myRole = 'CREATOR',
  user,
  submitting = false,
  error = null,
  submitLabel = 'Хадгалах',
  onSubmit,
  onCancel,
}) {
  const isEditMode = !!initialData
  const myRoleKey  = myRole === 'CREATOR'
    ? creatorRole
    : (creatorRole === 'seller' ? 'buyer' : 'seller')

  const [formData, setFormData]     = useState(initialData || {})
  const [localError, setLocalError] = useState(null)
  const [activeStep, setActiveStep] = useState(null)

  useEffect(() => {
    if (initialData) setFormData(initialData)
  }, [initialData])

  // Өөрийн талын мэдээллийг user-аас auto-fill
  useEffect(() => {
    if (!user) return
    const fullName = `${user.last_name || ''} ${user.first_name || ''}`.trim()
    setFormData(prev => {
      const existing = prev[myRoleKey] || {}
      if (isEditMode) {
        return {
          ...prev,
          [myRoleKey]: {
            name:    existing.name    || fullName,
            phone:   existing.phone   || user.phone   || '',
            email:   existing.email   || user.email   || '',
            address: existing.address || user.address || '',
            ...existing,
          },
        }
      }
      return {
        ...prev,
        [myRoleKey]: {
          ...existing,
          name:    fullName,
          phone:   user.phone   || '',
          email:   user.email   || '',
          address: user.address || '',
        },
      }
    })
  }, [user, myRoleKey, isEditMode])

  const usedKeys = useMemo(() => {
    if (!template?.schema_json?.fields) return new Set()
    return extractUsedKeys(template.schema_json.fields)
  }, [template])

  const hasLivestockArray = usedKeys.has('#each livestock')

  // count × нэгж үнэ → payment.total_amount авто
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
      if (cur === total || (cur === '' && total === 0)) return prev
      return { ...prev, payment: { ...(prev.payment || {}), total_amount: total } }
    })
  }, [formData.livestock, hasLivestockArray])

  const updateField = (key, value) => {
    setFormData(prev => {
      const parts = key.split('.')
      if (parts.length === 1) return { ...prev, [key]: value }
      const [parent, child] = parts
      return {
        ...prev,
        [parent]: { ...(prev[parent] || {}), [child]: value },
      }
    })
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

  // Counterparty fields-г нуух
  const oppositeGroupName = myRoleKey === 'seller' ? 'Худалдан авагч' : 'Худалдагч'

  // Тухайн талбарыг auto-fill (disabled) эсэх
  const isAutoFill = (key) => {
    // Зөвхөн профайлаас бөглөгддөг талбарууд (name/phone/email/address) disabled.
    // Регистр зэрэг гараар бөглөх талбар editable хэвээр.
    if (key.startsWith(`${myRoleKey}.`)) {
      return AUTO_FILL_PROFILE_KEYS.includes(key.split('.')[1])
    }
    if (key === 'payment.total_amount' && hasLivestockArray) return true
    return false
  }

  // Admin-ийн нэмсэн хувийн талбарууд (schema_json.fields-аас)
  const customExtraFields = useMemo(() => {
    if (!template?.schema_json?.fields) return []
    return template.schema_json.fields
      .filter(f => f.custom === true && f.key && !f.key.includes('.'))
      .map(f => ({
        key:   f.key,
        label: f.label || f.key,
        type:  f.type || 'text',
      }))
  }, [template])

  // Харагдах группүүдийг бэлдэх + per-group completion тооцох
  const visibleGroups = useMemo(() => {
    const result = []
    CONTRACT_FIELDS.forEach(group => {
      const title = group.group.trim()
      if (title === oppositeGroupName.trim()) return

      const usedFields = group.fields.filter(f =>
        usedKeys.has(f.key) &&
        f.type !== 'signature' &&
        f.type !== 'each_start' &&
        f.type !== 'each_end' &&
        !SYSTEM_ONLY_KEYS.includes(f.key) &&
        !LIVESTOCK_ITEM_KEYS.includes(f.key)
      )
      const hasLivestock = usedKeys.has('#each livestock') &&
        group.fields.some(f => f.key === '#each livestock')

      if (!usedFields.length && !hasLivestock) return

      // Шаардлагатай талбарууд (optional биш) болон бөглөгдсөнийг тоолно
      let total = 0
      let filled = 0
      usedFields.forEach(f => {
        if (f.optional) return
        total += 1
        const v = getNestedValue(formData, f.key)
        if (v !== '' && v != null) filled += 1
      })
      if (hasLivestock) {
        const items = formData.livestock || []
        // нэг мөр шаардлагатай гэж тооцоё
        total += 1
        const valid = items.length > 0 && items.every(it =>
          it.livestock_type && it.count && it.price_per_unit &&
          Object.keys(validateLivestockItem(it)).length === 0
        )
        if (valid) filled += 1
      }

      const id = GROUP_SLUGS[title] || `group-${result.length}`
      result.push({
        id,
        title,
        meta: groupMeta(title),
        fields: usedFields,
        hasLivestock,
        completion: { filled, total, complete: total > 0 && filled === total },
      })
    })

    // ── Custom (хувийн) талбарууд — admin-ийн нэмсэн ──────
    // template_content-д ашиглагдсан (usedKeys-д байгаа) хувийн талбаруудыг
    // "Нэмэлт мэдээлэл" group болгож харуулна.
    const usedCustom = customExtraFields.filter(f => usedKeys.has(f.key))
    if (usedCustom.length > 0) {
      let total = 0, filled = 0
      usedCustom.forEach(f => {
        total += 1
        const v = getNestedValue(formData, f.key)
        if (v !== '' && v != null) filled += 1
      })
      result.push({
        id:    'custom-extras',
        title: 'Нэмэлт мэдээлэл',
        meta:  { icon: MdInfoOutline, subtitle: 'Энэхүү загварт нэмэгдсэн хувийн талбарууд' },
        fields: usedCustom,
        hasLivestock: false,
        completion: { filled, total, complete: total > 0 && filled === total },
      })
    }

    return result
  }, [usedKeys, formData, oppositeGroupName, customExtraFields])

  // Анхдагч active step
  useEffect(() => {
    if (!activeStep && visibleGroups.length > 0) {
      setActiveStep(visibleGroups[0].id)
    }
  }, [visibleGroups, activeStep])

  // Wizard navigation — одоогийн active group + prev/next
  const activeIndex   = visibleGroups.findIndex(g => g.id === activeStep)
  const currentGroup  = activeIndex >= 0 ? visibleGroups[activeIndex] : null
  const prevGroup     = activeIndex > 0 ? visibleGroups[activeIndex - 1] : null
  const nextGroup     = activeIndex >= 0 && activeIndex < visibleGroups.length - 1
                        ? visibleGroups[activeIndex + 1]
                        : null

  const goToStep = (id) => {
    setActiveStep(id)
    // Top руу гүйлгэх (sticky header дор)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Нийт прогресс
  const overall = useMemo(() => {
    const t = visibleGroups.reduce((s, g) => s + g.completion.total, 0)
    const f = visibleGroups.reduce((s, g) => s + g.completion.filled, 0)
    const pct = t === 0 ? 0 : Math.round((f / t) * 100)
    return { filled: f, total: t, pct }
  }, [visibleGroups])

  const missingCount = overall.total - overall.filled

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)

    if (hasLivestockArray) {
      const items = formData.livestock || []
      if (items.length === 0) {
        setLocalError('Хамгийн багадаа нэг мал нэмнэ үү')
        return
      }
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (!it.livestock_type || !it.count || !it.weight || !it.price_per_unit) {
          setLocalError(`${i + 1}-р мөрийн бүх талбарыг бөглөнө үү`)
          return
        }
        const errs = validateLivestockItem(it)
        if (Object.keys(errs).length > 0) {
          setLocalError(`${i + 1}-р мөрөнд алдаа байна: ${Object.values(errs)[0]}`)
          return
        }
      }
    }

    await onSubmit(formData)
  }

  const displayError = error || localError

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* ── Mobile stepper (horizontal scroll) ─────────────────── */}
      <div className="lg:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto
                      bg-white border-y border-gray-100 sticky top-24.25 z-20">
        <div className="flex gap-2 py-3 min-w-min">
          {visibleGroups.map((g) => {
            const Icon = g.meta.icon
            const isActive = activeStep === g.id
            const isDone = g.completion.complete
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => goToStep(g.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm
                            text-xs font-semibold border cursor-pointer transition-colors
                            ${isActive
                              ? 'bg-[#3d3a8c] text-white border-[#3d3a8c]'
                              : isDone
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-white text-gray-600 border-gray-200'}`}
              >
                {isDone ? <MdCheck size={13} /> : <Icon size={13} />}
                {g.title}
                <span className={`text-[10px] font-bold
                                  ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                  {g.completion.filled}/{g.completion.total}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-5">
        {/* ── Desktop stepper sidebar (sticky, viewport дотор үргэлж харагдана) ── */}
        <aside className="hidden lg:flex flex-col gap-3 self-start sticky top-28
                          max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
          {/* Overall progress card */}
          <div className="bg-white border border-gray-200 rounded-sm p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                Гүйцэтгэл
              </span>
              <span className="text-xs font-bold text-gray-900">
                {overall.filled} / {overall.total}
                <span className="text-[#3a8c3f] ml-1">· {overall.pct}%</span>
              </span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-cyan-400 to-[#46b2b2]
                           transition-all duration-500"
                style={{ width: `${overall.pct}%` }}
              />
            </div>
          </div>

          {/* Warning banner */}
          {missingCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-sm p-3
                            flex items-start gap-2">
              <MdWarningAmber size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 m-0 leading-snug">
                <span className="font-bold">{missingCount} талбар</span>
                {' '}бөглөгдөөгүй байна. Доорх хэсгүүдийг үргэлжлүүлж бөглөнө үү.
              </p>
            </div>
          )}

          {/* Steps */}
          <nav className="flex flex-col gap-2">
            {visibleGroups.map(g => (
              <StepCard
                key={g.id}
                group={g}
                active={activeStep === g.id}
                completion={g.completion}
                onClick={() => goToStep(g.id)}
              />
            ))}
          </nav>
        </aside>

        {/* ── Active section ─────────────────────────────────────── */}
        {/* Зөвхөн идэвхтэй step-ийн талбаруудыг харуулна (wizard mode) */}
        <div className="flex flex-col gap-4 min-w-0">
          {currentGroup && (() => {
            const g = currentGroup
            const Icon = g.meta.icon
            return (
              <section
                key={g.id}
                className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6"
              >
                {/* Section header */}
                <div className="flex items-start gap-3 mb-5 pb-4 border-b border-gray-100">
                  <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                                   ${g.completion.complete
                                     ? 'bg-emerald-50 text-emerald-600'
                                     : 'bg-[#3d3a8c]/10 text-[#3d3a8c]'}`}>
                    {g.completion.complete ? <MdCheck size={20} /> : <Icon size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-gray-900 m-0">
                        {g.title}
                      </h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded
                                        ${g.completion.complete
                                          ? 'bg-emerald-50 text-emerald-600'
                                          : 'bg-gray-100 text-gray-600'}`}>
                        {g.completion.filled}/{g.completion.total}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 m-0 mt-0.5">
                      {g.meta.subtitle}
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex shrink-0 text-[10px] font-semibold
                                   text-gray-400 uppercase tracking-wider">
                    Алхам {activeIndex + 1} / {visibleGroups.length}
                  </span>
                </div>

                {/* Fields grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {g.fields.map(f => (
                    <FormField
                      key={f.key}
                      field={f}
                      value={getNestedValue(formData, f.key)}
                      onChange={(v) => updateField(f.key, v)}
                      disabled={isAutoFill(f.key)}
                    />
                  ))}
                  {g.hasLivestock && (
                    <LivestockSection
                      items={formData.livestock || []}
                      onUpdate={updateLivestock}
                      onAdd={addLivestock}
                      onRemove={removeLivestock}
                    />
                  )}
                </div>

                {/* Step navigation (prev / next) */}
                <div className="flex items-center justify-between gap-2 mt-6 pt-5
                                border-t border-gray-100">
                  <button
                    type="button"
                    disabled={!prevGroup}
                    onClick={() => prevGroup && goToStep(prevGroup.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
                               text-gray-700 border border-gray-200 rounded-sm
                               hover:bg-gray-50 cursor-pointer bg-white
                               disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <MdArrowBack size={14} />
                    {prevGroup ? prevGroup.title : 'Өмнөх'}
                  </button>

                  {nextGroup ? (
                    <button
                      type="button"
                      onClick={() => goToStep(nextGroup.id)}
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold
                                 bg-[#4ec8cf] text-white rounded-sm
                                 hover:bg-teal-500 cursor-pointer border-0"
                    >
                      {nextGroup.title} <MdArrowForward size={14} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold
                                 bg-[#4ec8cf] text-white rounded-xl
                                 hover:bg-teal-500 cursor-pointer border-0
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MdSave size={14} />
                      {submitting ? 'Хадгалж байна...' : submitLabel}
                    </button>
                  )}
                </div>
              </section>
            )
          })()}

          {/* Error banner */}
          {displayError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3
                            flex items-start gap-2">
              <MdWarningAmber size={18} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 m-0 flex-1">{displayError}</p>
            </div>
          )}

          {/* Цуцлах товч (форм-аас гаргах) */}
          {onCancel && (
            <div className="hidden sm:flex pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-2.5 border border-gray-200 text-gray-700 text-sm
                           rounded-xl hover:bg-gray-50 cursor-pointer bg-white"
              >
                Цуцлах
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile sticky bottom action bar — prev / next эсвэл submit ── */}
      <div className="sm:hidden sticky bottom-0 left-0 right-0 -mx-4 px-4 py-3
                      bg-white/95 backdrop-blur border-t border-gray-200
                      flex items-center gap-2 z-30">
        <button
          type="button"
          disabled={!prevGroup}
          onClick={() => prevGroup && goToStep(prevGroup.id)}
          className="px-3 py-2.5 border border-gray-200 text-gray-700 text-sm
                     rounded-xl cursor-pointer bg-white inline-flex items-center
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <MdArrowBack size={16} />
        </button>
        {nextGroup ? (
          <button
            type="button"
            onClick={() => goToStep(nextGroup.id)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5
                       bg-[#3d3a8c] text-white text-sm font-semibold rounded-xl
                       cursor-pointer border-0"
          >
            Дараах <MdArrowForward size={16} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5
                       bg-teal-600 text-white text-sm font-semibold rounded-xl
                       disabled:opacity-50 cursor-pointer border-0"
          >
            <MdSave size={16} />
            {submitting ? 'Хадгалж байна...' : submitLabel}
          </button>
        )}
      </div>
    </form>
  )
}
