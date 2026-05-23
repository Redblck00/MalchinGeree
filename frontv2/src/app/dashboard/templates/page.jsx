'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import api from '@/lib/api'
import TemplatePreview from '@/components/templates/TemplatePreview'
import RoleSelectModal from '@/components/templates/RoleSelectModal'
import TemplateCard from '@/components/templates/TemplateCard'
import NotificationDropdown from '@/components/layout/NotificationDropdown'
import { FiSearch } from 'react-icons/fi'
import { Sparkles } from 'lucide-react'

// ── Filter tabs ────────────────────────────────────────
// "all"       → бүх загвар
// "standard"  → системийн стандарт загвар (is_standard = true)
// "personal"  → захиалгат/хувийн загвар (is_standard = false)
const FILTERS = [
  { key: 'all',      label: 'All',      icon: <Sparkles size={14} /> },
  { key: 'standard', label: 'Standard' },
  { key: 'personal', label: 'Personal' },
]

export default function DashboardTemplatesPage() {
  const router = useRouter()
  const [templates,     setTemplates]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [activeFilter,  setActiveFilter]  = useState('all')
  const [previewing,    setPreviewing]    = useState(null)
  const [previewLoading,setPreviewLoading]= useState(false)
  const [roleSelecting, setRoleSelecting] = useState(null)

  // Auth-protected endpoint — dashboard layout-ийн AuthGuard баталгаажсан
  useEffect(() => {
    let mounted = true
    api.get('/contracts/templates')
      .then(res => {
        if (mounted) setTemplates(res.data.data || [])
      })
      .catch(() => mounted && setTemplates([]))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  // Filter + search (memo — дахин шүүлтийг сэргийлнэ)
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return templates.filter(t => {
      if (activeFilter === 'standard' && !t.is_standard) return false
      if (activeFilter === 'personal' &&  t.is_standard) return false
      if (s && !t.name.toLowerCase().includes(s) &&
              !(t.description || '').toLowerCase().includes(s)) return false
      return true
    })
  }, [templates, activeFilter, search])

  // ── Preview ───────────────────────────────────────
  const handlePreview = async (id) => {
    setPreviewLoading(true)
    setPreviewing({})
    try {
      const res = await api.get(`/contracts/templates/${id}`)
      setPreviewing(res.data.data || res.data)
    } catch {
      setPreviewing(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  // ── Ашиглах: role сонголт → шинэ гэрээ үүсгэх ──────
  // Бизнес урсгал хадгалагдсан — public/templates хуудастай ижил.
  const handleUse = (template) => setRoleSelecting(template)
  const handleRoleSelected = (role) => {
    const id = roleSelecting?.template_id
    setRoleSelecting(null)
    if (id) router.push(`/dashboard/contracts/new?template_id=${id}&role=${role}`)
  }

  return (
    // Бүхэл page = viewport-ын өндөр. Зөвхөн card grid scroll хийнэ.
    <div className="h-screen flex flex-col overflow-hidden bg-linear-to-br from-emerald-50/40 via-white to-white">

      {/* ══════════════════════════════════════════════
          1. HEADER (fixed) — search + notification
          ══════════════════════════════════════════════ */}
      <header className="shrink-0 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-4 flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-2xl">
            <FiSearch
              className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              size={18}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Загвар хайх…"
              className="w-full pl-12 pr-5 py-3 rounded-2xl
                         bg-gray-50 border border-gray-200 text-sm text-gray-700
                         outline-none transition
                         placeholder:text-gray-400
                         focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {/* Notification bell */}
          <div className="shrink-0">
            <NotificationDropdown />
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════
          2. INTRO SECTION (fixed) — illusrationBro
          ══════════════════════════════════════════════ */}
      <section className="shrink-0 px-6 lg:px-10 pt-6">
        <div className="max-w-7xl mx-auto">
          <div className="relative overflow-hidden 
                          bg-linear-to-r from-emerald-100 via-emerald-50 to-emerald-100/60
                          border border-emerald-100/70 shadow-sm">
            {/* Decorative blobs */}
            <div className="absolute -right-10 -top-12 w-56 h-56 rounded-full
                            bg-emerald-200/40 blur-2xl" />
            <div className="absolute -left-8 -bottom-12 w-40 h-40 rounded-full
                            bg-emerald-300/30 blur-2xl" />

            <div className="relative flex items-center justify-between gap-6 px-8 py-7">
              {/* Left: heading */}
              <div className="flex-1 min-w-0">
                <span className="inline-block px-3 py-1 rounded-full
                                 bg-white/80 backdrop-blur-sm text-emerald-700
                                 text-[11px] font-semibold uppercase tracking-widest">
                  Гэрээний загвар
                </span>
                <h1 className="mt-3 text-2xl md:text-3xl lg:text-4xl font-bold
                               text-emerald-900 leading-tight m-0">
                  Та гэрээгээ байгуул,{' '}
                  <span className="text-emerald-600">бид асуудлыг тань шийднэ</span>
                </h1>
                <p className="mt-2 text-sm text-emerald-800/80 max-w-xl m-0">
                  Өөрт тохирох загвараа сонгоод, цаг хэмнэж зөв хууль зүйн гэрээгээ
                  цахимаар байгуулаарай.
                </p>
              </div>

              {/* Right: illustration */}
              <div className="hidden md:block shrink-0 relative w-44 h-32 lg:w-56 lg:h-40">
                <Image
                  src="/illusrationBro.png"
                  alt="Illustration"
                  fill
                  priority
                  sizes="(max-width: 1024px) 176px, 224px"
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          3. FILTER PILLS (fixed)
          ══════════════════════════════════════════════ */}
      <section className="shrink-0 px-6 lg:px-10 pt-6 pb-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {FILTERS.map((f) => {
              const active = activeFilter === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`shrink-0 inline-flex items-center gap-1.5
                              px-4 py-2 rounded-full text-sm font-medium
                              transition-all cursor-pointer border
                              ${active
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300 hover:text-emerald-700'}`}
                >
                  {f.icon}
                  {f.label}
                </button>
              )
            })}
          </div>

          {/* Count chip */}
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-500">
            <span className="font-semibold text-emerald-700">{filtered.length}</span>
            загвар олдлоо
          </span>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          4. CARD GRID — ЗӨВХӨН ЭНЭ ХЭСЭГ SCROLL
          ══════════════════════════════════════════════ */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-10 pb-10">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <LoadingSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState search={search} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-2">
              {filtered.map((t) => (
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
      </div>

      {/* ── Modals ──────────────────────────────────── */}
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

// ══════════════════════════════════════════════════════
// SUBCOMPONENTS
// ══════════════════════════════════════════════════════

// ── Loading skeleton ─────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i}
             className="bg-white ring-1 ring-gray-200 p-5 flex flex-col
                        aspect-210/297 animate-pulse">
          <div className="h-3 w-3/4 bg-gray-100 mx-auto mb-2" />
          <div className="h-3 w-1/2 bg-gray-100 mx-auto mb-3" />
          <div className="h-px bg-gray-200 mb-3" />
          <div className="space-y-1.5 flex-1">
            <div className="h-2 w-full bg-gray-100" />
            <div className="h-2 w-full bg-gray-100" />
            <div className="h-2 w-5/6 bg-gray-100" />
            <div className="h-2 w-full bg-gray-100" />
            <div className="h-2 w-3/4 bg-gray-100" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-200 pt-3">
            <div className="h-6 bg-gray-100" />
            <div className="h-6 bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Empty state ──────────────────────────────────────
function EmptyState({ search }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-400
                      flex items-center justify-center mb-4">
        <FiSearch size={28} />
      </div>
      <p className="text-base font-semibold text-gray-900 m-0">
        Загвар олдсонгүй
      </p>
      <p className="text-sm text-gray-500 mt-1 m-0">
        {search
          ? `"${search}" үг агуулсан загвар олдсонгүй`
          : 'Сонгосон шүүлтүүрт тохирох загвар алга байна'}
      </p>
    </div>
  )
}
