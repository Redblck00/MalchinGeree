'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import api from '@/lib/api'
import TemplatePreview from '@/components/templates/TemplatePreview'
import RoleSelectModal from '@/components/templates/RoleSelectModal'
import TemplateCard from '@/components/templates/TemplateCard'
import { TEMPLATE_CARD_GRID } from '@/components/templates/templateGridClasses'
// Navbar нь root layout.tsx-д mount хийгдсэн
import { FiSearch } from 'react-icons/fi'
import { MdSearchOff, MdGridView, MdVerified, MdPersonOutline } from 'react-icons/md'

// Filter таб-ууд (dashboard/templates-тай ижил логик)
//   all      → бүх загвар
//   standard → системийн стандарт (is_standard = true)
//   personal → захиалгат/хувийн (is_standard = false)
const FILTERS = [
  { key: 'all',      label: 'Бүгд',     Icon: MdGridView },
  { key: 'standard', label: 'Стандарт', Icon: MdVerified },
  { key: 'personal', label: 'Хувийн',   Icon: MdPersonOutline },
]

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
  const [filter,         setFilter]         = useState('all')  // 'all' | 'standard' | 'personal'
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
    .filter(t =>
      filter === 'all' ||
      (filter === 'standard' &&  t.is_standard) ||
      (filter === 'personal' && !t.is_standard)
    )
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
      {/* Navbar фиксаар top-0-д давхарлана (transparent эмеральд hero дээр). */}

      {/* ── Hero: emerald gradient + цагаан decorative тойргууд ──
          Системийн нүүр хуудастай ижил палитр (HeroSection.jsx).
          Browse page тул нүүр хуудас шиг хүчтэй биш, арай зөөлөн tone. */}
      <section className="shrink-0 relative overflow-hidden
                          bg-linear-to-br from-emerald-400 via-emerald-500 to-emerald-600">
        {/* Decorative circles — HeroSection.jsx-н адил pattern */}
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute right-1/4 -bottom-16 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -left-12 -bottom-10 w-56 h-56 rounded-full bg-white/10 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 md:px-10
                        pt-20 pb-7 md:pb-9
                        flex items-center justify-between gap-8">
          {/* Left — heading + search */}
          <div className="flex-1 max-w-xl">
            <span className="inline-block mb-3 px-3 py-1 rounded-full
                             bg-white/20 backdrop-blur-sm border border-white/30
                             text-white/95 text-[10px] font-medium tracking-widest uppercase">
              Гэрээний загварууд
            </span>
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight m-0 mb-2">
              Тохирох загвараа сонгоод
              <br className="hidden sm:block" /> цахим гэрээ үүсгэ
            </h1>
            <p className="text-sm text-white/85 m-0 mb-4">
              Бэлэн загваруудаас сонгож хэдхэн минутад баталгаат цахим гэрээ байгуулна.
            </p>
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

      {/* ── Body: босоо filter rail + card grid зэрэгцээ ── */}
      <div className="flex-1 min-h-0 w-full max-w-7xl mx-auto flex flex-col lg:flex-row">

        {/* Filter rail — mobile: хэвтээ текст-таб; lg: босоо sidebar */}
        <aside className="shrink-0 lg:w-48 border-b lg:border-b-0 lg:border-r border-gray-100
                          px-6 md:px-10 lg:pl-10 lg:pr-6 py-3 lg:py-8 flex flex-col">
          <span className="hidden lg:block text-[10px] font-bold uppercase tracking-widest
                           text-gray-400 mb-3">
            Загварын төрөл
          </span>
          <nav className="flex flex-row lg:flex-col gap-3 lg:gap-1 overflow-x-auto no-scrollbar">
            {FILTERS.map(f => (
              <FilterTab
                key={f.key}
                active={filter === f.key}
                onClick={() => setFilter(f.key)}
                Icon={f.Icon}
              >
                {f.label}
              </FilterTab>
            ))}
          </nav>
          <div className="hidden lg:block mt-auto pt-4 text-xs text-gray-400">
            {loading ? '...' : `${filtered.length} загвар`}
          </div>
        </aside>

        {/* Card grid — зөвхөн энэ хэсэг scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar
                        px-6 md:px-10 lg:pl-8 lg:pr-10 py-6 lg:py-8">
          {/* Mobile тоо */}
          <p className="lg:hidden text-xs text-gray-400 m-0 mb-4">
            {loading ? '...' : `${filtered.length} загвар`}
          </p>

          {loading ? (
            <div className={TEMPLATE_CARD_GRID}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="w-52.5 max-w-full aspect-210/289 rounded-xl border border-gray-100
                             bg-white overflow-hidden flex flex-col animate-pulse"
                >
                  <div className="h-1.5 bg-gray-100" />
                  <div className="flex-1 px-4 pt-4">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 mb-3" />
                    <div className="h-3 bg-gray-100 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                  <div className="h-12 bg-gray-50 border-t border-gray-100" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-50 flex items-center
                              justify-center mb-3">
                <MdSearchOff size={26} className="text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500 m-0">
                {search
                  ? `"${search}" агуулсан загвар олдсонгүй`
                  : 'Загвар байхгүй байна'}
              </p>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="mt-3 text-xs font-semibold text-emerald-600
                             hover:text-emerald-700 cursor-pointer bg-transparent border-0"
                >
                  Хайлтыг арилгах
                </button>
              )}
            </div>
          ) : (
            <div className={TEMPLATE_CARD_GRID}>
              {filtered.map(t => (
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

// ── Filter таб — дэвсгэргүй, идэвхтэйг зөвхөн текстийн өнгөөр ялгана ──
function FilterTab({ active, onClick, Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 py-1.5 text-sm font-medium text-left
                  cursor-pointer bg-transparent border-0 whitespace-nowrap transition-colors
                  ${active
                    ? 'text-emerald-600 font-semibold'
                    : 'text-gray-500 hover:text-gray-900'}`}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  )
}

// MinimalTemplateCard нь @/components/templates/TemplateCard.jsx-руу зөөгдсөн —
// public + dashboard хоёр газарт нэг shared компонент хэрэглэнэ.
