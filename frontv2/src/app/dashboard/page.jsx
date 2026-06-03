'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import {
  MdShoppingCart, MdPaid, MdShowChart, MdTrendingUp, MdStar,
} from 'react-icons/md'
import { GiSheep } from 'react-icons/gi'
import { formatMoney, compactMoney } from '@/lib/dashboardFormat'
import KpiCard from '@/components/dashboard/KpiCard'
import ChartBox from '@/components/dashboard/ChartBox'
import PeriodPills from '@/components/dashboard/PeriodPills'
import RoleTab from '@/components/dashboard/RoleTab'
import AnalyticsPanel from '@/components/dashboard/AnalyticsPanel'
import RankBadge from '@/components/dashboard/RankBadge'
import Avatar from '@/components/dashboard/Avatar'
import EmptyState from '@/components/dashboard/EmptyState'
import LivestockIcon from '@/components/dashboard/LivestockIcon'
import PriceLineTooltip from '@/components/dashboard/PriceLineTooltip'
import RecentTransactions from '@/components/dashboard/RecentTransactions'

// ── Period helpers ─────────────────────────────────────
function formatPeriod(date, period) {
  if (!date) return ''
  const d = new Date(date)
  const y = d.getFullYear()
  if (period === 'year')    return `${y}`
  if (period === 'quarter') return `${y} Q${Math.floor(d.getMonth() / 3) + 1}`
  return `${y}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Pie chart-д тус бүрд тод өнгө — ногоон gradient тус бүртэй зөрчил үүсэхгүйн тулд
// ялгаатай палитр ашиглана.
const PIE_COLORS = ['#3d3a8c', '#5b51d8', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4']
// Line/Area chart — modern indigo/violet/pink palette
const LINE_COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']

// Бар chart-ын period filter — pill buttons-аар сонгоно
const PERIOD_OPTIONS = [
  { value: 'month',   label: 'Сар' },
  { value: 'quarter', label: 'Улирал' },
  { value: 'year',    label: 'Жил' },
  { value: 'weekday', label: '7 хоног' },
]

// Line chart (нэгж үнийн өсөлт)-ын filter — bar chart-аас тусдаа
const PRICE_PERIOD_OPTIONS = [
  { value: 'weekday', label: '7 хоног' },
  { value: 'month',   label: 'Сар' },
  { value: 'quarter', label: 'Улирал' },
]

// Долоо хоногийн өдрийн нэрс (getDay() index 0=Ня, 1=Да, ..., 6=Бя)
const WEEKDAY_LABELS = ['Ня', 'Да', 'Мя', 'Лха', 'Пү', 'Ба', 'Бя']

export default function DashboardPage() {
  const router = useRouter()
  const [role,   setRole]   = useState('buyer')
  const [period, setPeriod] = useState('month')
  const [data,    setData]    = useState(null)
  const [topUsers, setTopUsers] = useState([])
  const [loading, setLoading] = useState(true)

  // Line chart-д тусдаа period filter (default 7 хоног).
  // Энэ нь bar chart-ын period-ээс хамаарахгүй — тусдаа API дуудна.
  const [pricePeriod,   setPricePeriod]   = useState('weekday')
  const [priceTrendRaw, setPriceTrendRaw] = useState([])

  const fetchStats = async () => {
    setLoading(true)
    try {
      // 'weekday' нь backend-д байхгүй — month-аар татаад client-side group хийнэ
      const apiPeriod = period === 'weekday' ? 'month' : period
      const res = await api.get(`/users/livestock/stats?role=${role}&period=${apiPeriod}`)
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

  // Line chart-ын price trend-ийг тусдаа татна (pricePeriod-ээр).
  // weekday үед client-side `data.recent`-аас тооцох тул API дуудахгүй.
  useEffect(() => {
    if (pricePeriod === 'weekday') {
      setPriceTrendRaw([])
      return
    }
    api.get(`/users/livestock/stats?role=${role}&period=${pricePeriod}`)
      .then(r => setPriceTrendRaw((r.data.data || r.data).price_trend || []))
      .catch(() => setPriceTrendRaw([]))
  }, [role, pricePeriod])

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
    const rows = (data?.by_period || []).map(p => ({
      period: formatPeriod(p.period, period),
      count:  p.count,
      amount: p.amount,
    }))

    // Сараар шүүх үед — зөвхөн борлуулалт хийсэн сар биш, ЖИЛИЙН 12 САРЫГ
    // бүгдийг харуулна (борлуулалтгүй сар = 0). Ингэснээр цөөн баганатай үед
    // chart хэт өргөссөн харагдахаас сэргийлж, 12 сараар жигд хуваагдана.
    if (period === 'month') {
      // Өгөгдлийн хамгийн сүүлийн жилийг сонгоно (байхгүй бол одоогийн жил)
      const years = (data?.by_period || [])
        .map(p => new Date(p.period).getFullYear())
        .filter(y => !Number.isNaN(y))
      const year = years.length ? Math.max(...years) : new Date().getFullYear()

      const byKey = new Map(rows.map(r => [r.period, r]))
      return Array.from({ length: 12 }, (_, i) => {
        const key = `${year}.${String(i + 1).padStart(2, '0')}`
        return byKey.get(key) || { period: key, count: 0, amount: 0 }
      })
    }

    return rows
  }, [data, period])

  // Weekday data — `data.recent` гүйлгээнүүдээс client-side group хийж
  // долоо хоногийн өдөр тус бүрийн нийт (Даваагаас Ням хүртэл дарааллаар).
  const weekdayData = useMemo(() => {
    const buckets = Array.from({ length: 7 }, () => ({ count: 0, amount: 0 }))
    for (const r of (data?.recent || [])) {
      const d = new Date(r.transaction_date)
      if (Number.isNaN(d.getTime())) continue
      const dow = d.getDay() // 0=Ня ... 6=Бя
      buckets[dow].count  += Number(r.count) || 0
      buckets[dow].amount += Number(r.total_amount) || 0
    }
    // Даваа → Ням дараалал (Mongolian week)
    return [1, 2, 3, 4, 5, 6, 0].map(i => ({
      period: WEEKDAY_LABELS[i],
      count:  buckets[i].count,
      amount: buckets[i].amount,
    }))
  }, [data])

  const displayBarData = period === 'weekday' ? weekdayData : barData

  // Line data: pricePeriod-ээс хамаараад өөр source-аас тооцоолно.
  //   • 'weekday' — data.recent-аас day-of-week × type × avg(price_per_unit)
  //   • 'month' | 'quarter' — priceTrendRaw-аас period × type pivot
  const { lineData, trendTypes } = useMemo(() => {
    if (pricePeriod === 'weekday') {
      const buckets = Array.from({ length: 7 }, () => ({}))
      const types = new Set()
      for (const r of (data?.recent || [])) {
        const d = new Date(r.transaction_date)
        if (Number.isNaN(d.getTime())) continue
        const dow = d.getDay() // 0=Ня ... 6=Бя
        const t = r.livestock_type
        const price = Number(r.price_per_unit) || 0
        if (!price || !t) continue
        if (!buckets[dow][t]) buckets[dow][t] = []
        buckets[dow][t].push(price)
        types.add(t)
      }
      const order = [1, 2, 3, 4, 5, 6, 0] // Даваа → Ням
      return {
        lineData: order.map(i => {
          const row = { period: WEEKDAY_LABELS[i] }
          for (const [t, prices] of Object.entries(buckets[i])) {
            if (prices.length) {
              row[t] = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
            }
          }
          return row
        }),
        trendTypes: [...types],
      }
    }
    // month / quarter — priceTrendRaw-аас pivot
    const rows = {}
    const types = new Set()
    for (const e of priceTrendRaw) {
      const key = formatPeriod(e.period, pricePeriod)
      if (!rows[key]) rows[key] = { period: key }
      rows[key][e.livestock_type] = Math.round(Number(e.avg_price) || 0)
      types.add(e.livestock_type)
    }
    return { lineData: Object.values(rows), trendTypes: [...types] }
  }, [pricePeriod, priceTrendRaw, data])

  // KPI: "Хамгийн их зардаг мал" + "Хамгийн идэвхтэй период"
  const topType = pieData[0]?.name
  const topPeriod = useMemo(() => {
    if (!displayBarData.length) return null
    return displayBarData.reduce((m, p) => p.count > m.count ? p : m, displayBarData[0])
  }, [displayBarData])

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 bg-gray-50 min-h-screen">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4 sm:mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 m-0">Хяналтын самбар</h1>
          <p className="text-sm text-gray-500 mt-1 m-0">Таны малын худалдааны статистик</p>
        </div>

        <div className="w-full sm:w-auto bg-white  border border-gray-200 p-1 flex gap-1 shrink-0">
          <RoleTab active={role === 'buyer'}  onClick={() => setRole('buyer')} className="flex-1 sm:flex-none justify-center">
            <MdShoppingCart size={16} className="shrink-0" /> <span className="truncate">Худалдан авсан</span>
          </RoleTab>
          <RoleTab active={role === 'seller'} onClick={() => setRole('seller')} className="flex-1 sm:flex-none justify-center">
            <MdPaid size={16} className="shrink-0" /> <span className="truncate">Худалдсан</span>
          </RoleTab>
        </div>
      </div>

      {/* ── KPI CARDS (linear ногоон gradient) ───────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
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
        <>
          {/* ══════════════════════════════════════════════
              ТОП — Борлуулалт (full width, admin Panel style)
              Filter: Сар / Улирал / Жил / 7 хоног (өдрөөр)
              ══════════════════════════════════════════════ */}
          <AnalyticsPanel
            title="Борлуулалтын динамик"
            subtitle={
              period === 'weekday'
                ? 'Долоо хоногийн өдөр тус бүрд гарсан нийт борлуулалт'
                : 'Период бүрийн малын тоо ширхэг'
            }
            action={<PeriodPills options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />}
            className="mb-4"
          >
            <ChartBox className="h-56 sm:h-64 lg:h-72 w-full">
              <BarChart data={displayBarData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGreenLg" x1="0" y1="0" x2="0" y2="1">
                    {/* Teal → teal-уусмал цагаан (#e8fcf9) градиент */}
                    <stop offset="0%"   stopColor="#2dd4bf" stopOpacity={1} />
                    <stop offset="100%" stopColor="#e8fcf9" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: '#047857' }}
                  stroke="#d1fae5"
                  interval={0}
                  // Сараар үед 12 баганад жилийн угтвар давтахгүй — зөвхөн "MM"
                  tickFormatter={(v) => (period === 'month' ? String(v).split('.')[1] : v)}
                />
                <YAxis tick={{ fontSize: 11, fill: '#047857' }} stroke="#d1fae5" allowDecimals={false} />
                <Tooltip
                  formatter={(value, name) =>
                    name === 'count' ? [`${value} толгой`, 'Тоо'] : [formatMoney(value), 'Дүн']
                  }
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid #10b981',
                    borderRadius: 0,
                    fontSize: 12,
                    color: '#064e3b',
                  }}
                  labelStyle={{ color: '#047857', fontFamily: 'monospace' }}
                />
                <Bar
                  dataKey="count"
                  fill="url(#barGreenLg)"
                  stroke="#5eead4"
                  strokeWidth={1}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ChartBox>
            {topPeriod && topPeriod.count > 0 && (
              <div className="mt-3 pt-3 border-t border-emerald-100 text-xs text-gray-600
                              font-mono tracking-wide">
                {period === 'weekday' ? 'Хамгийн идэвхтэй өдөр' : 'Хамгийн идэвхтэй период'}:{' '}
                <span className="font-bold text-emerald-700">
                  {topPeriod.period} — {topPeriod.count} толгой
                </span>
              </div>
            )}
            {period === 'weekday' && (data?.recent || []).length === 0 && (
              <div className="mt-3 text-[11px] text-gray-400 m-0">
                ⓘ Сүүлийн гүйлгээнээс тооцоологдсон. Их өгөгдөл хуримтлуулсан үед илүү тодорхой харагдана.
              </div>
            )}
          </AnalyticsPanel>

          {/* ══════════════════════════════════════════════
              БУСАД chart-ууд — 3-col grid
              ══════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Pie: Малын төрлөөр ──────────────────────── */}
          <AnalyticsPanel
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
          </AnalyticsPanel>

          {/* ── Line: Нэгж үнийн өсөлт (тусдаа period filter) ── */}
          <AnalyticsPanel
            title="Нэгж үнийн өсөлт"
            subtitle={
              pricePeriod === 'weekday'
                ? 'Долоо хоногийн өдрөөр дундаж нэгж үнэ'
                : pricePeriod === 'quarter'
                  ? 'Улирлаар дундаж нэгж үнэ'
                  : 'Сараар дундаж нэгж үнэ'
            }
            className="lg:col-span-2"
            action={
              <PeriodPills
                options={PRICE_PERIOD_OPTIONS}
                value={pricePeriod}
                onChange={setPricePeriod}
              />
            }
          >
            {lineData.length === 0 ? (
              <div className="h-48 sm:h-64 flex items-center justify-center text-sm text-gray-400">
                Үнийн өгөгдөл хангалтгүй
              </div>
            ) : (
              <ChartBox>
                <AreaChart data={lineData} margin={{ top: 15, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    {trendTypes.map((t, i) => (
                      <linearGradient key={t} id={`priceArea-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"
                              stopColor={LINE_COLORS[i % LINE_COLORS.length]}
                              stopOpacity={0.25} />
                        <stop offset="100%"
                              stopColor={LINE_COLORS[i % LINE_COLORS.length]}
                              stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={compactMoney}
                  />
                  <Tooltip
                    content={<PriceLineTooltip lineData={lineData} trendTypes={trendTypes} />}
                    cursor={{ stroke: '#6366f1', strokeWidth: 1.5, strokeOpacity: 0.4 }}
                  />
                  {trendTypes.map((t, i) => (
                    <Area
                      key={t}
                      type="monotone"
                      dataKey={t}
                      name={t}
                      stroke={LINE_COLORS[i % LINE_COLORS.length]}
                      strokeWidth={2.5}
                      fill={`url(#priceArea-${i})`}
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                      connectNulls
                    />
                  ))}
                </AreaChart>
              </ChartBox>
            )}
          </AnalyticsPanel>

          {/* ── Top-5 rated users ────────────────────────── */}
          <AnalyticsPanel
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
          </AnalyticsPanel>

          {/* ── Сүүлийн гүйлгээ — Top users-тэй зэрэгцүүлэв (col-span-2) ── */}
          <AnalyticsPanel
            title="Сүүлийн гүйлгээ"
            subtitle={`Сүүлийн ${data.recent.length} мөр`}
            className="lg:col-span-2"
          >
            <RecentTransactions
              rows={data.recent}
              role={role}
              onOpen={(contractId) => router.push(`/dashboard/contracts/${contractId}`)}
            />
          </AnalyticsPanel>
          </div>
        </>
      )}
    </div>
  )
}
