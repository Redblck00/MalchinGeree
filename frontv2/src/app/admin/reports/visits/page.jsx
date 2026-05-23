'use client'
import { useEffect, useState, useMemo } from 'react'
import api from '@/lib/api'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

// ══════════════════════════════════════════════════════
// АДМИН — Зочдын тайлан
// Дизайн: dark "control center" — admin sidebar-тай нийцсэн
// (User dashboard-аас огт өөр: цайвар/ногоон gradient биш)
// ══════════════════════════════════════════════════════

const RANGE_OPTIONS = [
  { value: 1,   label: '24 цаг' },
  { value: 7,   label: '7 хоног' },
  { value: 30,  label: '30 хоног' },
  { value: 90,  label: '3 сар' },
  { value: 365, label: '1 жил' },
]

const ACCENT = '#34d399'   // emerald-400
const ACCENT_2 = '#22d3ee' // cyan-400
const PIE_COLORS = ['#34d399', '#22d3ee', '#a78bfa', '#fbbf24', '#f87171', '#94a3b8']

export default function VisitsReportPage() {
  const [days,    setDays]    = useState(30)
  const [report,  setReport]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get(`/admin/reports/visits?days=${days}`)
      .then(r => setReport(r.data.data))
      .catch(() => setReport(null))
      .finally(() => setLoading(false))
  }, [days])

  useEffect(() => {
    if (loading) { setMounted(false); return }
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [loading])

  const series = useMemo(() => (report?.series || []).map(r => ({
    day:     new Date(r.day).toLocaleDateString('mn-MN', { month: 'short', day: '2-digit' }),
    visits:  r.visits,
    uniques: r.uniques,
  })), [report])

  const hourly = useMemo(() => {
    const map = new Map((report?.hourly || []).map(h => [h.hour, h.hits]))
    return Array.from({ length: 24 }, (_, h) => ({
      hour: String(h).padStart(2, '0'),
      hits: map.get(h) || 0,
    }))
  }, [report])

  const sourcePie = useMemo(() => (report?.source_mix || []).map(s => ({
    name:  s.source === 'page' ? 'Frontend хуудас' : 'Public API',
    value: s.hits,
  })), [report])

  const kpi = report?.kpi || {}

  return (
    <div className="min-h-screen bg-[#0a0f0d] text-emerald-50 p-6 relative overflow-hidden">

      {/* ── BG: dotted grid + diagonal accent ─────────────────── */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #34d399 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div
        aria-hidden
        className="absolute -top-32 -right-32 w-96 h-96 rotate-45
                   bg-emerald-500/10 blur-3xl pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -left-20 w-80 h-80
                   bg-cyan-500/5 blur-3xl pointer-events-none"
      />

      <div className="relative z-10 max-w-7xl mx-auto">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-end justify-between mb-8 pb-5
                        border-b border-emerald-400/15">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-emerald-400/60 font-semibold mb-1">
              Analytics · Public Traffic
            </p>
            <h1 className="text-3xl font-bold text-white m-0 font-mono">
              Зочдын тайлан
            </h1>
            <p className="text-sm text-emerald-200/50 mt-1 m-0">
              Системд нэвтрээгүй хандсан хүний статистик
            </p>
          </div>

          {/* Range selector — diamond buttons */}
          <div className="flex gap-1 p-1 bg-emerald-900/40 border border-emerald-400/15 backdrop-blur-sm">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-all cursor-pointer border-0
                  ${days === opt.value
                    ? 'bg-emerald-400 text-emerald-950 font-bold shadow-md shadow-emerald-500/30'
                    : 'bg-transparent text-emerald-300/70 hover:bg-emerald-400/10 hover:text-white'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-32">
            <div className="w-10 h-10 border-2 border-emerald-400/20 border-t-emerald-400 rotate-45 animate-spin" />
          </div>
        ) : !report ? (
          <EmptyState />
        ) : (
          <>
            {/* ── KPI Strip ─────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <KpiTile
                label="Нийт хандалт"
                value={kpi.total_visits || 0}
                sub={`сүүлийн ${report.range_days} хоног`}
                accent={ACCENT}
              />
              <KpiTile
                label="Давтагдашгүй зочин"
                value={kpi.unique_visitors || 0}
                sub="IP+UA hash-аар"
                accent={ACCENT_2}
              />
              <KpiTile
                label="24 цагт"
                value={kpi.visits_24h || 0}
                sub="нийт хандалт"
                accent="#fbbf24"
              />
              <KpiTile
                label="24 цагт"
                value={kpi.unique_24h || 0}
                sub="давтагдашгүй"
                accent="#a78bfa"
              />
            </div>

            {/* ── Time series (том) ─────────────────────────── */}
            <Panel
              title="Хандалтын динамик"
              subtitle="Өдрийн нийт хандалт болон давтагдашгүй зочин"
              className="mb-6"
            >
              <div className="h-72 w-full">
                {mounted && (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="visitsG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={ACCENT} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="uniquesG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={ACCENT_2} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={ACCENT_2} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6ee7b7' }} stroke="#1f2937" />
                    <YAxis tick={{ fontSize: 11, fill: '#6ee7b7' }} stroke="#1f2937" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#0f1614',
                        border: '1px solid #34d39955',
                        borderRadius: 0,
                        fontSize: 12,
                        color: '#d1fae5',
                      }}
                      labelStyle={{ color: '#34d399', fontFamily: 'monospace' }}
                    />
                    <Area
                      type="monotone" dataKey="visits"
                      stroke={ACCENT} strokeWidth={2}
                      fill="url(#visitsG)" name="Нийт"
                    />
                    <Area
                      type="monotone" dataKey="uniques"
                      stroke={ACCENT_2} strokeWidth={2}
                      fill="url(#uniquesG)" name="Давтагдашгүй"
                    />
                  </AreaChart>
                </ResponsiveContainer>
                )}
              </div>
            </Panel>

            {/* ── Hour distribution + Source mix ─────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Panel
                title="Цагаар хуваарилалт"
                subtitle="Аль цагт хамгийн их орж байна"
                className="lg:col-span-2"
              >
                <div className="h-56 w-full">
                  {mounted && (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={hourly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#6ee7b7' }} stroke="#1f2937" />
                      <YAxis tick={{ fontSize: 10, fill: '#6ee7b7' }} stroke="#1f2937" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: '#0f1614',
                          border: '1px solid #34d39955',
                          borderRadius: 0,
                          fontSize: 12,
                          color: '#d1fae5',
                        }}
                        formatter={(v) => [`${v} хандалт`, 'Тоо']}
                        labelFormatter={(h) => `${h}:00 цаг`}
                      />
                      <Bar dataKey="hits" fill={ACCENT} />
                    </BarChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </Panel>

              <Panel
                title="Эх сурвалж"
                subtitle="Frontend vs API"
              >
                {sourcePie.length === 0 ? (
                  <EmptyMini text="Өгөгдөл алга" />
                ) : (
                  <div className="h-56 w-full">
                    {mounted && (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart>
                        <Pie
                          data={sourcePie}
                          dataKey="value" nameKey="name"
                          innerRadius={45} outerRadius={75}
                          paddingAngle={3}
                          stroke="#0a0f0d"
                          strokeWidth={2}
                        >
                          {sourcePie.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: '#0f1614',
                            border: '1px solid #34d39955',
                            borderRadius: 0,
                            fontSize: 12,
                            color: '#d1fae5',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    )}
                  </div>
                )}
                <div className="flex flex-col gap-1.5 mt-2">
                  {sourcePie.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-emerald-200/80">
                        <span className="w-2.5 h-2.5"
                          style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {s.name}
                      </span>
                      <span className="font-mono text-emerald-300 font-bold">{s.value}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* ── Top paths + referers ───────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Panel
                title="Хамгийн их зочлогдсон хаяг"
                subtitle="TOP 10 path"
              >
                {report.top_paths.length === 0 ? (
                  <EmptyMini text="Өгөгдөл алга" />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-emerald-400/60">
                        <th className="text-left py-2 font-semibold">Path</th>
                        <th className="text-right py-2 font-semibold">Hits</th>
                        <th className="text-right py-2 font-semibold">Uniq</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.top_paths.map((p, i) => (
                        <tr key={i} className="border-t border-emerald-400/10">
                          <td className="py-2.5 font-mono text-xs text-emerald-100 truncate max-w-[280px]">
                            {p.path}
                          </td>
                          <td className="py-2.5 text-right font-mono font-bold text-emerald-300">
                            {p.hits}
                          </td>
                          <td className="py-2.5 text-right font-mono text-cyan-300">
                            {p.uniques}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>

              <Panel
                title="Хаанаас ирсэн"
                subtitle="Referer (Direct = шууд URL/bookmark)"
              >
                {report.top_referers.length === 0 ? (
                  <EmptyMini text="Өгөгдөл алга" />
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {report.top_referers.map((r, i) => {
                      const max = report.top_referers[0].hits
                      const pct = (r.hits / max) * 100
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-emerald-100 truncate max-w-[260px]" title={r.referer}>
                              {shortenReferer(r.referer)}
                            </span>
                            <span className="font-mono font-bold text-emerald-300">{r.hits}</span>
                          </div>
                          <div className="h-1.5 bg-emerald-900/40 overflow-hidden">
                            <div className="h-full bg-linear-to-r from-emerald-400 to-cyan-400"
                                 style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// SUBCOMPONENTS
// ══════════════════════════════════════════════════════

function KpiTile({ label, value, sub, accent }) {
  return (
    <div className="relative bg-linear-to-br from-emerald-900/60 to-emerald-950/80
                    border border-emerald-400/15 backdrop-blur-sm p-5 overflow-hidden">
      {/* corner accent */}
      <div
        aria-hidden
        className="absolute top-0 left-0 w-12 h-1"
        style={{ background: accent }}
      />
      <div
        aria-hidden
        className="absolute -bottom-4 -right-4 w-16 h-16 rotate-45 opacity-10"
        style={{ background: accent }}
      />
      <p className="text-[10px] uppercase tracking-widest text-emerald-300/60 font-semibold m-0">
        {label}
      </p>
      <p className="text-3xl font-bold text-white font-mono mt-2 m-0" style={{ color: accent }}>
        {Number(value).toLocaleString('mn-MN')}
      </p>
      <p className="text-[11px] text-emerald-200/40 mt-1 m-0">{sub}</p>
    </div>
  )
}

