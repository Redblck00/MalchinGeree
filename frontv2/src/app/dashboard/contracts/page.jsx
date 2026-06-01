"use client"
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import api from '@/lib/api'
import NotificationDropdown from '@/components/layout/NotificationDropdown'
import {
  MdDescription, MdVerifiedUser, MdAccessTime, MdEventAvailable,
} from 'react-icons/md'
import { FiSearch } from 'react-icons/fi'

// ── Status labels (light theme) ─────────────────────────
// WAITING нь PARTIALLY_SIGNED + FULLY_SIGNED-ийг нэг "Хүлээгдэж байгаа"
// хэлбэрээр харуулах virtual статус (DB-д байхгүй, зөвхөн UI-д).
const STATUS_LABELS = {
  DRAFT:     { label: 'Ноорог',           color: 'bg-slate-100 text-slate-700 border border-slate-200' },
  SENT:      { label: 'Илгээгдсэн',       color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  WAITING:   { label: 'Хүлээгдэж байгаа', color: 'bg-orange-50 text-orange-700 border border-orange-200' },
  COMPLETED: { label: 'Баталгаажсан',     color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  CLOSED:    { label: 'Хаагдсан',         color: 'bg-gray-100 text-gray-600 border border-gray-200' },
  DECLINED:  { label: 'Татгалзсан',       color: 'bg-red-50 text-red-700 border border-red-200' },
  CANCELLED: { label: 'Цуцлагдсан',       color: 'bg-red-50 text-red-700 border border-red-200' },
  EXPIRED:   { label: 'Хугацаа дууссан',  color: 'bg-gray-50 text-gray-600 border border-gray-200' },
}

const displayStatus = (s) => {
  if (s === 'PARTIALLY_SIGNED' || s === 'FULLY_SIGNED') return STATUS_LABELS.WAITING
  return STATUS_LABELS[s] || { label: s, color: 'bg-slate-100 text-slate-700 border border-slate-200' }
}

const STATUSES = ['', 'DRAFT', 'SENT', 'WAITING', 'COMPLETED', 'CANCELLED']

// Sidebar filter → contract шүүх логик (бизнес урсгал хэвээр)
const SIDEBAR_FILTERS = {
  inbox:   (c) => c.my_role === 'COUNTERPARTY',
  sent:    (c) => c.my_role === 'CREATOR',
  waiting: (c) => ['PARTIALLY_SIGNED', 'FULLY_SIGNED'].includes(c.status),
  closed:  (c) => ['COMPLETED', 'CLOSED', 'CANCELLED', 'DECLINED', 'EXPIRED'].includes(c.status),
}
const SIDEBAR_TITLES = {
  inbox:   { title: 'Ирсэн гэрээ',         subtitle: 'Бусдаас танд илгээсэн гэрээ' },
  sent:    { title: 'Илгээсэн гэрээ',      subtitle: 'Таны өөрийн үүсгэсэн гэрээ' },
  waiting: { title: 'Хүлээгдэж байгаа',    subtitle: 'Гарын үсэг зурж байгаа гэрээ' },
  closed:  { title: 'Хаагдсан гэрээ',      subtitle: 'Баталгаажсан, цуцлагдсан гэрээ' },
}

export default function DocumentPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const sideFilter   = searchParams.get('filter')  // inbox | sent | waiting | closed

  const [contracts, setContracts] = useState([])
  const [loading,   setLoading]   = useState(true)

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')

  // View Transition: clicked row → detail expand animation.
  // Зөвхөн дарсан row-нд `viewTransitionName: 'contract-card'` өгнө —
  // detail page-ийн outer wrapper-т ижил нэр өгсөн, browser хооронд морфлоно.
  const [expandingId, setExpandingId] = useState(null)

  const handleRowClick = (id) => {
    const url = `/dashboard/contracts/${id}`
    // Fallback: View Transitions API дэмждэггүй browser-т ердийн nav
    if (typeof document === 'undefined' || !document.startViewTransition) {
      router.push(url)
      return
    }
    setExpandingId(id)
    // Inline style apply хийгдсэний дараах frame-д transition эхлүүлнэ
    requestAnimationFrame(() => {
      document.startViewTransition(() => router.push(url))
    })
  }

  // Backend-с гэрээнүүд авах (API хэвээр)
  useEffect(() => {
    const fetchContracts = async () => {
      try {
        const res = await api.get('/contracts')
        setContracts(res.data.data || [])
      } catch (_) {
        setContracts([])
      } finally {
        setLoading(false)
      }
    }
    fetchContracts()
  }, [])

  // Filter логик (хэвээр)
  const filtered = useMemo(() => {
    const sideFn = SIDEBAR_FILTERS[sideFilter]
    return contracts.filter((c) => {
      const text = (c.contract_number + ' ' + (c.title || '') + ' ' + (c.template_name || '')).toLowerCase()
      const matchSearch = !search || text.includes(search.toLowerCase())

      const matchStatus = !statusFilter ||
        (statusFilter === 'WAITING'
          ? ['PARTIALLY_SIGNED', 'FULLY_SIGNED'].includes(c.status)
          : c.status === statusFilter)

      const matchSide = !sideFn || sideFn(c)

      const created = new Date(c.created_at)
      const matchFrom = !dateFrom || created >= new Date(dateFrom)
      const matchTo   = !dateTo   || created <= new Date(dateTo + 'T23:59:59')
      return matchSearch && matchStatus && matchSide && matchFrom && matchTo
    })
  }, [contracts, search, statusFilter, dateFrom, dateTo, sideFilter])

  const pageTitle = SIDEBAR_TITLES[sideFilter] || { title: 'Бичиг баримт', subtitle: 'Таны бүх гэрээний жагсаалт' }

  // Статистик (хэвээр)
  const stats = useMemo(() => ({
    total:   contracts.length,
    active:  contracts.filter((c) => c.status === 'COMPLETED').length,
    waiting: contracts.filter((c) => c.status === 'SENT' || c.status === 'PARTIALLY_SIGNED').length,
    closed:  contracts.filter((c) => c.status === 'COMPLETED' || c.status === 'CANCELLED').length,
  }), [contracts])

  const hasFilter = search || statusFilter || dateFrom || dateTo

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setDateFrom('')
    setDateTo('')
  }

  return (
    // Бүх дэлгэц дээр viewport өндөртэй; зөвхөн хүснэгт дотроо scroll хийнэ
    // (≤lg: босоо + хөндлөн, lg: босоо). h-dvh — mobile browser-ийн address
    // bar-ийг тооцож зөв өндөр өгнө (h-screen/100vh нь утсан дээр доош тасардаг).
    <div className="h-dvh flex flex-col overflow-hidden bg-linear-to-br from-emerald-50/30 via-white to-white">

      {/* ══════════════════════════════════════════════
          1. HEADER — notification + search (fixed)
          ══════════════════════════════════════════════ */}
      <header className="shrink-0 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        {/* pl-16 (< lg): зүүн дээд буланд байрлах mobile hamburger товчийг тойрно */}
        <div className="pl-16 pr-4 sm:pr-6 lg:px-10 py-3 sm:py-4 flex items-center gap-3 sm:gap-4">
          {/* Notification (зүүн) */}
          <div className="shrink-0">
            <NotificationDropdown />
          </div>

          {/* Search (баруун) */}
          <div className="relative ml-auto w-full max-w-md">
            <FiSearch
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              size={18}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Гэрээ хайх..."
              className="w-full pl-11 pr-4 py-2.5
                         bg-gray-50 border border-gray-200 text-sm text-gray-700
                         outline-none transition rounded-xl
                         placeholder:text-gray-400
                         focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════
          2. HERO — KPI cards (зүүн) + illustration (баруун)
          ══════════════════════════════════════════════ */}
      <section className="shrink-0 px-4 sm:px-6 lg:px-10 pt-4 sm:pt-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-stretch">

          {/* Зүүн: title + KPI 2×2 */}
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 m-0">
                {pageTitle.title}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5 m-0">
                {pageTitle.subtitle}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <KpiCard label="Нийт гэрээ"      value={stats.total}   icon={<MdDescription size={22} />} />
              <KpiCard label="Баталгаажсан"    value={stats.active}  icon={<MdVerifiedUser size={22} />} />
              <KpiCard label="Хүлээгдэж байна" value={stats.waiting} icon={<MdAccessTime size={22} />} />
              <KpiCard label="Дууссан"         value={stats.closed}  icon={<MdEventAvailable size={22} />} />
            </div>
          </div>

          {/* Баруун: illustrationBro */}
          <div className="hidden lg:flex relative items-center justify-center 
                        overflow-hidden">
            {/* Decorative blob  bg-linear-to-br from-emerald-50 to-emerald-100/60
                          border border-emerald-100    */}
            {/* <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-emerald-200/40 blur-2xl" /> */}
            <div className="absolute -left-6 -bottom-6 w-24 h-24 rounded-full bg-emerald-300/30 blur-xl" />
            <div className="relative w-full h-36">
              <Image
                src="/illusrationBro.png"
                alt="Illustration"
                fill
                priority
                sizes="320px"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          3. FILTER BAR (fixed)
          ══════════════════════════════════════════════ */}
      <section className="shrink-0 px-4 sm:px-6 lg:px-10 pt-4 sm:pt-5 pb-3">
        <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm
                        flex items-center gap-2 lg:flex-wrap lg:items-center lg:gap-3">

          {/* < lg: pills + огноо + цэвэрлэх-ийг нэг мөрөнд хөндлөн scroll болгоно
              (filter босоо зай эзлэхгүй). lg: `contents` → эдгээр шууд card-ийн
              flex хүүхдүүд болж хуучин flex-wrap layout сэргэнэ. */}
          <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto no-scrollbar
                          lg:contents">

            {/* Status pill filters */}
            <div className="flex items-center gap-1.5 shrink-0">
              {STATUSES.map((s) => {
                const active = statusFilter === s
                const label = s ? (STATUS_LABELS[s]?.label || s) : 'Бүгд'
                return (
                  <button
                    key={s || 'all'}
                    onClick={() => setStatusFilter(s)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium
                                transition-all cursor-pointer border
                                ${active
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-700'}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Date filters */}
            <div className="flex items-center gap-2 shrink-0 lg:ml-auto">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="shrink-0 w-36 lg:w-auto px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700
                           outline-none bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                title="Эхлэх огноо"
              />
              <span className="text-gray-300 text-xs shrink-0">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="shrink-0 w-36 lg:w-auto px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700
                           outline-none bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                title="Дуусах огноо"
              />
            </div>

            {hasFilter && (
              <button
                onClick={clearFilters}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs
                           text-red-600 border border-red-200 rounded-lg
                           hover:bg-red-50 transition-colors cursor-pointer bg-white"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Цэвэрлэх
              </button>
            )}
          </div>

          {/* Гэрээ үүсгэх — scroll-д ороогүй, үргэлж харагдана */}
          <button
            onClick={() => router.push('/dashboard/templates')}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-1.5
                       bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold
                       rounded-lg transition-colors shadow-sm cursor-pointer border-0 whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Гэрээ үүсгэх</span>
          </button>
        </div>

        {hasFilter && (
          <p className="text-xs text-gray-500 mt-2 px-1 m-0">
            <span className="font-semibold text-emerald-700">{filtered.length}</span> гэрээ олдлоо
            {contracts.length !== filtered.length && (
              <span className="text-gray-400"> (нийт {contracts.length}-аас)</span>
            )}
          </p>
        )}
      </section>

      {/* ══════════════════════════════════════════════
          4. TABLE — ЗӨВХӨН ЭНЭ ХЭСЭГ SCROLL
          ══════════════════════════════════════════════ */}
      {/* Хүснэгт дотроо scroll: ≤lg хөндлөн + босоо, lg босоо. */}
      <div className="flex-1 min-h-0 px-4 sm:px-6 lg:px-10 pb-4 sm:pb-6">
        <div className="h-full bg-white border border-gray-200 rounded-2xl shadow-sm
                        overflow-hidden flex flex-col">

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-emerald-500
                              rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              hasFilter={hasFilter}
              onCreate={() => router.push('/dashboard/templates')}
            />
          ) : (
            // Scroller: ≤lg хөндлөн гүйлгэнэ. Бүх хэмжээнд босоо талаараа bounded —
            // header дээрээ тогтож, доорх rows л босоо scroll хийнэ.
            <div className="flex-1 min-h-0 flex flex-col overflow-x-auto no-scrollbar lg:overflow-x-hidden">
              {/* min-w-180 (=720px) — багана нурж эвдрэхээс сэргийлж хөндлөн scroll үүсгэнэ */}
              <div className="min-w-180 lg:min-w-0 flex flex-col h-full min-h-0">

                {/* Table header */}
                <div className="grid grid-cols-[1.5fr_2fr_1fr_1fr_1fr] gap-4 px-5 py-3 shrink-0
                                bg-emerald-50/60 border-b border-emerald-100
                                text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                  <span>Гэрээний дугаар</span>
                  <span>Гарчиг / загвар</span>
                  <span>Миний үүрэг</span>
                  <span>Статус</span>
                  <span>Огноо</span>
                </div>

                {/* Rows — зөвхөн энэ хэсэг босоо scroll (бүх хэмжээнд) */}
                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                  {filtered.map((contract, i) => {
                    const status = displayStatus(contract.status)
                    const date = contract.created_at
                      ? new Date(contract.created_at).toLocaleDateString('mn-MN')
                      : '—'
                    const myRoleLabel = contract.creator_role === 'seller' && contract.my_role === 'CREATOR'
                      ? 'Худалдагч'
                      : contract.creator_role === 'buyer' && contract.my_role === 'CREATOR'
                        ? 'Худалдан авагч'
                        : contract.my_role === 'COUNTERPARTY'
                          ? (contract.creator_role === 'seller' ? 'Худалдан авагч' : 'Худалдагч')
                          : (contract.my_role || '—')

                    return (
                      <div
                        key={contract.contract_id}
                        onClick={() => handleRowClick(contract.contract_id)}
                        style={
                          expandingId === contract.contract_id
                            ? { viewTransitionName: 'contract-card' }
                            : undefined
                        }
                        className={`grid grid-cols-[1.5fr_2fr_1fr_1fr_1fr] gap-4 px-5 py-4 items-center
                                    cursor-pointer hover:bg-emerald-50/40 transition-colors
                                    ${i < filtered.length - 1 ? 'border-b border-gray-100' : ''}`}
                      >
                        <span className="text-sm font-semibold text-emerald-700 font-mono">
                          {contract.contract_number || '—'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate m-0">
                            {contract.title || '—'}
                          </p>
                          {contract.template_name && (
                            <p className="text-xs text-gray-500 truncate m-0 mt-0.5">
                              {contract.template_name}
                            </p>
                          )}
                        </div>
                        <span className="text-sm text-gray-700">{myRoleLabel}</span>
                        <span>
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-semibold ${status.color}`}>
                            {status.label}
                          </span>
                        </span>
                        <span className="text-xs text-gray-500">{date}</span>
                      </div>
                    )
                  })}
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// SUBCOMPONENTS
// ══════════════════════════════════════════════════════

// ── KPI card (бага зэрэг compact болсон) ──
function KpiCard({ label, value, icon }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-3 shadow-sm
                    bg-linear-to-br from-emerald-50 to-emerald-100/70
                    border border-emerald-100 hover:shadow-md hover:border-emerald-200
                    transition-all duration-300">
      {/* Decorative circles — арай жижиг */}
      <div className="absolute -right-3 -top-3 w-14 h-14 rounded-full bg-emerald-200/30" />
      <div className="absolute -right-1 -bottom-4 w-10 h-10 rounded-full bg-emerald-300/20" />

      <div className="relative flex items-start justify-between mb-0.5">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center
                         bg-emerald-600/90 text-white shadow-sm">
          {icon}
        </span>
      </div>
      <p className="relative text-xl font-extrabold text-emerald-900 m-0 mt-1">
        <CountUp value={value} />
      </p>
      <p className="relative text-[11px] text-emerald-700/80 mt-0.5 m-0 font-medium">
        {label}
      </p>
    </div>
  )
}

// ── CountUp animation ───────────────────────────────────────
// 0 (эсвэл өмнөх value) → шинэ value-руу 900ms ease-out-quart curve-ээр
// тоо нэмэгдэх анимэйшн. requestAnimationFrame ашиглаж smooth.
// prefers-reduced-motion идэвхтэй хэрэглэгчид animation-гүй шууд харагдана.
function CountUp({ value, duration = 900 }) {
  const [display, setDisplay] = useState(0)
  const previousValue = useRef(0)

  useEffect(() => {
    const target = Number(value) || 0
    if (target === previousValue.current) return

    // Accessibility: prefers-reduced-motion-тэй бол шууд set
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      setDisplay(target)
      previousValue.current = target
      return
    }

    let rafId
    const start = performance.now()
    const from  = previousValue.current
    const delta = target - from

    const tick = (now) => {
      const elapsed  = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out-quart — premium "settle slow" curve
      const eased = 1 - Math.pow(1 - progress, 4)
      setDisplay(Math.round(from + delta * eased))
      if (progress < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        previousValue.current = target
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [value, duration])

  return <>{display}</>
}

// ── Empty state ──────────────────────────────────────
function EmptyState({ hasFilter, onCreate }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-400
                      flex items-center justify-center mb-4">
        <MdDescription size={32} />
      </div>
      <p className="text-base font-semibold text-gray-900 m-0">
        {hasFilter ? 'Filter-т тохирох гэрээ олдсонгүй' : 'Гэрээ байхгүй байна'}
      </p>
      {!hasFilter && (
        <button
          onClick={onCreate}
          className="mt-4 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white
                     text-sm font-semibold rounded-xl transition-colors shadow-sm
                     cursor-pointer border-0"
        >
          Эхний гэрээгээ үүсгэх
        </button>
      )}
    </div>
  )
}
