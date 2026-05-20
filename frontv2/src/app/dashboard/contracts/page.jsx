"use client"
import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import {
  MdDescription, MdVerifiedUser, MdAccessTime, MdEventAvailable,
} from 'react-icons/md'

// WAITING нь PARTIALLY_SIGNED + FULLY_SIGNED-ийг нэг "Хүлээгдэж байгаа" хэлбэрээр
// харуулах virtual статус (DB-д байхгүй, зөвхөн UI-д).
const STATUS_LABELS = {
  DRAFT:     { label: 'Ноорог',           color: 'bg-slate-700/60 text-slate-200 border border-slate-500/40' },
  SENT:      { label: 'Илгээгдсэн',       color: 'bg-yellow-500/20 text-yellow-300 border border-yellow-400/30' },
  WAITING:   { label: 'Хүлээгдэж байгаа', color: 'bg-orange-500/20 text-orange-300 border border-orange-400/30' },
  COMPLETED: { label: 'Баталгаажсан',     color: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' },
  CLOSED:    { label: 'Хаагдсан',         color: 'bg-slate-400/30 text-slate-200 border border-slate-300/40' },
  DECLINED:  { label: 'Татгалзсан',       color: 'bg-red-500/20 text-red-300 border border-red-400/30' },
  CANCELLED: { label: 'Цуцлагдсан',       color: 'bg-red-500/20 text-red-300 border border-red-400/30' },
  EXPIRED:   { label: 'Хугацаа дууссан',  color: 'bg-gray-500/20 text-gray-300 border border-gray-400/30' },
}

// DB статусыг UI label руу хөрвүүлэх
const displayStatus = (s) => {
  if (s === 'PARTIALLY_SIGNED' || s === 'FULLY_SIGNED') return STATUS_LABELS.WAITING
  return STATUS_LABELS[s] || { label: s, color: 'bg-slate-700/60 text-slate-200 border border-slate-500/40' }
}

const STATUSES = ['', 'DRAFT', 'SENT', 'WAITING', 'COMPLETED', 'CANCELLED']

// Sidebar filter → contract шүүх логик
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

function StatCard({ label, value, icon }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-1 bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <span className="text-3xl font-bold text-white">{value}</span>
        <span className="text-2xl opacity-60">{icon}</span>
      </div>
      <span className="text-xs font-medium text-indigo-200">{label}</span>
    </div>
  )
}

