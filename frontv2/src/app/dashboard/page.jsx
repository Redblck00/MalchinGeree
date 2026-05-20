'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
// Material UI icons (UI)
import {
  MdShoppingCart, MdPaid, MdDescription, MdShowChart,
  MdInsertChart,
} from 'react-icons/md'
// Game Icons (livestock — Material-д тохирох амьтны icon байхгүй учир)
import {
  GiSheep, GiGoat, GiCow, GiHorseHead, GiCamel, GiPawPrint,
} from 'react-icons/gi'

// Малын төрөлд тохирсон icon
const LIVESTOCK_ICON = {
  'хонь':   GiSheep,    'sheep':  GiSheep,
  'ямаа':   GiGoat,     'goat':   GiGoat,
  'үхэр':   GiCow,      'cattle': GiCow,
  'адуу':   GiHorseHead,'horse':  GiHorseHead,
  'тэмээ':  GiCamel,    'camel':  GiCamel,
}
const iconOf = (type) => {
  const k = (type || '').toLowerCase().trim()
  for (const key of Object.keys(LIVESTOCK_ICON)) {
    if (k.includes(key)) return LIVESTOCK_ICON[key]
  }
  return GiPawPrint
}
const LivestockIcon = ({ type, size = 18, className = '' }) => {
  const Icon = iconOf(type)
  return <Icon size={size} className={className} />
}

// Period label
const PERIOD_LABEL = { month: 'Сар', quarter: 'Улирал', year: 'Жил' }

