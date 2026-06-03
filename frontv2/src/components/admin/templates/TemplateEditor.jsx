'use client'
import { useState, useRef, useMemo } from 'react'
import {
  MdSearch,
  MdAdd,
  MdClose,
  MdVisibility,
  MdEdit,
  MdShortText,
  MdDragIndicator,
} from 'react-icons/md'
import api from '@/lib/api'
import CONTRACT_FIELDS, {
  buildSchemaJson, extractCustomFields, CUSTOM_FIELD_TYPES,
} from '@/lib/contractFields'
import { renderChips } from '@/lib/templateRender'
import CustomFieldModal from '@/components/templates/CustomFieldModal'
import { getColor, TYPE_ICONS, FieldIcon } from './fieldStyles'
import FieldGroup from './FieldGroup'
import CustomDraggableField from './CustomDraggableField'

// ── Гол Template Editor ───────────────────────────────
export default function TemplateEditor({ onSaved, editing, onCancel }) {
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
          <div className="px-3 py-2.5 border-b border-gray-200 bg-linear-to-b from-gray-50 to-white">
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
          <div className="flex items-center gap-2 px-3 py-2 bg-linear-to-b from-gray-50 to-white
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
          <div className="px-3 py-2.5 border-b border-gray-200 bg-linear-to-b from-gray-50 to-white">
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
