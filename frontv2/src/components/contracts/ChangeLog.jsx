'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import {
  MdHistory, MdPerson, MdNote, MdExpandMore, MdExpandLess,
  MdEdit, MdArrowForward,
} from 'react-icons/md'
import CONTRACT_FIELDS from '@/lib/contractFields'

// Field key → human label
const FIELD_LABELS = (() => {
  const map = {}
  CONTRACT_FIELDS.forEach(g => g.fields.forEach(f => { map[f.key] = f.label }))
  return map
})()

function labelFor(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key]
  if (key.startsWith('livestock')) return 'Малын жагсаалт'
  return key
}

function editorName(entry) {
  if (entry.first_name || entry.last_name) {
    return `${entry.last_name?.[0] ? entry.last_name[0] + '.' : ''} ${entry.first_name || ''}`.trim()
  }
  return 'Тодорхойгүй'
}

function formatTime(iso) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now - d
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'дөнгөж сая'
    if (mins < 60) return `${mins} минутын өмнө`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} цагийн өмнө`
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  } catch { return iso }
}

function shortValue(v) {
  if (v == null || v === '') return '—'
  if (Array.isArray(v)) return `${v.length} мөр`
  if (typeof v === 'object') return `{${Object.keys(v).length} талбар}`
  const s = String(v)
  return s.length > 30 ? s.slice(0, 30) + '…' : s
}

// Nested object-той diff entry-уудыг scalar талбарууд болгож задална.
// Жишээ: { "seller": { old: null, new: { name: "X", phone: "Y" } } }
//   →   { "seller.name": { old: null, new: "X" },
//          "seller.phone": { old: null, new: "Y" } }
// Backend computeJsonDiff-н хуучин логикоос үүссэн entry-уудад болон шинэ
// flat diff-уудад хоёуланд нь хамаатай (DB-д ямар нэг өөрчлөлт хийхгүй).
function flattenChanges(changed) {
  const out = {}
  const walk = (key, change) => {
    const oldIsObj = change.old && typeof change.old === 'object' && !Array.isArray(change.old)
    const newIsObj = change.new && typeof change.new === 'object' && !Array.isArray(change.new)
    if (oldIsObj || newIsObj) {
      const oldObj = oldIsObj ? change.old : {}
      const newObj = newIsObj ? change.new : {}
      const subKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])
      subKeys.forEach(sk => {
        const a = oldObj[sk]
        const b = newObj[sk]
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          walk(`${key}.${sk}`, { old: a ?? null, new: b ?? null })
        }
      })
    } else {
      out[key] = change
    }
  }
  Object.entries(changed || {}).forEach(([k, v]) => walk(k, v))
  return out
}

function ChangeRow({ keyName, change }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] py-0.5">
      <span className="text-gray-600 font-medium shrink-0">{labelFor(keyName)}:</span>
      <span className="text-gray-400 line-through truncate">{shortValue(change.old)}</span>
      <MdArrowForward size={11} className="text-gray-300 shrink-0" />
      <span className="text-gray-900 truncate">{shortValue(change.new)}</span>
    </div>
  )
}

function LogEntry({ entry, currentUserId }) {
  const [open, setOpen] = useState(false)
  // Nested object diff-уудыг scalar талбар болгож задална
  const fields = flattenChanges(entry.changed_fields || {})
  const keys = Object.keys(fields)
  const hasChanges = keys.length > 0
  const isMe = entry.edited_by === currentUserId

  return (
    <div className={`border rounded-lg p-2.5 ${isMe ? 'bg-blue-50/40 border-blue-100' : 'bg-white border-gray-200'}`}>
      <div className="flex items-start gap-2">
        <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                         ${isMe ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
          <MdPerson size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-gray-900">
              {editorName(entry)}
            </span>
            {isMe && <span className="text-[9px] text-gray-400">(Та)</span>}
            <span className="text-[10px] text-gray-400">·</span>
            <span className="text-[10px] text-gray-500">{formatTime(entry.edited_at)}</span>
          </div>

          {entry.note && (
            <div className="mt-1.5 flex items-start gap-1.5 px-2 py-1.5 bg-violet-50
                            border border-violet-100 rounded text-[11px] text-violet-900">
              <MdNote size={12} className="shrink-0 mt-0.5 text-violet-500" />
              <p className="m-0 leading-snug">{entry.note}</p>
            </div>
          )}

          {hasChanges && (
            <div className="mt-1.5">
              {keys.length <= 2 || open ? (
                <div className="flex flex-col">
                  {keys.map(k => <ChangeRow key={k} keyName={k} change={fields[k]} />)}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="text-[10px] text-[#3d3a8c] font-semibold inline-flex items-center
                             gap-0.5 cursor-pointer bg-transparent border-0 p-0
                             hover:underline"
                >
                  <MdEdit size={10} /> {keys.length} талбар өөрчилсөн
                  <MdExpandMore size={12} />
                </button>
              )}
              {open && keys.length > 2 && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-1 text-[10px] text-gray-500 inline-flex items-center gap-0.5
                             cursor-pointer bg-transparent border-0 p-0 hover:underline"
                >
                  <MdExpandLess size={12} /> Хураах
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ChangeLog({ contractId, currentUserId, refreshKey = 0 }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get(`/contracts/${contractId}/edit-log`)
      .then(res => { if (!cancelled) setEntries(res.data.data || []) })
      .catch(err => {
        if (!cancelled) setError(err.response?.data?.message || 'Алдаа гарлаа')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [contractId, refreshKey])

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500
                        inline-flex items-center gap-1">
          <MdHistory size={12} /> Өөрчлөлтийн түүх
        </div>
        <div className="text-xs text-gray-400 py-2">Уншиж байна...</div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error}
      </div>
    )
  }
  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500
                        inline-flex items-center gap-1">
          <MdHistory size={12} /> Өөрчлөлтийн түүх
        </div>
        <div className="text-[11px] text-gray-400 italic py-2">
          Хараахан өөрчлөлт хийгдээгүй
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 min-h-0">
      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500
                      inline-flex items-center gap-1 shrink-0">
        <MdHistory size={12} /> Өөрчлөлтийн түүх · {entries.length}
      </div>
      <div className="flex flex-col gap-1.5 overflow-y-auto pr-1 -mr-1 min-h-0">
        {entries.map(e => (
          <LogEntry key={e.edit_id} entry={e} currentUserId={currentUserId} />
        ))}
      </div>
    </div>
  )
}
