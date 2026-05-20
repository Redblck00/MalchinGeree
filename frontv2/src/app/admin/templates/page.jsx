'use client'
import { useState, useEffect, useRef } from 'react'
import api from '@/lib/api'
import CONTRACT_FIELDS, { buildSchemaJson } from '@/lib/contractFields'
import { renderChips } from '@/lib/templateRender'
import TemplatePreview from '@/components/templates/TemplatePreview'

// ── Field-ийн өнгө ────────────────────────────────────
const FIELD_COLORS = {
  default:   { bg: '#EEEDFE', border: '#AFA9EC', text: '#3C3489' },
  teal:      { bg: '#E1F5EE', border: '#5DCAA5', text: '#085041' },
  green:     { bg: '#E1F5EE', border: '#1D9E75', text: '#04342C' },
  signature: { bg: '#EAF3DE', border: '#97C459', text: '#173404' },
}

const getColor = (field) => {
  if (field.type === 'signature') return FIELD_COLORS.signature
  if (field.color) return FIELD_COLORS[field.color] || FIELD_COLORS.default
  return FIELD_COLORS.default
}

// ── Нэг draggable field ───────────────────────────────
function DraggableField({ field }) {
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
      className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-grab
                 active:cursor-grabbing hover:shadow-sm transition-all mb-1.5 select-none"
    >
      <span style={{ background: c.border }} className="w-2 h-2 rounded-full shrink-0" />
      <div className="flex-1 min-w-0">
        <p style={{ color: c.text }} className="text-xs font-medium truncate">{field.label}</p>
        {field.auto && <p className="text-xs text-gray-400">автомат</p>}
        {field.optional && <p className="text-xs text-gray-400">заавал биш</p>}
      </div>
    </div>
  )
}