function Panel({ title, subtitle, children, className = '' }) {
  return (
    <div className={`relative bg-emerald-950/30 border border-emerald-400/15 backdrop-blur-sm p-5 ${className}`}>
      {/* Top-left corner mark */}
      <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-emerald-400/50" />
      <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-emerald-400/50" />
      <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-emerald-400/50" />
      <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-emerald-400/50" />

      <div className="mb-4">
        <h2 className="text-sm font-bold text-white m-0 font-mono uppercase tracking-wider">{title}</h2>
        {subtitle && <p className="text-[11px] text-emerald-200/40 mt-0.5 m-0">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-emerald-950/30 border border-emerald-400/15 p-16 text-center">
      <div className="w-12 h-12 mx-auto mb-3 rotate-45 border border-emerald-400/30" />
      <h3 className="text-base font-bold text-white m-0 font-mono uppercase">No data</h3>
      <p className="text-xs text-emerald-200/40 mt-2 m-0">Тайлан гаргах боломжгүй байна</p>
    </div>
  )
}

function EmptyMini({ text }) {
  return (
    <div className="h-56 flex items-center justify-center text-xs text-emerald-200/40 font-mono uppercase">
      {text}
    </div>
  )
}

function shortenReferer(r) {
  if (!r || r === 'direct') return '— Шууд (direct)'
  try {
    const u = new URL(r)
    return u.hostname + (u.pathname !== '/' ? u.pathname : '')
  } catch { return r }
}
