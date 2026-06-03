'use client'
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import TemplatePreview from '@/components/templates/TemplatePreview'
import TemplateEditor from '@/components/admin/templates/TemplateEditor'

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
    <div>
      {/* ── Header banner — admin sidebar-тэй ижил emerald дизайн ─── */}
      <div className="relative overflow-hidden px-6 py-7
                      bg-linear-to-r from-emerald-900 via-emerald-950 to-emerald-900">
        {/* Decorative diamonds + dotted grid (sidebar-ийн чимэглэлийн хэл) */}
        <div aria-hidden
             className="absolute -top-10 -right-10 w-44 h-44 rotate-45
                        bg-emerald-400/10 blur-2xl pointer-events-none" />
        <div aria-hidden
             className="absolute top-5 right-40 w-10 h-10 rotate-45
                        border border-emerald-300/20 pointer-events-none" />
        <div aria-hidden
             className="absolute inset-0 opacity-[0.06] pointer-events-none"
             style={{
               backgroundImage:
                 'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)',
               backgroundSize: '20px 20px',
             }} />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white m-0">Гэрээний загварууд</h1>
            <p className="text-sm text-emerald-200/70 mt-1">
              Талбаруудыг гэрээний текст дээр чирж placeholder тавина
            </p>
          </div>
          {!creating && !editing && (
            <button onClick={() => setCreating(true)}
              className="px-5 py-2.5 bg-emerald-400 text-emerald-950 text-sm font-semibold
                         hover:bg-emerald-300 cursor-pointer border-0
                         shadow-md shadow-emerald-900/40 shrink-0">
              + Шинэ загвар
            </button>
          )}
        </div>
      </div>

      <div className="p-6">

      {message && (
        <div className={`mb-4 px-4 py-3 text-sm border ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          {message.text}
        </div>
      )}

      {/* Editor */}
      {(creating || editing) && (
        <div className="bg-white border border-gray-200 p-6 mb-6 shadow-sm">
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
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-emerald-50/60 border-b border-gray-100
                        grid grid-cols-[2fr_1fr_1fr_1fr_100px] gap-4
                        text-xs font-semibold text-emerald-800/70 uppercase">
          <span>Нэр</span><span>Статус</span>
          <span>Placeholder</span><span>Огноо</span><span></span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-emerald-700 rounded-full animate-spin" />
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
                        items-center text-sm cursor-pointer hover:bg-emerald-50/40 transition-colors
                        ${i < templates.length - 1 ? 'border-b border-gray-100' : ''}`}>
            <div>
              <p className="font-medium text-gray-900">{t.name}</p>
              {t.description && <p className="text-xs text-gray-400">{t.description}</p>}
            </div>
            <div className="flex flex-wrap gap-1">
              <span className={`px-2 py-0.5 text-xs font-medium w-fit ${
                t.is_standard
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {t.is_standard ? 'Стандарт' : 'Хувийн'}
              </span>
              {t.is_offline_enabled && (
                <span className="px-2 py-0.5 text-xs font-medium w-fit
                                 bg-amber-50 text-amber-700 border border-amber-200">
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
                className="px-2 py-1 text-xs text-gray-700 border border-gray-200
                           hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700
                           cursor-pointer bg-white transition-colors">
                Засах
              </button>
              <button
                onClick={() => handleDelete(t.template_id, t.name)}
                className="px-2 py-1 text-xs text-red-500 border border-red-200
                           hover:bg-red-50 cursor-pointer bg-white transition-colors">
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
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