// Period шошго: PostgreSQL "2024-01-01T00:00:00.000Z" → "2024 01"
function formatPeriod(date, period) {
  if (!date) return ''
  const d = new Date(date)
  const y = d.getFullYear()
  if (period === 'year')    return `${y}`
  if (period === 'quarter') return `${y} Q${Math.floor(d.getMonth() / 3) + 1}`
  return `${y}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

const formatMoney = (v) => v ? `₮${Number(v).toLocaleString('mn-MN')}` : '₮0'

export default function DashboardPage() {
  const router = useRouter()
  const [role,   setRole]   = useState('buyer')   // 'buyer' эсвэл 'seller'
  const [period, setPeriod] = useState('month')   // 'month' | 'quarter' | 'year'
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/users/livestock/stats?role=${role}&period=${period}`)
      setData(res.data.data || res.data)
    } catch (err) {
      console.error(err)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [role, period])

  // by_type-ийн нийт count → percent тооцоо
  const typeMax = useMemo(
    () => Math.max(1, ...(data?.by_type || []).map(t => t.count)),
    [data]
  )
  const periodMax = useMemo(
    () => Math.max(1, ...(data?.by_period || []).map(p => p.count)),
    [data]
  )

  const total = data?.total || { total_count: 0, total_amount: 0, contracts_count: 0, items_count: 0 }
  const isEmpty = total.items_count === 0

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* ── Header ───────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 m-0">Хяналтын самбар</h1>
          <p className="text-sm text-gray-500 mt-1 m-0">
            Таны малын худалдааны статистик
          </p>
        </div>

        {/* Role tab */}
        <div className="bg-white rounded-xl border border-gray-200 p-1 flex gap-1">
          <RoleTab active={role === 'buyer'}  onClick={() => setRole('buyer')}>
            <MdShoppingCart size={16} /> Худалдан авсан
          </RoleTab>
          <RoleTab active={role === 'seller'} onClick={() => setRole('seller')}>
            <MdPaid size={16} /> Худалдсан
          </RoleTab>
        </div>
      </div>

      {/* ── Stats cards ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={role === 'buyer' ? 'Худалдан авсан мал' : 'Худалдсан мал'}
          value={total.total_count}
          unit="толгой"
          icon={<GiSheep size={22} />}
          color="bg-blue-50 text-blue-700"
        />
        <StatCard
          label={role === 'buyer' ? 'Зарцуулсан' : 'Орлого'}
          value={formatMoney(total.total_amount)}
          icon={<MdPaid size={22} />}
          color="bg-green-50 text-green-700"
        />
        <StatCard
          label="Гэрээний тоо"
          value={total.contracts_count}
          icon={<MdDescription size={22} />}
          color="bg-purple-50 text-purple-700"
        />
        <StatCard
          label="Дундаж нэг малын үнэ"
          value={total.total_count > 0
            ? formatMoney(total.total_amount / total.total_count)
            : '₮0'}
          icon={<MdShowChart size={22} />}
          color="bg-orange-50 text-orange-700"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-[#3d3a8c] rounded-full animate-spin" />
        </div>
      ) : isEmpty ? (
        <EmptyState role={role} onCreate={() => router.push('/templates')} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── Малын төрлөөр ─────────────────────── */}
          <Card title="Малын төрлөөр" subtitle={`Нийт ${data.by_type.length} төрлийн мал`}>
            <div className="flex flex-col gap-3">
              {data.by_type.map((t, i) => {
                const pct = (t.count / typeMax) * 100
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="flex items-center gap-2 text-gray-800">
                        <LivestockIcon type={t.livestock_type} size={20}
                          className="text-[#3d3a8c]" />
                        <span className="font-medium capitalize">{t.livestock_type}</span>
                      </span>
                      <span className="text-gray-500 text-xs">
                        <span className="font-semibold text-gray-900">{t.count}</span> толгой
                        <span className="mx-2">·</span>
                        {formatMoney(t.amount)}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: BAR_COLORS[i % BAR_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* ── Хугацаагаар ────────────────────────── */}
          <Card
            title="Цаг хугацаагаар"
            subtitle="Сүүлийн 12 период"
            action={
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg
                           outline-none bg-white cursor-pointer"
              >
                <option value="month">Сараар</option>
                <option value="quarter">Улирлаар</option>
                <option value="year">Жилээр</option>
              </select>
            }
          >
            <div className="flex items-end gap-2 h-40 pt-2">
              {[...data.by_period].reverse().map((p, i) => {
                const pct = (p.count / periodMax) * 100
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex flex-col items-center justify-end h-full">
                      <span className="text-[10px] font-semibold text-gray-700 mb-1">
                        {p.count}
                      </span>
                      <div
                        className="w-full bg-[#3d3a8c] rounded-t-md transition-all hover:bg-[#5b51d8]"
                        style={{ height: `${Math.max(pct, 4)}%` }}
                        title={`${formatPeriod(p.period, period)}: ${p.count} толгой, ${formatMoney(p.amount)}`}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 truncate w-full text-center">
                      {formatPeriod(p.period, period)}
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* ── Сүүлийн гүйлгээ ────────────────────── */}
          <Card
            title="Сүүлийн гүйлгээ"
            subtitle={`Сүүлийн ${data.recent.length} мөр`}
            className="lg:col-span-2"
          >
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase">
                    <th className="text-left px-5 py-2 font-medium">Огноо</th>
                    <th className="text-left px-2 py-2 font-medium">Мал</th>
                    <th className="text-right px-2 py-2 font-medium">Тоо</th>
                    <th className="text-right px-2 py-2 font-medium">Үнэ</th>
                    <th className="text-left px-2 py-2 font-medium">
                      {role === 'buyer' ? 'Худалдагч' : 'Худалдан авагч'}
                    </th>
                    <th className="text-left px-5 py-2 font-medium">Гэрээ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map(r => {
                    const otherName = [r.other_last_name, r.other_first_name].filter(Boolean).join(' ') || '—'
                    return (
                      <tr key={r.transaction_id}
                        onClick={() => router.push(`/dashboard/contracts/${r.contract_id}`)}
                        className="border-t border-gray-100 cursor-pointer hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-500 text-xs">
                          {new Date(r.transaction_date).toLocaleDateString('mn-MN')}
                        </td>
                        <td className="px-2 py-3 text-gray-900">
                          <span className="inline-flex items-center gap-1.5">
                            <LivestockIcon type={r.livestock_type} size={16}
                              className="text-[#3d3a8c]" />
                            <span className="capitalize">{r.livestock_type}</span>
                          </span>
                        </td>
                        <td className="px-2 py-3 text-right font-semibold text-gray-900">
                          {r.count}
                        </td>
                        <td className="px-2 py-3 text-right text-gray-700">
                          {formatMoney(r.total_amount)}
                        </td>
                        <td className="px-2 py-3 text-gray-700">{otherName}</td>
                        <td className="px-5 py-3 text-xs text-[#3d3a8c] font-mono">
                          {r.contract_number}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// SUBCOMPONENTS
// ══════════════════════════════════════════════════════

const BAR_COLORS = [
  '#3d3a8c', '#5b51d8', '#7c6df2', '#9f8af4',
  '#22c55e', '#f59e0b', '#ef4444', '#06b6d4',
]

function StatCard({ label, value, unit, icon, color }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-2">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${color}`}>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900 m-0">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
      <p className="text-xs text-gray-500 mt-1 m-0">{label}</p>
    </div>
  )
}

function RoleTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border-0
                  ${active
                    ? 'bg-[#3d3a8c] text-white'
                    : 'bg-transparent text-gray-600 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  )
}

function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-5 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 m-0">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 m-0">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ role, onCreate }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
      <MdInsertChart size={56} className="text-gray-300 mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-gray-900 m-0">
        {role === 'buyer' ? 'Худалдан авсан мал байхгүй' : 'Худалдсан мал байхгүй'}
      </h3>
      <p className="text-sm text-gray-500 mt-2 mb-5 m-0">
        Гэрээ амжилттай баталгаажсаны дараа малын мэдээлэл энд харагдах болно
      </p>
      <button
        onClick={onCreate}
        className="px-5 py-2.5 bg-[#3d3a8c] text-white text-sm font-semibold rounded-xl
                   hover:bg-[#2d2a6e] cursor-pointer border-0"
      >
        Гэрээ үүсгэх
      </button>
    </div>
  )
}
