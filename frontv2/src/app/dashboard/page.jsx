'use client'
import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  MdShoppingCart, MdPaid, MdDescription, MdShowChart,
  MdInsertChart, MdTrendingUp, MdStar, MdEmojiEvents,
} from 'react-icons/md'
import {
  GiSheep, GiGoat, GiCow, GiHorseHead, GiCamel, GiPawPrint,
} from 'react-icons/gi'

// ── Livestock icon map ─────────────────────────────────
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

// ── Period helpers ─────────────────────────────────────
function formatPeriod(date, period) {
  if (!date) return ''
  const d = new Date(date)
  const y = d.getFullYear()
  if (period === 'year')    return `${y}`
  if (period === 'quarter') return `${y} Q${Math.floor(d.getMonth() / 3) + 1}`
  return `${y}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

const formatMoney = (v) => v ? `₮${Number(v).toLocaleString('mn-MN')}` : '₮0'
const compactMoney = (v) => {
  if (!v) return '₮0'
  const n = Number(v)
  if (n >= 1_000_000) return `₮${(n / 1_000_000).toFixed(1)}сая`
  if (n >= 1_000)     return `₮${(n / 1_000).toFixed(0)}мян`
  return `₮${n}`
}

// Pie chart-д тус бүрд тод өнгө — ногоон gradient тус бүртэй зөрчил үүсэхгүйн тулд
// ялгаатай палитр ашиглана.
const PIE_COLORS = ['#3d3a8c', '#5b51d8', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4']
// Line chart нэг төрөл = нэг өнгө
const LINE_COLORS = ['#16a34a', '#3d3a8c', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7']

export default function DashboardPage() {
  const router = useRouter()
  const [role,   setRole]   = useState('buyer')
  const [period, setPeriod] = useState('month')
  const [data,    setData]    = useState(null)
  const [topUsers, setTopUsers] = useState([])
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
  const fetchTop = async () => {
    try {
      const res = await api.get('/users/top-rated?limit=5')
      setTopUsers(res.data.data || [])
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => { fetchStats() }, [role, period])
  useEffect(() => { fetchTop() }, [])

  // ── Derived stats ────────────────────────────────────
  const total = data?.total || {
    total_count: 0, total_amount: 0, contracts_count: 0, items_count: 0,
    avg_contract_amount: 0, max_contract_amount: 0,
  }
  const isEmpty = total.items_count === 0

  // Pie data: малын төрөл + percentage
  const pieData = useMemo(() => {
    const total = (data?.by_type || []).reduce((s, t) => s + t.count, 0) || 1
    return (data?.by_type || []).map(t => ({
      name:    t.livestock_type,
      value:   t.count,
      amount:  t.amount,
      percent: ((t.count / total) * 100).toFixed(1),
    }))
  }, [data])

  // Bar data: period × count + amount (ASC ордсон → шууд timeline)
  const barData = useMemo(() => {
    return (data?.by_period || []).map(p => ({
      period: formatPeriod(p.period, period),
      count:  p.count,
      amount: p.amount,
    }))
  }, [data, period])

  // Line data: period-д бүх төрлийн avg_price-г нэг row болгож pivot хийнэ
  const { lineData, trendTypes } = useMemo(() => {
    const rows = {}
    const types = new Set()
    for (const e of (data?.price_trend || [])) {
      const key = formatPeriod(e.period, period)
      if (!rows[key]) rows[key] = { period: key }
      rows[key][e.livestock_type] = Math.round(Number(e.avg_price) || 0)
      types.add(e.livestock_type)
    }
    return { lineData: Object.values(rows), trendTypes: [...types] }
  }, [data, period])

  // KPI: "Хамгийн их зардаг мал" + "Хамгийн идэвхтэй сар"
  const topType = pieData[0]?.name
  const topPeriod = useMemo(() => {
    if (!barData.length) return null
    return barData.reduce((m, p) => p.count > m.count ? p : m, barData[0])
  }, [barData])

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 m-0">Хяналтын самбар</h1>
          <p className="text-sm text-gray-500 mt-1 m-0">Таны малын худалдааны статистик</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-1 flex gap-1">
          <RoleTab active={role === 'buyer'}  onClick={() => setRole('buyer')}>
            <MdShoppingCart size={16} /> Худалдан авсан
          </RoleTab>
          <RoleTab active={role === 'seller'} onClick={() => setRole('seller')}>
            <MdPaid size={16} /> Худалдсан
          </RoleTab>
        </div>
      </div>

      {/* ── KPI CARDS (linear ногоон gradient) ───────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label={role === 'buyer' ? 'Худалдан авсан мал' : 'Худалдсан мал'}
          value={total.total_count}
          unit="толгой"
          icon={<GiSheep size={26} />}
        />
        <KpiCard
          label={role === 'buyer' ? 'Зарцуулсан' : 'Нийт орлого'}
          value={compactMoney(total.total_amount)}
          icon={<MdPaid size={26} />}
        />
        <KpiCard
          label="Дундаж гэрээ"
          value={compactMoney(total.avg_contract_amount)}
          icon={<MdShowChart size={26} />}
        />
        <KpiCard
          label="Хамгийн өндөр гэрээ"
          value={compactMoney(total.max_contract_amount)}
          icon={<MdTrendingUp size={26} />}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      ) : isEmpty ? (
        <EmptyState role={role} onCreate={() => router.push('/templates')} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Pie: Малын төрлөөр ──────────────────────── */}
          <Card
            title="Малын төрлөөр"
            subtitle={`Нийт ${pieData.length} төрлийн мал`}
            className="lg:col-span-1"
          >
            <ChartBox>
              <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={85}
                    paddingAngle={2}
                    label={(e) => `${e.percent}%`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, p) => [
                      `${value} толгой (${p.payload.percent}%)`,
                      name,
                    ]}
                  />
              </PieChart>
            </ChartBox>

            {/* Legend + insight */}
            <div className="flex flex-col gap-1.5 mt-3">
              {pieData.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-700">
                    <span className="w-2.5 h-2.5 rounded-sm"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <LivestockIcon type={t.name} size={14} className="text-gray-500" />
                    <span className="capitalize font-medium">{t.name}</span>
                  </span>
                  <span className="text-gray-500">
                    <span className="font-semibold text-gray-900">{t.percent}%</span>
                    <span className="mx-1.5">·</span>
                    {t.value} толгой
                  </span>
                </div>
              ))}
            </div>

            {topType && (
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
                Таны хамгийн их{' '}
                <span className="font-semibold text-emerald-700">
                  {role === 'buyer' ? 'авдаг' : 'зардаг'} мал: {topType}
                </span>
              </div>
            )}
          </Card>

          {/* ── Bar: Хугацаагаар ────────────────────────── */}
          <Card
            title="Сарын борлуулалт"
            subtitle="Период бүрийн малын тоо"
            className="lg:col-span-2"
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
            <ChartBox>
              <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#22c55e" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#15803d" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value, name) =>
                      name === 'count' ? [`${value} толгой`, 'Тоо'] : [formatMoney(value), 'Дүн']
                    }
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="url(#barGreen)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartBox>
            {topPeriod && (
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
                Хамгийн идэвхтэй период:{' '}
                <span className="font-semibold text-emerald-700">
                  {topPeriod.period} — {topPeriod.count} толгой
                </span>
              </div>
            )}
          </Card>

          {/* ── Line: Нэгж үнийн өсөлт ──────────────────── */}
          <Card
            title="Нэгж үнийн өсөлт"
            subtitle="Малын төрөл тус бүрийн дундаж үнэ"
            className="lg:col-span-2"
          >
            {lineData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-gray-400">
                Үнийн өгөгдөл хангалтгүй
              </div>
            ) : (
              <ChartBox>
                <LineChart data={lineData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      tickFormatter={compactMoney}
                    />
                    <Tooltip
                      formatter={(value, name) => [formatMoney(value), name]}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                    {trendTypes.map((t, i) => (
                      <Line
                        key={t}
                        type="monotone"
                        dataKey={t}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    ))}
                </LineChart>
              </ChartBox>
            )}
          </Card>

          {/* ── Top-5 rated users ────────────────────────── */}
          <Card
            title="Шилдэг хэрэглэгчид"
            subtitle="Үнэлгээний дундажаар Top 5"
            className="lg:col-span-1"
          >
            {topUsers.length === 0 ? (
              <div className="text-sm text-gray-400 py-6 text-center">
                Үнэлгээтэй хэрэглэгч одоохондоо алга
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {topUsers.map((u, i) => {
                  const name = [u.last_name, u.first_name].filter(Boolean).join(' ') || 'Хэрэглэгч'
                  return (
                    <div key={u.user_id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                      <RankBadge rank={i + 1} />
                      <Avatar url={u.profile_image_url} name={name} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate m-0">{name}</p>
                        <p className="text-[10px] text-gray-500 m-0 capitalize">
                          {u.user_type === 'admin' ? 'Админ' : 'Хэрэглэгч'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-700 flex items-center gap-0.5 m-0 justify-end">
                          <MdStar size={14} className="text-yellow-500" />
                          {Number(u.rating_avg).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-gray-500 m-0">{u.rating_count} үнэлгээ</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* ── Сүүлийн гүйлгээ ─────────────────────────── */}
          <Card
            title="Сүүлийн гүйлгээ"
            subtitle={`Сүүлийн ${data.recent.length} мөр`}
            className="lg:col-span-3"
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
                              className="text-emerald-700" />
                            <span className="capitalize">{r.livestock_type}</span>
                          </span>
                        </td>
                        <td className="px-2 py-3 text-right font-semibold text-gray-900">{r.count}</td>
                        <td className="px-2 py-3 text-right text-gray-700">{formatMoney(r.total_amount)}</td>
                        <td className="px-2 py-3 text-gray-700">{otherName}</td>
                        <td className="px-5 py-3 text-xs text-emerald-700 font-mono">{r.contract_number}</td>
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

// ResizeObserver-оор parent-ийн хэмжээг хэмжсэний дараа л Recharts-ыг
// mount хийнэ. Ингэснээр "width(-1) and height(-1)" warning гарахгүй.
function ChartBox({ children, className = 'h-64 w-full' }) {
  const ref = useRef(null)
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setReady(true)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className={className}>
      {ready && (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      )}
    </div>
  )
}

// KPI Card — linear ногоон gradient + цагаан текст
function KpiCard({ label, value, unit, icon }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 shadow-sm
                    bg-linear-to-br from-emerald-400 via-emerald-500 to-emerald-700
                    text-white">
      {/* arka decorative circle */}
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-white/5" />

      <div className="relative flex items-start justify-between mb-2">
        <span className="w-11 h-11 rounded-xl flex items-center justify-center
                         bg-white/20 backdrop-blur-sm text-white">
          {icon}
        </span>
      </div>
      <p className="relative text-2xl font-bold m-0">
        {value}
        {unit && <span className="text-sm font-normal text-white/80 ml-1">{unit}</span>}
      </p>
      <p className="relative text-xs text-white/90 mt-1 m-0">{label}</p>
    </div>
  )
}

function RoleTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border-0
                  inline-flex items-center gap-1.5
                  ${active
                    ? 'bg-emerald-600 text-white'
                    : 'bg-transparent text-gray-600 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  )
}

function Card({ title, subtitle, action, children, className = '' }) {
  // min-w-0 — grid item-ийн анхдагч min-width: auto-г дарж ResponsiveContainer-д
  // өөрийн өргөнийг хэмжих боломж олгоно (Recharts width(-1) бугыг засах).
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-5 min-w-0 ${className}`}>
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

function RankBadge({ rank }) {
  const colors = {
    1: 'bg-linear-to-br from-yellow-300 to-yellow-500 text-yellow-900',
    2: 'bg-linear-to-br from-gray-200 to-gray-400 text-gray-700',
    3: 'bg-linear-to-br from-orange-200 to-orange-400 text-orange-800',
  }
  const isTop = rank <= 3
  return (
    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                       ${colors[rank] || 'bg-gray-100 text-gray-500'}`}>
      {isTop ? <MdEmojiEvents size={14} /> : rank}
    </span>
  )
}

function Avatar({ url, name }) {
  if (url) {
    return (
      <img
        src={url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}/${url}`}
        alt={name}
        className="w-9 h-9 rounded-full object-cover shrink-0 border border-gray-200"
      />
    )
  }
  const initials = name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className="w-9 h-9 rounded-full flex items-center justify-center
                     bg-emerald-100 text-emerald-700 font-semibold text-xs shrink-0">
      {initials}
    </span>
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
        className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl
                   hover:bg-emerald-700 cursor-pointer border-0"
      >
        Гэрээ үүсгэх
      </button>
    </div>
  )
}
