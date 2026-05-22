'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import TemplatePreview from '@/components/templates/TemplatePreview'
import RoleSelectModal from '@/components/templates/RoleSelectModal'
import Navbar from '@/components/layout/Navbar'
import { FiEye, FiSearch } from 'react-icons/fi'

export default function PublicTemplatesPage() {
  const router = useRouter()
  const [templates,      setTemplates]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [previewing,     setPreviewing]     = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [roleSelecting,  setRoleSelecting]  = useState(null)

  useEffect(() => {
    api.get('/public/templates')
      .then(res => setTemplates(res.data.data || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.trim().toLowerCase())
  )

  const handlePreview = async (id) => {
    setPreviewLoading(true)
    setPreviewing({})
    try {
      const res = await api.get(`/public/templates/${id}`)
      setPreviewing(res.data.data)
    } catch {
      setPreviewing(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleUse = (template) => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('token') : null
    if (!token) {
      const redirect = `/dashboard/contracts/new?template_id=${template.template_id}`
      router.push(`/login?redirect=${encodeURIComponent(redirect)}`)
    } else {
      setRoleSelecting(template)
    }
  }

  const handleRoleSelected = (role) => {
    const id = roleSelecting?.template_id
    setRoleSelecting(null)
    if (id) router.push(`/dashboard/contracts/new?template_id=${id}&role=${role}`)
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── Hero: background image + centered search ─────── */}
      <section
        className="relative w-full h-115 bg-top bg-cover"
        style={{ backgroundImage: 'url(/backgroundTemplate.png)' }}
      >
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 flex h-full items-center justify-center px-6">
          <div className="relative w-full max-w-2xl">
            <FiSearch
              className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="search here"
              className="w-full pl-14 pr-6 py-5 rounded-full bg-white text-gray-700
                         text-base outline-none shadow-2xl
                         placeholder:text-gray-400
                         focus:ring-2 focus:ring-[#3d3a8c]/40"
            />
          </div>
        </div>
      </section>

      {/* ── Cards (A4 portrait) ──────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-12">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-[#3d3a8c] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-gray-400">
            {search ? `"${search}" үг агуулсан загвар олдсонгүй` : 'Загвар байхгүй байна'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {filtered.map(t => (
              <TemplateCard
                key={t.template_id}
                template={t}
                onPreview={() => handlePreview(t.template_id)}
                onUse={() => handleUse(t)}
              />
            ))}
          </div>
        )}
      </div>

      {previewing !== null && (
        <TemplatePreview
          template={previewing}
          loading={previewLoading}
          onClose={() => setPreviewing(null)}
        />
      )}

      {roleSelecting && (
        <RoleSelectModal
          template={roleSelecting}
          onClose={() => setRoleSelecting(null)}
          onSelect={handleRoleSelected}
        />
      )}
    </div>
  )
}

// ── A4-shaped card (aspect ratio 210:297 ≈ 1:1.414) ─────
function TemplateCard({ template, onPreview, onUse }) {
  return (
    <div className="bg-white border border-[#3d3a8c]/40 rounded-sm p-6
                    flex flex-col transition-all
                    hover:shadow-lg hover:border-[#3d3a8c]
                    aspect-210/297">
      {/* Name */}
      <h3 className="text-lg font-semibold text-gray-900 m-0 line-clamp-2">
        {template.name}
      </h3>

      {/* Description — hidden after 5 lines */}
      <p className="mt-6 text-[15px] text-gray-700 m-0 flex-1 line-clamp-5 leading-relaxed">
        {template.description || ''}
      </p>

      {/* Footer: eye + use */}
      <div className="flex items-center justify-between pt-3 mt-auto">
        <button
          onClick={onPreview}
          title="Загвар харах"
          className="text-[#3d3a8c] hover:bg-[#3d3a8c]/10 p-2 rounded-lg
                     cursor-pointer bg-transparent border-0 flex items-center justify-center"
        >
          <FiEye size={20} />
        </button>
        <button
          onClick={onUse}
          className="text-gray-900 font-medium text-base hover:text-[#3d3a8c]
                     cursor-pointer bg-transparent border-0 px-2 py-1"
        >
          Ашиглах
        </button>
      </div>
    </div>
  )
}
