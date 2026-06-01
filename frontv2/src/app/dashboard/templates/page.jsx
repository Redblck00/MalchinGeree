'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import api from '@/lib/api'
import TemplatePreview from '@/components/templates/TemplatePreview'
import RoleSelectModal from '@/components/templates/RoleSelectModal'
import TemplateCard from '@/components/templates/TemplateCard'
import { TEMPLATE_CARD_GRID } from '@/components/templates/templateGridClasses'
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
    // Desktop: зөвхөн card grid scroll. Mobile: бүхэл хуудас scroll (dvh — address bar-т тохирно).
    <div className="min-h-dvh lg:h-screen flex flex-col lg:overflow-hidden bg-linear-to-br from-emerald-50/40 via-white to-white">

      {/* ══════════════════════════════════════════════
          1. HEADER (fixed) — search + notification
          ══════════════════════════════════════════════ */}
      <header className="shrink-0 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pl-16 lg:pl-10 py-3 sm:py-4 flex items-center gap-2 sm:gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-0 max-w-2xl">
            <FiSearch
              className="absolute left-3.5 sm:left-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              size={17}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Загвар хайх…"
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl
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
      <section className="shrink-0 px-4 sm:px-6 lg:px-10 pt-4 sm:pt-6">
        <div className="max-w-7xl mx-auto">
          <div className="relative overflow-hidden 
                          bg-linear-to-r from-emerald-100 via-emerald-50 to-emerald-100/60
                          border border-emerald-100/70 shadow-sm rounded-lg sm:rounded-none">
            {/* Decorative blobs */}
            <div className="absolute -right-10 -top-12 w-56 h-56 rounded-full
                            bg-emerald-200/40 blur-2xl" />
            <div className="absolute -left-8 -bottom-12 w-40 h-40 rounded-full
                            bg-emerald-300/30 blur-2xl" />

            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6 px-4 sm:px-6 md:px-8 py-5 sm:py-7">
              {/* Left: heading */}
              <div className="flex-1 min-w-0 order-2 md:order-1">
                <span className="inline-block px-2.5 sm:px-3 py-1 rounded-full
                                 bg-white/80 backdrop-blur-sm text-emerald-700
                                 text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest">
                  Гэрээний загвар
                </span>
                <h1 className="mt-2 sm:mt-3 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold
                               text-emerald-900 leading-tight m-0">
                  Та гэрээгээ байгуул,{' '}
                  <span className="text-emerald-600">бид асуудлыг тань шийднэ</span>
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-emerald-800/80 max-w-xl m-0 leading-relaxed">
                  Өөрт тохирох загвараа сонгоод, цаг хэмнэж зөв хууль зүйн гэрээгээ
                  цахимаар байгуулаарай.
                </p>
              </div>

              {/* Illustration — mobile дээр дээд талд жижиг */}
              <div className="order-1 md:order-2 shrink-0 self-center md:self-auto relative w-28 h-20 sm:w-36 sm:h-28 md:w-44 md:h-32 lg:w-56 lg:h-40">
                <Image
                  src="/illusrationBro.png"
                  alt="Illustration"
                  fill
                  priority
                  sizes="(max-width: 768px) 144px, (max-width: 1024px) 176px, 224px"
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
      <section className="shrink-0 px-4 sm:px-6 lg:px-10 pt-4 sm:pt-6 pb-3 sm:pb-4">
        <div className="max-w-7xl mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto max-w-full
                          [-ms-overflow-style:none] [scrollbar-width:none]
                          [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((f) => {
              const active = activeFilter === f.key
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActiveFilter(f.key)}
                  className={`shrink-0 inline-flex items-center gap-1.5
                              px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium
                              transition-all cursor-pointer border whitespace-nowrap
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

          <span className="text-xs text-gray-500 shrink-0">
            <span className="font-semibold text-emerald-700">{filtered.length}</span>
            {' '}загвар олдлоо
          </span>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          4. CARD GRID — ЗӨВХӨН ЭНЭ ХЭСЭГ SCROLL
          ══════════════════════════════════════════════ */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <LoadingSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState search={search} />
          ) : (
            <div className={`${TEMPLATE_CARD_GRID} pt-2`}>
              {filtered.map((t) => (
                <TemplateCard
                  key={t.template_id}
                  template={t}
                  onClick={() => handlePreview(t.template_id)}
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

// ══════════════════════════════════════════════════════
// SUBCOMPONENTS
// ══════════════════════════════════════════════════════

// ── Loading skeleton — TemplateCard-той ижил хэмжээ + layout ─────
function LoadingSkeleton() {
  return (
    <div className={`${TEMPLATE_CARD_GRID} pt-2`}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="w-52.5 max-w-full aspect-[210/289] justify-self-center bg-white border border-gray-200 rounded-md
                     flex flex-col overflow-hidden animate-pulse"
        >
          {/* Body — document lines */}
          <div className="flex-1 px-4 pt-5 pb-3">
            <div className="h-2 w-1/3 bg-gray-300 rounded-sm mb-4" />
            <div className="space-y-1.5">
              <div className="h-1.5 w-full bg-gray-100 rounded-sm" />
              <div className="h-1.5 w-full bg-gray-100 rounded-sm" />
              <div className="h-1.5 w-3/5 bg-gray-100 rounded-sm" />
              <div className="h-1.5 w-full bg-gray-100 rounded-sm" />
              <div className="h-1.5 w-4/5 bg-gray-100 rounded-sm" />
            </div>
          </div>
          {/* Footer placeholder */}
          <div className="shrink-0 bg-rose-50/70 border-t border-gray-100 px-4 py-2.5">
            <div className="h-3 w-1/2 bg-gray-200 rounded-sm mb-1.5" />
            <div className="h-2 w-3/4 bg-gray-100 rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Empty state ──────────────────────────────────────
function EmptyState({ search }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center px-4">
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