// ── Template Form ─────────────────────────────────────
function TemplateEditor({ onSaved, editing, onCancel }) {
  const [name,        setName]        = useState(editing?.name || '')
  const [description, setDescription] = useState(editing?.description || '')
  const [isStandard,  setIsStandard]  = useState(editing?.is_standard || false)
  const [content,     setContent]     = useState(editing?.template_content || '')
  const [preview,     setPreview]     = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [dragOver,    setDragOver]    = useState(false)
  const textareaRef = useRef(null)
  const cursorPosRef = useRef(null)

  // Textarea cursor байрлалыг хадгалах
  const saveCursor = () => {
    if (textareaRef.current) {
      cursorPosRef.current = textareaRef.current.selectionStart
    }
  }

  // Drop хийхэд cursor байрлалд placeholder оруулах
  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const placeholder = e.dataTransfer.getData('text/plain')
    if (!placeholder) return

    const ta = textareaRef.current
    if (!ta) return

    // Drop байрлал тодорхойлох
    const pos = cursorPosRef.current ?? content.length
    const before = content.slice(0, pos)
    const after  = content.slice(pos)
    const newContent = `${before}${placeholder}${after}`
    setContent(newContent)

    // Cursor placeholder-ийн ардаас үргэлжлүүлэх
    setTimeout(() => {
      ta.focus()
      const newPos = pos + placeholder.length
      ta.setSelectionRange(newPos, newPos)
      cursorPosRef.current = newPos
    }, 0)
  }

  // Usedkeys-аас schema үүсгэх
  const usedKeys = [...content.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1])

  const handleSubmit = async () => {
    if (!name)    return setError('Загварын нэр шаардлагатай')
    if (!content) return setError('Гэрээний текст шаардлагатай')
    if (!usedKeys.length) return setError('Хамгийн нэг placeholder нэмнэ үү')

    setLoading(true)
    setError(null)
    try {
      const schema_json = buildSchemaJson(usedKeys)
      const body = { name, description, template_content: content, schema_json, is_standard: isStandard }

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

      {/* Нэр + тохиргоо */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-black mb-1 block">Загварын нэр *</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Мал худалдах гэрээ"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm
                       outline-none focus:border-[#1e1b4b]" />
        </div>
        <div>
          <label className="text-xs font-medium text-black mb-1 block">Тайлбар</label>
          <input value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Загварын тайлбар..."
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm
                       outline-none focus:border-[#1e1b4b]" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer w-fit">
        <input type="checkbox" checked={isStandard}
          onChange={e => setIsStandard(e.target.checked)}
          className="accent-[#1e1b4b] w-4 h-4" />
        Стандарт загвар (бүх хэрэглэгчид харагдана)
      </label>

      {/* Гол editor + sidebar */}
      <div className="flex gap-3" style={{ height: '520px' }}>

        {/* LEFT — Field sidebar */}
        <div className="w-56 shrink-0 border border-gray-200 rounded-xl overflow-y-auto bg-gray-50">
          <div className="px-3 py-2.5 border-b border-gray-200 bg-white">
            <p className="text-xs font-semibold text-gray-700">Талбарууд</p>
            <p className="text-xs text-gray-400 mt-0.5">Текст дээр чирж тавина</p>
          </div>
          <div className="p-2">
            {CONTRACT_FIELDS.map((group, gi) => (
              <div key={gi} className="mb-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide
                              px-1 mb-1.5">{group.group}</p>
                {group.fields.map((field, fi) => (
                  <DraggableField key={fi} field={field} />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* CENTER — Document editor */}
        <div className="flex-1 flex flex-col border border-gray-200 rounded-xl overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-xs text-gray-500">
              {usedKeys.length} placeholder ашигласан
            </span>
            <button
              onClick={() => setPreview(p => !p)}
              className={`ml-auto px-3 py-1 text-xs rounded-lg border transition-colors ${
                preview
                  ? 'bg-[#1e1b4b] text-white border-[#1e1b4b]'
                  : 'border-gray-200 text-black hover:bg-gray-100'
              }`}>
              {preview ? 'Засах' : 'Preview'}
            </button>
          </div>

          {/* Editor / Preview */}
          {preview ? (
            <div
              className="flex-1 overflow-y-auto p-8 bg-white"
              style={{
                fontFamily: 'serif',
                fontSize: '14px',
                lineHeight: '2',
                whiteSpace: 'pre-wrap',
              }}
              dangerouslySetInnerHTML={{ __html: renderChips(content) }}
            />
          ) : (
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
              className="flex-1 resize-none outline-none p-8 font-mono text-sm leading-loose"
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: '13px',
                lineHeight: '2',
                background: dragOver ? '#EEEDFE' : '#fff',
                transition: 'background .15s',
              }}
            />
          )}
        </div>

        {/* RIGHT — Used placeholders */}
        <div className="w-52 shrink-0 border border-gray-200 rounded-xl overflow-y-auto bg-gray-50">
          <div className="px-3 py-2.5 border-b border-gray-200 bg-white">
            <p className="text-xs font-semibold text-gray-700">Ашигласан талбарууд</p>
            <p className="text-xs text-gray-400 mt-0.5">Schema автомат үүснэ</p>
          </div>
          <div className="p-2">
            {usedKeys.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-3 text-center">
                Талбар нэмэгдэхгүй байна
              </p>
            ) : (
              usedKeys.map((key, i) => {
                const allFields = CONTRACT_FIELDS.flatMap(g => g.fields)
                const field = allFields.find(f => f.key === key)
                const c = field ? getColor(field) : FIELD_COLORS.default
                return (
                  <div key={i}
                    style={{ background: c.bg, borderColor: c.border, color: c.text }}
                    className="px-2 py-1.5 rounded-lg border text-xs mb-1.5 font-mono truncate">
                    {`{{${key}}}`}
                  </div>
                )
              })
            )}

            {/* Schema JSON preview */}
            {usedKeys.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-black px-1">
                  Schema JSON
                </summary>
                <pre className="mt-2 p-2 bg-gray-900 text-green-400 text-xs rounded-lg overflow-auto max-h-48 whitespace-pre-wrap">
                  {JSON.stringify(buildSchemaJson(usedKeys), null, 2)}
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
                     hover:bg-[#2d2a6e] disabled:opacity-40 disabled:cursor-not-allowed">
          {loading ? 'Хадгалж байна...' : editing ? 'Хадгалах' : 'Загвар үүсгэх'}
        </button>
        {onCancel && (
          <button onClick={onCancel}
            className="px-5 py-2.5 border border-gray-200 text-black text-sm rounded-xl
                       hover:bg-gray-50">
            Цуцлах
          </button>
        )}
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

  // Бүтэн template (template_content-той) татах
  const fetchFullTemplate = async (id) => {
    const res = await api.get(`/admin/templates/${id}`)
    return res.data.data
  }

  // Row дарвал preview гаргах
  const handleRowClick = async (id) => {
    setPreviewLoading(true)
    setPreviewing({})  // modal-ыг нээж loading харуулах
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

  // Засах товч — бүтэн template-ийг татаад editor нээх
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
                       rounded-xl hover:bg-[#2d2a6e]">
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
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
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
            <span className={`px-2 py-0.5 rounded-lg text-xs font-medium w-fit ${
              t.is_standard
                ? 'bg-blue-50 text-blue-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {t.is_standard ? 'Стандарт' : 'Хувийн'}
            </span>
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

      {/* Preview modal — read-only, засварлах боломжгүй */}
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