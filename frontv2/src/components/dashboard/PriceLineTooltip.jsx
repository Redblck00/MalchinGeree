'use client'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatMoney } from '@/lib/dashboardFormat'

// ── PriceLineTooltip ───────────────────────────────────
// Line chart-ын custom tooltip — Figma design-аас санаа авсан.
// Header: period label + (prev → curr) trend % badge (up/down arrow + color)
// Body: цуврал тус бүрд (өнгөт цэг + name + value) мөр.
export default function PriceLineTooltip({ active, payload, label, lineData, trendTypes }) {
  if (!active || !payload || !payload.length) return null

  // Хувийн өөрчлөлт — өмнөх period-тэй харьцуулна
  const idx = lineData.findIndex(r => r.period === label)
  const prev = idx > 0 ? lineData[idx - 1] : null
  const sumOf = (row) => trendTypes.reduce((s, t) => s + (Number(row?.[t]) || 0), 0)
  const currTotal = sumOf(lineData[idx] || {})
  const prevTotal = sumOf(prev)
  const trendPct = prevTotal > 0 ? ((currTotal - prevTotal) / prevTotal) * 100 : null
  const trendUp  = (trendPct ?? 0) >= 0
  const TrendIcon = trendUp ? TrendingUp : TrendingDown

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3 min-w-52.5">
      {/* Header: label + trend % */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <span className="text-sm font-bold text-gray-900">{label}</span>
        {trendPct != null && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold
                            ${trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            <TrendIcon size={11} />
            {Math.abs(trendPct).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Series rows */}
      <div className="flex flex-col gap-1.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: p.color }}
              />
              <span className="text-[13px] text-gray-600 capitalize truncate">{p.name}</span>
            </span>
            <span className="text-[13px] font-bold text-gray-900 shrink-0">
              {formatMoney(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
