'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  MdSearch,
  MdShortText,
  MdNumbers,
  MdCalendarToday,
  MdNotes,
  MdArrowDropDownCircle,
  MdDraw,
  MdRepeat,
  MdExpandMore,
  MdExpandLess,
  MdAdd,
  MdClose,
  MdVisibility,
  MdEdit,
  MdAutoAwesome,
  MdDragIndicator,
} from 'react-icons/md'
import api from '@/lib/api'
import CONTRACT_FIELDS, {
  buildSchemaJson, extractCustomFields, CUSTOM_FIELD_TYPES,
} from '@/lib/contractFields'
import { renderChips } from '@/lib/templateRender'
import TemplatePreview from '@/components/templates/TemplatePreview'
import CustomFieldModal from '@/components/templates/CustomFieldModal'

// ── Field-ийн өнгө ────────────────────────────────────
const FIELD_COLORS = {
  default:   { bg: '#EEEDFE', border: '#AFA9EC', text: '#3C3489', dot: '#7166D9' },
  teal:      { bg: '#E1F5EE', border: '#5DCAA5', text: '#085041', dot: '#1D9E75' },
  green:     { bg: '#E1F5EE', border: '#1D9E75', text: '#04342C', dot: '#1D9E75' },
  signature: { bg: '#EAF3DE', border: '#97C459', text: '#173404', dot: '#5A8A2A' },
  auto:      { bg: '#FFF8E1', border: '#FFD54F', text: '#7B5E00', dot: '#C39B00' },
  custom:    { bg: '#FEF3F2', border: '#FECDCA', text: '#9F1239', dot: '#E11D48' },
}

const getColor = (field) => {
  if (!field) return FIELD_COLORS.default
  if (field.custom) return FIELD_COLORS.custom
  if (field.type === 'signature') return FIELD_COLORS.signature
  if (field.color) return FIELD_COLORS[field.color] || FIELD_COLORS.default
  if (field.auto) return FIELD_COLORS.auto
  return FIELD_COLORS.default
}

// ── Field type → icon ─────────────────────────────────
const TYPE_ICONS = {
  text:       MdShortText,
  number:     MdNumbers,
  float:      MdNumbers,
  date:       MdCalendarToday,
  textarea:   MdNotes,
  select:     MdArrowDropDownCircle,
  signature:  MdDraw,
  each_start: MdRepeat,
  each_end:   MdRepeat,
}

const FieldIcon = ({ field, size = 14, color }) => {
  const Icon = TYPE_ICONS[field.type] || MdShortText
  return <Icon size={size} color={color} />
}

// ── Нэг draggable field (sidebar мөр) ─────────────────
function DraggableField({ field, onInsert }) {
  const c = getColor(field)

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', `{{${field.key}}}`)
    e.dataTransfer.setData('field-key', field.key)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      title={`{{${field.key}}}`}
      style={{ borderColor: c.border, background: c.bg }}
      className="group flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-grab
                 active:cursor-grabbing hover:shadow-sm hover:-translate-y-px transition-all
                 mb-1.5 select-none"
    >
      <MdDragIndicator size={14} className="text-gray-400 shrink-0 -ml-1" />
      <span
        style={{ background: c.dot }}
        className="w-1.5 h-1.5 rounded-full shrink-0"
      />
      <FieldIcon field={field} color={c.text} />
      <div className="flex-1 min-w-0">
        <p style={{ color: c.text }} className="text-xs font-medium truncate leading-tight">
          {field.label}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {field.auto && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500">
              <MdAutoAwesome size={9} /> авто
            </span>
          )}
          {field.optional && (
            <span className="text-[10px] text-gray-400">заавал биш</span>
          )}
          {field.type && !['text'].includes(field.type) && (
            <span className="text-[10px] text-gray-400 capitalize">{field.type}</span>
          )}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onInsert(field.key) }}
        title="Cursor байрлалд оруулах"
        className="opacity-0 group-hover:opacity-100 transition-opacity
                   w-5 h-5 flex items-center justify-center rounded
                   bg-white border border-gray-200 hover:bg-gray-50 shrink-0 cursor-pointer"
      >
        <MdAdd size={12} className="text-gray-600" />
      </button>
    </div>
  )
}