export default function DocumentPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const sideFilter   = searchParams.get('filter')  // inbox | sent | waiting | closed

  const [contracts, setContracts] = useState([])
  const [loading,   setLoading]   = useState(true)

  // Filter state-үүд
  const [search,     setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')

  // Backend-с гэрээнүүд авах
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

  // Filter логик
  const filtered = useMemo(() => {
    const sideFn = SIDEBAR_FILTERS[sideFilter]   // URL ?filter=... sidebar-аас
    return contracts.filter((c) => {
      const text = (c.contract_number + ' ' + (c.title || '') + ' ' + (c.template_name || '')).toLowerCase()
      const matchSearch = !search || text.includes(search.toLowerCase())

      // Status filter — WAITING сонговол хоёр DB status-ийг шүүнэ
      const matchStatus = !statusFilter ||
        (statusFilter === 'WAITING'
          ? ['PARTIALLY_SIGNED', 'FULLY_SIGNED'].includes(c.status)
          : c.status === statusFilter)

      // Sidebar filter (inbox / sent / waiting / closed)
      const matchSide = !sideFn || sideFn(c)

      const created = new Date(c.created_at)
      const matchFrom = !dateFrom || created >= new Date(dateFrom)
      const matchTo   = !dateTo   || created <= new Date(dateTo + 'T23:59:59')
      return matchSearch && matchStatus && matchSide && matchFrom && matchTo
    })
  }, [contracts, search, statusFilter, dateFrom, dateTo, sideFilter])

  // Sidebar-аас ирсэн filter-ын title
  const pageTitle = SIDEBAR_TITLES[sideFilter] || { title: 'Гэрээнүүд', subtitle: 'Таны бүх гэрээний жагсаалт' }

  // Статистик
  const stats = useMemo(() => ({
    total:     contracts.length,
    active:    contracts.filter((c) => c.status === 'COMPLETED').length,
    waiting:   contracts.filter((c) => c.status === 'SENT' || c.status === 'PARTIALLY_SIGNED').length,
    closed:    contracts.filter((c) => c.status === 'COMPLETED' || c.status === 'CANCELLED').length,
  }), [contracts])

  const hasFilter = search || statusFilter || dateFrom || dateTo

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="p-6 min-h-screen bg-linear-to-br from-slate-900 via-indigo-900 to-slate-800">

      {/* ── Толгой хэсэг ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{pageTitle.title}</h1>
          <p className="text-sm text-indigo-300 mt-0.5">{pageTitle.subtitle}</p>
        </div>
        <button
          onClick={() => router.push('/templates')}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-900/40"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Гэрээ үүсгэх
        </button>
      </div>

      {/* ── Статистик ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Нийт гэрээ"      value={stats.total}   icon={<MdDescription size={28} />} />
        <StatCard label="Баталгаажсан"    value={stats.active}  icon={<MdVerifiedUser size={28} />} />
        <StatCard label="Хүлээгдэж байна" value={stats.waiting} icon={<MdAccessTime size={28} />} />
        <StatCard label="Дууссан"         value={stats.closed}  icon={<MdEventAvailable size={28} />} />
      </div>

      {/* ── Filter хэсэг ── */}
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-end">

          {/* Хайлт */}
          <div className="flex flex-col gap-1 flex-1 min-w-48">
            <label className="text-xs font-medium text-indigo-200">Гэрээний дугаар / нэр хайх</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300"
                fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="CNT-2025-000001 эсвэл нэр..."
                className="w-full pl-9 pr-3 py-2.5 border border-white/20 rounded-xl text-sm outline-none bg-white/10 text-white placeholder-indigo-300 focus:border-indigo-400 focus:bg-white/15 transition-colors"
              />
            </div>
          </div>

          {/* Статус filter */}
          <div className="flex flex-col gap-1 min-w-44">
            <label className="text-xs font-medium text-indigo-200">Статус</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 border border-white/20 rounded-xl text-sm outline-none bg-white/10 text-white focus:border-indigo-400 transition-colors"
            >
              <option value="" className="bg-slate-800">Бүгд</option>
              {STATUSES.filter(Boolean).map((s) => (
                <option key={s} value={s} className="bg-slate-800">{STATUS_LABELS[s]?.label || s}</option>
              ))}
            </select>
          </div>

          {/* Огноо — эхлэх */}
          <div className="flex flex-col gap-1 min-w-36">
            <label className="text-xs font-medium text-indigo-200">Эхлэх огноо</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2.5 border border-white/20 rounded-xl text-sm outline-none bg-white/10 text-white focus:border-indigo-400 transition-colors"
            />
          </div>

          {/* Огноо — дуусах */}
          <div className="flex flex-col gap-1 min-w-36">
            <label className="text-xs font-medium text-indigo-200">Дуусах огноо</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2.5 border border-white/20 rounded-xl text-sm outline-none bg-white/10 text-white focus:border-indigo-400 transition-colors"
            />
          </div>

          {/* Clear filter товч */}
          {hasFilter && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-red-300 border border-red-400/30 rounded-xl hover:bg-red-500/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Filter арилгах
            </button>
          )}
        </div>

        {/* Filter үр дүн */}
        {hasFilter && (
          <p className="text-xs text-indigo-300 mt-3">
            <span className="font-semibold text-white">{filtered.length}</span> гэрээ олдлоо
            {contracts.length !== filtered.length && ` (нийт ${contracts.length}-аас)`}
          </p>
        )}
      </div>

      {/* ── Гэрээний жагсаалт ── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-indigo-700 border-t-indigo-300 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <svg className="w-14 h-14 text-indigo-400/40 mb-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3-10.5H18a2.25 2.25 0 012.25 2.25V19.5A2.25 2.25 0 0118 21.75H6A2.25 2.25 0 013.75 19.5V7.5A2.25 2.25 0 016 5.25h2.25M9 3.75h6M9 3.75A2.25 2.25 0 006.75 6v.75M9 3.75A2.25 2.25 0 0111.25 6v.75m0 0h1.5m-1.5 0H9.75" />
          </svg>
          <p className="text-indigo-300 text-sm">
            {hasFilter ? 'Filter-т тохирох гэрээ олдсонгүй' : 'Гэрээ байхгүй байна'}
          </p>
          {!hasFilter && (
            <button
              onClick={() => router.push('/templates')}
              className="mt-4 px-5 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm rounded-xl transition-colors shadow-lg"
            >
              Эхний гэрээгээ үүсгэх
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1.5fr_2fr_1fr_1fr_1fr] gap-4 px-5 py-3 bg-white/10 border-b border-white/10 text-xs font-semibold text-indigo-300 uppercase tracking-wide">
            <span>Гэрээний дугаар</span>
            <span>Гарчиг / загвар</span>
            <span>Миний үүрэг</span>
            <span>Статус</span>
            <span>Огноо</span>
          </div>

          {/* Rows */}
          {filtered.map((contract, i) => {
            const status = displayStatus(contract.status)
            const date   = contract.created_at
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
                onClick={() => router.push(`/dashboard/contracts/${contract.contract_id}`)}
                className={`grid grid-cols-[1.5fr_2fr_1fr_1fr_1fr] gap-4 px-5 py-4 items-center cursor-pointer hover:bg-white/10 transition-colors ${
                  i < filtered.length - 1 ? 'border-b border-white/10' : ''
                }`}
              >
                <span className="text-sm font-semibold text-indigo-300">
                  {contract.contract_number || '—'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate m-0">{contract.title || '—'}</p>
                  {contract.template_name && (
                    <p className="text-xs text-indigo-300 truncate m-0">{contract.template_name}</p>
                  )}
                </div>
                <span className="text-sm text-gray-200">{myRoleLabel}</span>
                <span>
                  <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </span>
                <span className="text-xs text-indigo-400">{date}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}