'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import api from '@/lib/api'
import TemplatePreview from '@/components/templates/TemplatePreview'
import RoleSelectModal from '@/components/templates/RoleSelectModal'
import Navbar from '@/components/layout/Navbar'
import { FiSearch, FiFilter } from 'react-icons/fi'

// ══════════════════════════════════════════════════════════════
// Public templates page
// Layout:
//   ┌──────────────────────────────────────────────────────┐
//   │  Navbar (sticky top)                                 │
//   ├──────────────────────────────────────────────────────┤
//   │  Hero — search input (left) + bro.png illust (right) │
//   ├──────────────────────────────────────────────────────┤
//   │  Filter row (Бүгд / Стандарт)                        │
//   ├──────────────────────────────────────────────────────┤
//   │  Scrollable card grid (scrollbar hidden)             │
//   │  ↑↓                                                  │
//   └──────────────────────────────────────────────────────┘
// Зөвхөн card grid scroll хийгдэнэ — навбар, hero, filter
// дэлгэцэнд тогтмол үлдэнэ.
// ══════════════════════════════════════════════════════════════
export default function PublicTemplatesPage() {
  const router = useRouter()
  const [templates,      setTemplates]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [filter,         setFilter]         = useState('all')  // 'all' | 'standard'
  const [previewing,     setPreviewing]     = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [roleSelecting,  setRoleSelecting]  = useState(null)

  useEffect(() => {
    api.get('/public/templates')
      .then(res => setTemplates(res.data.data || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = templates
    .filter(t => filter === 'all' || (filter === 'standard' && t.is_standard))
    .filter(t => t.name.toLowerCase().includes(search.trim().toLowerCase()))

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
    setPreviewing(null)
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
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <Navbar />

      {/* ── Hero: emerald gradient + цагаан decorative тойргууд ──
          Системийн нүүр хуудастай ижил палитр (HeroSection.jsx).
          Browse page тул нүүр хуудас шиг хүчтэй биш, арай зөөлөн tone. */}
      <section className="shrink-0 relative overflow-hidden
                          bg-linear-to-br from-emerald-400 via-emerald-500 to-emerald-600">
        {/* Decorative circles — HeroSection.jsx-н адил pattern */}
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute right-1/4 -bottom-16 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -left-12 -bottom-10 w-56 h-56 rounded-full bg-white/10 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 md:px-10 py-8 md:py-12
                        flex items-center justify-between gap-6">
          {/* Left — search */}
          <div className="flex-1 max-w-xl">
            <span className="inline-block mb-3 px-3 py-1 rounded-full
                             bg-white/20 backdrop-blur-sm border border-white/30
                             text-white/95 text-[10px] font-medium tracking-widest uppercase">
              Гэрээний загварууд
            </span>
            <div className="relative">
              <FiSearch
                className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Загвар хайх..."
                className="w-full pl-12 pr-5 py-3.5 bg-white rounded-xl
                           text-sm text-gray-700 outline-none shadow-lg
                           placeholder:text-gray-400
                           focus:ring-2 focus:ring-white/40"
              />
            </div>
            <p className="mt-3 text-xs text-white/90 m-0">
              Тохирох гэрээний загвараа сонгож, цахим гэрээ үүсгэнэ үү.
            </p>
          </div>

          {/* Right — illustration */}
          <div className="hidden md:block shrink-0 relative">
            {/* Soft glow behind illustration — home hero-той ижил */}
            <div className="absolute inset-0 bg-white/20 rounded-full blur-2xl scale-75" />
            <Image
              src="/home/bro.png"
              alt="Гэрээ"
              width={260}
              height={200}
              priority
              className="relative select-none pointer-events-none drop-shadow-xl"
            />
          </div>
        </div>
      </section>

      {/* ── Filter bar ────────────────────────── */}
      <div className="shrink-0 border-b border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-3 flex items-center gap-2">
          <FiFilter size={14} className="text-gray-400 mr-1" />
          <FilterPill
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            Бүгд
          </FilterPill>
          <FilterPill
            active={filter === 'standard'}
            onClick={() => setFilter('standard')}
          >
            Стандарт
          </FilterPill>
          <span className="ml-auto text-xs text-gray-400">
            {loading ? '...' : `${filtered.length} загвар`}
          </span>
        </div>
      </div>

      {/* ── Scrollable card grid — scrollbar нуугдсан ── */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-[#3d3a8c] rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">
              {search
                ? `"${search}" үг агуулсан загвар олдсонгүй`
                : 'Загвар байхгүй байна'}
            </div>
          ) : (
            <div className="flex flex-wrap gap-6">
              {filtered.map(t => (
                <MinimalTemplateCard
                  key={t.template_id}
                  template={t}
                  onClick={() => handlePreview(t.template_id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {previewing !== null && (
        <TemplatePreview
          template={previewing}
          loading={previewLoading}
          onClose={() => setPreviewing(null)}
          onUse={handleUse}
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

// ── Filter pill button ─────────────────────────────────
function FilterPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-full cursor-pointer
                  border-0 transition-colors
                  ${active
                    ? 'bg-[#3d3a8c] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
    >
      {children}
    </button>
  )
}

// ══════════════════════════════════════════════════════════════
// MinimalTemplateCard — A4 хувьтайвалзагдсан минимал карт
//
// Figma хэмжээ: w-210 × h-289 px (A4 ойролцоо ratio)
// • Background image байхгүй
// • Document mock дээд хэсэгт (нэгэн контентын line preview)
// • Footer-т name + description
// • Карт click → onClick (preview modal)
// ══════════════════════════════════════════════════════════════
function MinimalTemplateCard({ template, onClick }) {
  return (
    <article
      onClick={onClick}
      className="w-52.5 h-72.25 shrink-0
                 bg-white border border-gray-200 rounded-md
                 flex flex-col overflow-hidden cursor-pointer
                 hover:border-[#3d3a8c]/40 hover:shadow-md
                 transition-all"
    >
      {/* Document preview mock — text lines */}
      <div className="flex-1 px-4 pt-5 pb-3 overflow-hidden">
        {/* Title bar */}
        <div className="h-2 bg-gray-300 rounded-sm w-1/3 mb-4" />
        {/* Body lines */}
        <div className="space-y-1.5">
          {[100, 100, 60, 100, 100, 75, 100, 100, 100, 50, 100, 90].map((w, i) => (
            <div
              key={i}
              className="h-1.5 bg-gray-100 rounded-sm"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      </div>

      {/* Footer — name + description */}
      <footer className="shrink-0 bg-rose-50/70 border-t border-gray-100 px-4 py-2.5">
        <p className="text-sm font-semibold text-gray-900 m-0 truncate">
          {template.name}
        </p>
        <p className="text-[11px] text-gray-500 m-0 mt-0.5 line-clamp-2 leading-snug">
          {template.description || 'Гэрээний загвар'}
        </p>
      </footer>
    </article>
  )
}