// ── Sidebar групп — collapsible + хайлт filter ───────
function FieldGroup({ group, query, collapsed, onToggle, onInsert }) {
  const filtered = useMemo(() => {
    if (!query) return group.fields
    const q = query.toLowerCase()
    return group.fields.filter(
      f => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)
    )
  }, [group.fields, query])

  if (filtered.length === 0) return null

  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-1.5 py-1 rounded
                   hover:bg-gray-100 transition-colors text-left cursor-pointer bg-transparent border-0"
      >
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          {group.group}
          <span className="ml-1.5 text-gray-400 normal-case font-normal">
            ({filtered.length})
          </span>
        </span>
        {collapsed
          ? <MdExpandMore size={16} className="text-gray-400" />
          : <MdExpandLess size={16} className="text-gray-400" />}
      </button>
      {!collapsed && (
        <div className="mt-1">
          {filtered.map((field, i) => (
            <DraggableField key={i} field={field} onInsert={onInsert} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Гол Template Editor ───────────────────────────────
function TemplateEditor({ onSaved, editing, onCancel }) {
  const [name,        setName]        = useState(editing?.name || '')
  const [description, setDescription] = useState(editing?.description || '')
  const [isStandard,  setIsStandard]  = useState(editing?.is_standard || false)
  const [isOffline,   setIsOffline]   = useState(editing?.is_offline_enabled || false)
  const [content,     setContent]     = useState(editing?.template_content || '')
  const [preview,     setPreview]     = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [dragOver,    setDragOver]    = useState(false)
  const [query,       setQuery]       = useState('')
  const [collapsed,   setCollapsed]   = useState({}) // { groupName: true }

  // ── Custom fields (admin-аас үүсгэсэн хувийн талбарууд) ────
  const [customFields, setCustomFields] = useState(
    () => extractCustomFields(editing?.schema_json)
  )
  const [modalOpen,    setModalOpen]    = useState(false)
  const [modalType,    setModalType]    = useState('text')
  const [editingField, setEditingField] = useState(null)

  const textareaRef = useRef(null)
  const cursorPosRef = useRef(null)

  // Cursor байрлал хадгалах
  const saveCursor = () => {
    if (textareaRef.current) {
      cursorPosRef.current = textareaRef.current.selectionStart
    }
  }

  // Cursor байрлалд placeholder оруулах (drag болон click insert)
  const insertAtCursor = (placeholder) => {
    const ta = textareaRef.current
    const pos = cursorPosRef.current ?? content.length
    const before = content.slice(0, pos)
    const after  = content.slice(pos)
    const newContent = `${before}${placeholder}${after}`
    setContent(newContent)

    setTimeout(() => {
      if (!ta) return
      ta.focus()
      const newPos = pos + placeholder.length
      ta.setSelectionRange(newPos, newPos)
      cursorPosRef.current = newPos
    }, 0)
  }

  const handleInsertKey = (key) => insertAtCursor(`{{${key}}}`)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const placeholder = e.dataTransfer.getData('text/plain')
    if (!placeholder) return

    // Хэрэв drop координат-аас cursor байрлал авч чадвал тэр байрлалд тавина
    const ta = textareaRef.current
    if (ta && document.caretPositionFromPoint) {
      const range = document.caretPositionFromPoint(e.clientX, e.clientY)
      if (range && range.offsetNode === ta) {
        cursorPosRef.current = range.offset
      }
    } else if (ta && document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(e.clientX, e.clientY)
      if (range) cursorPosRef.current = range.startOffset
    }

    insertAtCursor(placeholder)
  }

  // Used keys + позиц
  const usedMatches = useMemo(
    () => [...content.matchAll(/\{\{([^}]+)\}\}/g)].map(m => ({
      key:   m[1],
      start: m.index,
      end:   m.index + m[0].length,
    })),
    [content]
  )
  const usedKeys = [...new Set(usedMatches.map(m => m.key))]
  const charCount = content.length

  const allFieldsFlat = useMemo(
    () => [
      ...CONTRACT_FIELDS.flatMap(g => g.fields),
      ...customFields.map(f => ({ ...f, custom: true })),
    ],
    [customFields]
  )

  // Custom field action-ууд
  const openCreateModal = (type) => {
    setModalType(type)
    setEditingField(null)
    setModalOpen(true)
  }
  const openEditModal = (field) => {
    setEditingField(field)
    setModalType(field.type)
    setModalOpen(true)
  }
  const handleSaveCustomField = (field) => {
    setCustomFields(prev => {
      if (editingField) {
        return prev.map(f => f.key === editingField.key ? field : f)
      }
      return [...prev, field]
    })
    // Засаж байгаа field-ийн key-г өөрчилсөн бол template_content-д шинэчлэх
    if (editingField && editingField.key !== field.key) {
      const re = new RegExp(`\\{\\{${editingField.key}\\}\\}`, 'g')
      setContent(c => c.replace(re, `{{${field.key}}}`))
    }
  }
  const handleDeleteCustomField = (key) => {
    if (!confirm(`"${key}" талбарыг устгах уу? Template дотроос ч устгагдана.`)) return
    setCustomFields(prev => prev.filter(f => f.key !== key))
    // Template-аас placeholder арилгана
    setContent(c => c.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), ''))
  }

  // Right panel — chip дээр дарвал textarea-д тэр placeholder сонгох
  const handleUsedClick = (match) => {
    setPreview(false)
    setTimeout(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(match.start, match.end)
      // scroll to roughly that line
      const approxLine = content.slice(0, match.start).split('\n').length - 1
      const lineHeight = 26 // ~ leading-loose @ 13px
      ta.scrollTop = Math.max(0, approxLine * lineHeight - 100)
      cursorPosRef.current = match.end
    }, 0)
  }

  // Used field устгах
  const handleUsedRemove = (match) => {
    const before = content.slice(0, match.start)
    const after  = content.slice(match.end)
    setContent(before + after)
    cursorPosRef.current = match.start
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const toggleGroup = (groupName) =>
    setCollapsed(c => ({ ...c, [groupName]: !c[groupName] }))

  // Approx page count
  const approxPages = Math.max(1, Math.ceil(content.split('\n').length / 35))

  const handleSubmit = async () => {
    if (!name)    return setError('Загварын нэр шаардлагатай')
    if (!content) return setError('Гэрээний текст шаардлагатай')
    if (!usedKeys.length) return setError('Хамгийн нэг placeholder нэмнэ үү')

    setLoading(true)
    setError(null)
    try {
      const schema_json = buildSchemaJson(usedKeys, customFields)
      const body = { name, description, template_content: content, schema_json, is_standard: isStandard, is_offline_enabled: isOffline }

      if (editing) {
        await api.patch(`/admin/templates/${editing.template_id}`, body)
      } else {
        await api.post('/admin/templates', body)
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.message || 'Алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Нэр + тайлбар + стандарт + offline */}
      <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Загварын нэр *</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Мал худалдах гэрээ"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm
                       outline-none focus:border-[#1e1b4b] focus:ring-2 focus:ring-[#1e1b4b]/10" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Тайлбар</label>
          <input value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Загварын тайлбар..."
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm
                       outline-none focus:border-[#1e1b4b] focus:ring-2 focus:ring-[#1e1b4b]/10" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer
                          px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-50
                          whitespace-nowrap">
          <input type="checkbox" checked={isStandard}
            onChange={e => setIsStandard(e.target.checked)}
            className="accent-[#1e1b4b] w-4 h-4" />
          Стандарт загвар
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer
                          px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-50
                          whitespace-nowrap"
          title="Offline горим сонгоход энэ загвар локалд кэшлэгдэж, сүлжээгүй үед ашиглах боломжтой болно">
          <input type="checkbox" checked={isOffline}
            onChange={e => setIsOffline(e.target.checked)}
            className="accent-[#16a34a] w-4 h-4" />
          Offline боломжтой
        </label>
      </div>

      {/* Гол layout — sidebar + editor + used */}
      <div className="grid grid-cols-[260px_1fr_240px] gap-3" style={{ height: '600px' }}>

        {/* LEFT — Sidebar */}
        <div className="flex flex-col border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="px-3 py-2.5 border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-[#1e1b4b]/10 flex items-center justify-center">
                <MdDragIndicator size={14} className="text-[#1e1b4b]" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-800 leading-tight">Талбарууд</p>
                <p className="text-[10px] text-gray-400 leading-tight">Чирж эсвэл + дарж нэмнэ</p>
              </div>
            </div>
            <div className="relative">
              <MdSearch
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Талбар хайх..."
                className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs
                           outline-none focus:border-[#1e1b4b] bg-gray-50 focus:bg-white"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">

            {/* ── + Шинэ талбар (Custom) ─────────────────── */}
            <div className="mb-3 p-2 rounded-lg bg-linear-to-br from-rose-50 to-pink-50
                            border border-rose-100">
              <p className="text-[10px] font-semibold text-rose-700 uppercase tracking-wider mb-1.5 px-0.5">
                + Хувийн талбар нэмэх
              </p>
              <div className="grid grid-cols-5 gap-1">
                {CUSTOM_FIELD_TYPES.map(t => {
                  const Icon = TYPE_ICONS[t.value] || MdShortText
                  return (
                    <button
                      key={t.value}
                      onClick={() => openCreateModal(t.value)}
                      title={`${t.label} — ${t.hint}`}
                      className="flex flex-col items-center gap-0.5 py-1.5 rounded-md
                                 bg-white border border-rose-200 text-rose-700
                                 hover:bg-rose-100 hover:border-rose-300 hover:shadow-sm
                                 transition-all cursor-pointer"
                    >
                      <Icon size={13} />
                      <span className="text-[9px] font-semibold leading-none">{t.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Custom fields list ──────────────────────── */}
            {customFields.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between px-1.5 py-1">
                  <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wide">
                    Хувийн талбарууд
                    <span className="ml-1.5 text-rose-400 normal-case font-normal">
                      ({customFields.length})
                    </span>
                  </span>
                </div>
                <div className="mt-1">
                  {customFields
                    .filter(f => !query ||
                      f.label.toLowerCase().includes(query.toLowerCase()) ||
                      f.key.toLowerCase().includes(query.toLowerCase()))
                    .map((field) => (
                      <CustomDraggableField
                        key={field.key}
                        field={field}
                        onInsert={handleInsertKey}
                        onEdit={() => openEditModal(field)}
                        onDelete={() => handleDeleteCustomField(field.key)}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* ── Preset groups ──────────────────────────── */}
            {CONTRACT_FIELDS.map((group, gi) => (
              <FieldGroup
                key={gi}
                group={group}
                query={query}
                collapsed={!!collapsed[group.group]}
                onToggle={() => toggleGroup(group.group)}
                onInsert={handleInsertKey}
              />
            ))}
            {query &&
             customFields.every(f =>
               !f.label.toLowerCase().includes(query.toLowerCase()) &&
               !f.key.toLowerCase().includes(query.toLowerCase())
             ) &&
             CONTRACT_FIELDS.every(g =>
               g.fields.every(f =>
                 !f.label.toLowerCase().includes(query.toLowerCase()) &&
                 !f.key.toLowerCase().includes(query.toLowerCase())
               )
             ) && (
              <p className="text-xs text-gray-400 text-center py-6">
                Тохирох талбар олдсонгүй
              </p>
            )}
          </div>
        </div>

        {/* CENTER — Document editor */}
        <div className="flex flex-col border border-gray-200 rounded-xl overflow-hidden bg-white">
          {/* Top toolbar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-b from-gray-50 to-white
                          border-b border-gray-200">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[#EEEDFE] text-[#3C3489]
                            rounded-md text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7166D9]" />
              {usedKeys.length} placeholder
            </div>
            <div className="text-xs text-gray-400">
              ~{approxPages} хуудас · {charCount.toLocaleString()} тэмдэгт
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => setPreview(false)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md
                            border transition-colors cursor-pointer ${
                  !preview
                    ? 'bg-[#1e1b4b] text-white border-[#1e1b4b]'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MdEdit size={12} /> Засах
              </button>
              <button
                onClick={() => setPreview(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md
                            border transition-colors cursor-pointer ${
                  preview
                    ? 'bg-[#1e1b4b] text-white border-[#1e1b4b]'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MdVisibility size={12} /> Урьдчилан харах
              </button>
            </div>
          </div>

          {/* Editor / Preview */}
          <div className="flex-1 relative overflow-hidden">
            {preview ? (
              <div
                className="absolute inset-0 overflow-y-auto p-10 bg-white"
                style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '13px',
                  lineHeight: '2',
                  whiteSpace: 'pre-wrap',
                }}
                dangerouslySetInnerHTML={{ __html: renderChips(content) }}
              />
            ) : (
              <>
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  onSelect={saveCursor}
                  onClick={saveCursor}
                  onKeyUp={saveCursor}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  placeholder={`Гэрээний бүтэн текстийг энд бичнэ үү.\n\nЖишээ:\nМАЛ ХУДАЛДАХ ГЭРЭЭ\n\nДугаар {{contract_number}}\n{{year}} он {{month}} сар {{day}} өдөр\n\nНэг талаас {{seller.name}}...\n\nТалбаруудыг зүүнээс чирж энд тавина.`}
                  className="absolute text-black inset-0 resize-none outline-none p-10 leading-loose"
                  style={{
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    fontSize: '13px',
                    lineHeight: '2',
                    background: '#fff',
                    transition: 'background .15s',
                  }}
                />
                {/* Drag overlay */}
                {dragOver && (
                  <div className="absolute inset-3 rounded-lg border-2 border-dashed
                                  border-[#1e1b4b]  flex items-center justify-center
                                  pointer-events-none animate-pulse">
                    <div className="flex flex-col items-center gap-2 px-6 py-4 bg-white/90 rounded-xl
                                    shadow-lg border border-[#1e1b4b]/20">
                      <MdAdd size={28} className="text-[#1e1b4b]" />
                      <p className="text-sm font-semibold text-[#1e1b4b]">
                        Энд тавиад placeholder болгоно уу
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Status bar */}
          <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200
                          flex items-center justify-between text-[11px] text-gray-500">
            <div className="flex items-center gap-3">
              <span>
                {preview
                  ? 'Урьдчилан харах горим — chip-үүд жинхэнэ үед хэрхэн харагдахыг үзүүлж байна'
                  : 'Засах горим — placeholder-уудыг {{...}} хэлбэрээр шууд бичих, эсвэл чирж нэмэх'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {!preview && cursorPosRef.current !== null && (
                <span>cursor {cursorPosRef.current}</span>
              )}
              <span>{usedKeys.length} placeholder</span>
            </div>
          </div>
        </div>

        {/* RIGHT — Used placeholders */}
        <div className="flex flex-col border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="px-3 py-2.5 border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white">
            <p className="text-xs font-semibold text-gray-800">Ашигласан талбарууд</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Schema автомат үүснэ · дарж байрлалд очно
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {usedMatches.length === 0 ? (
              <div className="text-center px-3 py-8">
                <div className="w-10 h-10 rounded-full bg-gray-100 mx-auto mb-2
                                flex items-center justify-center">
                  <MdAdd size={18} className="text-gray-400" />
                </div>
                <p className="text-xs text-gray-400">
                  Талбар нэмэгдэхгүй байна
                </p>
                <p className="text-[10px] text-gray-300 mt-1">
                  Зүүн талаас чирж нэмнэ үү
                </p>
              </div>
            ) : (
              usedMatches.map((m, i) => {
                const field = allFieldsFlat.find(f => f.key === m.key)
                const c = getColor(field)
                return (
                  <div
                    key={i}
                    onClick={() => handleUsedClick(m)}
                    style={{ background: c.bg, borderColor: c.border }}
                    className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg border
                               mb-1.5 cursor-pointer hover:shadow-sm transition-all"
                    title="Дарж editor-т сонгох"
                  >
                    <span
                      style={{ background: c.dot }}
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                    />
                    {field && <FieldIcon field={field} color={c.text} size={12} />}
                    <span
                      style={{ color: c.text }}
                      className="flex-1 min-w-0 text-[11px] font-medium truncate"
                    >
                      {field?.label || m.key}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUsedRemove(m) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity
                                 w-4 h-4 flex items-center justify-center rounded
                                 hover:bg-white/70 shrink-0 cursor-pointer bg-transparent border-0"
                      title="Устгах"
                    >
                      <MdClose size={10} style={{ color: c.text }} />
                    </button>
                  </div>
                )
              })
            )}

            {/* Schema JSON preview */}
            {usedKeys.length > 0 && (
              <details className="mt-3">
                <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-black px-1
                                    select-none">
                  Schema JSON харах
                </summary>
                <pre className="mt-1.5 p-2 bg-gray-900 text-green-400 text-[10px] rounded-lg
                                overflow-auto max-h-48 whitespace-pre-wrap leading-snug">
{JSON.stringify(buildSchemaJson(usedKeys, customFields), null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>

      {/* Footer buttons */}
      <div className="flex gap-3 pt-1">
        <button onClick={handleSubmit} disabled={loading}
          className="px-6 py-2.5 bg-[#1e1b4b] text-white text-sm font-semibold rounded-xl
                     hover:bg-[#2d2a6e] disabled:opacity-40 disabled:cursor-not-allowed
                     cursor-pointer border-0 shadow-sm">
          {loading ? 'Хадгалж байна...' : editing ? 'Хадгалах' : 'Загвар үүсгэх'}
        </button>
        {onCancel && (
          <button onClick={onCancel}
            className="px-5 py-2.5 border border-gray-200 text-gray-700 text-sm rounded-xl
                       hover:bg-gray-50 cursor-pointer bg-white">
            Цуцлах
          </button>
        )}
      </div>

      {/* Custom field modal */}
      <CustomFieldModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveCustomField}
        defaultType={modalType}
        editing={editingField}
        existingKeys={new Set(customFields.map(f => f.key))}
      />
    </div>
  )
}

// ── Custom draggable field — edit/delete товчуудтай ───
function CustomDraggableField({ field, onInsert, onEdit, onDelete }) {
  const c = FIELD_COLORS.custom
  const Icon = TYPE_ICONS[field.type] || MdShortText

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', `{{${field.key}}}`)
    e.dataTransfer.setData('field-key', field.key)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      title={`{{${field.key}}} · ${field.type}`}
      style={{ borderColor: c.border, background: c.bg }}
      className="group flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-grab
                 active:cursor-grabbing hover:shadow-sm hover:-translate-y-px transition-all
                 mb-1.5 select-none"
    >
      <MdDragIndicator size={14} className="text-gray-400 shrink-0 -ml-1" />
      <span style={{ background: c.dot }} className="w-1.5 h-1.5 rounded-full shrink-0" />
      <Icon size={14} color={c.text} />
      <div className="flex-1 min-w-0">
        <p style={{ color: c.text }} className="text-xs font-medium truncate leading-tight">
          {field.label}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] font-mono text-gray-500 truncate">{field.key}</span>
          <span className="text-[9px] text-gray-400 capitalize">· {field.type}</span>
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onInsert(field.key) }}
          title="Cursor байрлалд оруулах"
          className="w-5 h-5 flex items-center justify-center rounded
                     bg-white border border-gray-200 hover:bg-gray-50 cursor-pointer"
        >
          <MdAdd size={12} className="text-gray-600" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          title="Засах"
          className="w-5 h-5 flex items-center justify-center rounded
                     bg-white border border-gray-200 hover:bg-gray-50 cursor-pointer"
        >
          <MdEdit size={10} className="text-gray-600" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Устгах"
          className="w-5 h-5 flex items-center justify-center rounded
                     bg-white border border-red-200 hover:bg-red-50 cursor-pointer"
        >
          <MdClose size={10} className="text-red-500" />
        </button>
      </div>
    </div>
  )
}

// ── Үндсэн хуудас ─────────────────────────────────────
export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [creating,  setCreating]  = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [previewing,    setPreviewing]    = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [message,   setMessage]   = useState(null)

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/templates')
      setTemplates(res.data.data || [])
    } catch (_) {}
    finally { setLoading(false) }
  }

  useEffect(() => { fetchTemplates() }, [])

  const fetchFullTemplate = async (id) => {
    const res = await api.get(`/admin/templates/${id}`)
    return res.data.data
  }

  const handleRowClick = async (id) => {
    setPreviewLoading(true)
    setPreviewing({})
    try {
      const full = await fetchFullTemplate(id)
      setPreviewing(full)
    } catch (err) {
      setPreviewing(null)
      setMessage({ type: 'error', text: err.response?.data?.message || 'Загвар татаж чадсангүй' })
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleEdit = async (id) => {
    try {
      const full = await fetchFullTemplate(id)
      setEditing(full)
      setCreating(false)
      window.scrollTo(0, 0)
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Загвар татаж чадсангүй' })
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`"${name}" устгах уу?`)) return
    try {
      await api.delete(`/admin/templates/${id}`)
      setMessage({ type: 'success', text: 'Устгагдлаа' })
      fetchTemplates()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Алдаа' })
    }
  }

  const onSaved = () => {
    setCreating(false)
    setEditing(null)
    setMessage({ type: 'success', text: 'Загвар хадгалагдлаа' })
    fetchTemplates()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Гэрээний загварууд</h1>
          <p className="text-sm text-gray-500 mt-1">
            Талбаруудыг гэрээний текст дээр чирж placeholder тавина
          </p>
        </div>
        {!creating && !editing && (
          <button onClick={() => setCreating(true)}
            className="px-5 py-2.5 bg-[#1e1b4b] text-white text-sm font-semibold
                       rounded-xl hover:bg-[#2d2a6e] cursor-pointer border-0 shadow-sm">
            + Шинэ загвар
          </button>
        )}
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm border ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          {message.text}
        </div>
      )}

      {/* Editor */}
      {(creating || editing) && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-5">
            {editing ? 'Загвар засах' : 'Шинэ загвар үүсгэх'}
          </h2>
          <TemplateEditor
            onSaved={onSaved}
            editing={editing}
            onCancel={() => { setCreating(false); setEditing(null) }}
          />
        </div>
      )}

      {/* Template жагсаалт */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 rounded-t-2xl
                        grid grid-cols-[2fr_1fr_1fr_1fr_100px] gap-4
                        text-xs font-semibold text-gray-500 uppercase">
          <span>Нэр</span><span>Статус</span>
          <span>Placeholder</span><span>Огноо</span><span></span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-[#1e1b4b] rounded-full animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">
            Загвар байхгүй байна. Шинэ загвар үүсгэнэ үү.
          </div>
        ) : templates.map((t, i) => (
          <div key={t.template_id}
            onClick={() => handleRowClick(t.template_id)}
            title="Дарж preview харах"
            className={`grid grid-cols-[2fr_1fr_1fr_1fr_100px] gap-4 px-5 py-4
                        items-center text-sm cursor-pointer hover:bg-gray-50 transition-colors
                        ${i < templates.length - 1 ? 'border-b border-gray-100' : ''}`}>
            <div>
              <p className="font-medium text-gray-900">{t.name}</p>
              {t.description && <p className="text-xs text-gray-400">{t.description}</p>}
            </div>
            <div className="flex flex-wrap gap-1">
              <span className={`px-2 py-0.5 rounded-lg text-xs font-medium w-fit ${
                t.is_standard
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {t.is_standard ? 'Стандарт' : 'Хувийн'}
              </span>
              {t.is_offline_enabled && (
                <span className="px-2 py-0.5 rounded-lg text-xs font-medium w-fit
                                 bg-green-50 text-green-700">
                  Offline
                </span>
              )}
            </div>
            <span className="text-gray-500 text-xs">
              {t.schema_json?.fields?.length || 0} талбар
            </span>
            <span className="text-gray-400 text-xs">
              {t.created_at ? new Date(t.created_at).toLocaleDateString('mn-MN') : '—'}
            </span>
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => handleEdit(t.template_id)}
                className="px-2 py-1 text-xs text-black border border-gray-200
                           rounded-lg hover:bg-gray-50 cursor-pointer bg-white">
                Засах
              </button>
              <button
                onClick={() => handleDelete(t.template_id, t.name)}
                className="px-2 py-1 text-xs text-red-500 border border-red-200
                           rounded-lg hover:bg-red-50 cursor-pointer bg-white">
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview modal */}
      {previewing !== null && (
        <TemplatePreview
          template={previewing}
          loading={previewLoading}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  )
}
